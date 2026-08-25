import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { scans } from "../../db/schema.js";
import type { ScanResult } from "../../lib/scan-schema.js";

let sqlClient: ReturnType<typeof postgres> | undefined;
let database: ReturnType<typeof drizzle> | undefined;
let warnedAboutMissingDatabase = false;

// SUPABASE_SERVICE_ROLE_KEY is reserved for server-only scanner work in a later
// prompt. Never import it under app/, prefix it with VITE_, or bundle it into
// browser code. Scan persistence uses DATABASE_URL and does not need this key.

function scannerDatabase() {
  if (database) return database;

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    if (!warnedAboutMissingDatabase) {
      console.warn("DATABASE_URL is not configured; completed scans will not be persisted.");
      warnedAboutMissingDatabase = true;
    }
    return null;
  }

  sqlClient = postgres(databaseUrl, {
    max: 2,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  database = drizzle(sqlClient);
  return database;
}

export async function persistCompletedScan(result: ScanResult, ipHash?: string) {
  try {
    const db = scannerDatabase();
    if (!db) return;

    await db.insert(scans).values({
      url: result.url,
      score: result.score,
      scores: result.scores,
      findings: result.findings,
      ipHash: ipHash ?? null,
      scannedAt: new Date(result.scannedAt),
    });
  } catch (error) {
    // Persistence is deliberately best-effort. A database outage must never
    // prevent the user from receiving an otherwise successful scan result.
    console.error("Failed to persist completed Hatsmash scan:", error instanceof Error ? error.message : error);
  }
}

export async function closeScannerDatabase() {
  await sqlClient?.end({ timeout: 5 });
  sqlClient = undefined;
  database = undefined;
}
