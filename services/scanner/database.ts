import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { randomUUID } from "node:crypto";
import { capturedEmails, scans } from "../../db/schema.js";
import type { ScanResult } from "../../lib/scan-schema.js";

let sqlClient: ReturnType<typeof postgres> | undefined;
let databaseAdapter: ScannerDatabaseAdapter | undefined;
let warnedAboutMissingDatabase = false;

const DATABASE_OPERATION_TIMEOUT_MS = 6_000;

type CompletedScanRecord = {
  id: string;
  url: string;
  score: number;
  scores: ScanResult["scores"];
  findings: ScanResult["findings"];
  ipHash: string | null;
  scannedAt: Date;
};

type CapturedEmailRecord = {
  email: string;
  scanId: string;
  source: "fix-prompt-unlock";
  createdAt: Date;
};

export type ScannerDatabaseAdapter = {
  insertCompletedScan(record: CompletedScanRecord): Promise<"stored" | "duplicate">;
  insertCapturedEmail(record: CapturedEmailRecord): Promise<void>;
  ping(): Promise<void>;
};

export type PersistenceOutcome = {
  scanId: string;
  status: "stored" | "duplicate" | "skipped" | "failed";
  reason?: "not_configured" | "timeout" | "unavailable";
};

type PersistenceOptions = {
  adapter?: ScannerDatabaseAdapter | null;
  logger?: Pick<Console, "info" | "error">;
  timeoutMs?: number;
};

class DatabaseOperationTimeoutError extends Error {
  constructor() {
    super("Database operation timed out");
    this.name = "DatabaseOperationTimeoutError";
  }
}

// SUPABASE_SERVICE_ROLE_KEY is reserved for server-only scanner work in a later
// prompt. Never import it under app/, prefix it with VITE_, or bundle it into
// browser code. Scan persistence uses DATABASE_URL and does not need this key.

function createDatabaseAdapter(databaseUrl: string): ScannerDatabaseAdapter {
  sqlClient = postgres(databaseUrl, {
    max: 2,
    idle_timeout: 20,
    connect_timeout: 5,
    max_lifetime: 60 * 10,
    connection: {
      application_name: "hatsmash-scanner",
      statement_timeout: 5_000,
      lock_timeout: 2_000,
    },
  });
  const db = drizzle(sqlClient);

  return {
    async insertCompletedScan(record) {
      const inserted = await db
        .insert(scans)
        .values(record)
        // Omitting an arbiter target keeps this INSERT-only role truly
        // write-only. PostgreSQL requires SELECT when a conflict target is
        // named, which would unnecessarily expose stored scan records.
        .onConflictDoNothing();
      return inserted.count > 0 ? "stored" : "duplicate";
    },
    async insertCapturedEmail(record) {
      await db.insert(capturedEmails).values(record);
    },
    async ping() {
      await sqlClient!`select 1`;
    },
  };
}

function scannerDatabase() {
  if (databaseAdapter) return databaseAdapter;

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    if (!warnedAboutMissingDatabase) {
      console.warn("DATABASE_URL is not configured; completed scans will not be persisted.");
      warnedAboutMissingDatabase = true;
    }
    return null;
  }

  databaseAdapter = createDatabaseAdapter(databaseUrl);
  return databaseAdapter;
}

function adapterFor(options: PersistenceOptions) {
  return Object.hasOwn(options, "adapter") ? options.adapter ?? null : scannerDatabase();
}

async function withTimeout<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new DatabaseOperationTimeoutError()), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function safeFailureReason(error: unknown): Exclude<PersistenceOutcome["reason"], undefined> {
  return error instanceof DatabaseOperationTimeoutError ? "timeout" : "unavailable";
}

function logPersistence(
  logger: Pick<Console, "info" | "error">,
  event: "scan_persistence" | "unlock_persistence",
  details: Record<string, string | number>,
  failed = false,
) {
  const line = JSON.stringify({ event, ...details });
  if (failed) logger.error(line);
  else logger.info(line);
}

export async function persistCompletedScan(
  result: ScanResult,
  ipHash?: string,
  scanId?: string,
  options: PersistenceOptions = {},
): Promise<PersistenceOutcome> {
  const resolvedScanId = scanId ?? randomUUID();
  const logger = options.logger ?? console;
  try {
    const db = adapterFor(options);
    if (!db) {
      const outcome = { scanId: resolvedScanId, status: "skipped", reason: "not_configured" } as const;
      logPersistence(logger, "scan_persistence", outcome);
      return outcome;
    }

    const status = await withTimeout(db.insertCompletedScan({
      id: resolvedScanId,
      url: result.url,
      score: result.score,
      scores: result.scores,
      findings: result.findings,
      ipHash: ipHash ?? null,
      scannedAt: new Date(result.scannedAt),
    }), options.timeoutMs ?? DATABASE_OPERATION_TIMEOUT_MS);
    const outcome = { scanId: resolvedScanId, status } as const;
    logPersistence(logger, "scan_persistence", outcome);
    return outcome;
  } catch (error) {
    const outcome = {
      scanId: resolvedScanId,
      status: "failed",
      reason: safeFailureReason(error),
    } as const;
    // Never log connection strings or raw database errors. The scan ID and
    // coarse failure reason are enough to correlate with protected provider logs.
    logPersistence(logger, "scan_persistence", outcome, true);
    return outcome;
  }
}

export async function persistCapturedEmail(
  email: string,
  scanId: string,
  options: PersistenceOptions = {},
) {
  const logger = options.logger ?? console;
  const db = adapterFor(options);
  if (!db) {
    logPersistence(logger, "unlock_persistence", { scanId, status: "skipped", reason: "not_configured" });
    return;
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await withTimeout(db.insertCapturedEmail({
        email,
        scanId,
        source: "fix-prompt-unlock",
        createdAt: new Date(),
      }), options.timeoutMs ?? DATABASE_OPERATION_TIMEOUT_MS);
      logPersistence(logger, "unlock_persistence", { scanId, status: "stored", attempt: attempt + 1 });
      return;
    } catch (error) {
      // A completed job becomes visible just before its fire-and-forget scan
      // row write may finish. Brief retries keep the scan foreign key reliable.
      if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
      else {
        logPersistence(logger, "unlock_persistence", {
          scanId,
          status: "failed",
          reason: safeFailureReason(error),
          attempt: attempt + 1,
        }, true);
      }
    }
  }
}

export async function checkDatabaseReadiness(options: PersistenceOptions = {}) {
  const db = adapterFor(options);
  if (!db) return { configured: false, available: false } as const;
  try {
    await withTimeout(db.ping(), options.timeoutMs ?? DATABASE_OPERATION_TIMEOUT_MS);
    return { configured: true, available: true } as const;
  } catch {
    return { configured: true, available: false } as const;
  }
}

export async function closeScannerDatabase() {
  await sqlClient?.end({ timeout: 5 });
  sqlClient = undefined;
  databaseAdapter = undefined;
}
