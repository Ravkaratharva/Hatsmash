import assert from "node:assert/strict";
import test from "node:test";
import { scanResultSchema, unlockRequestSchema } from "../../lib/scan-schema.js";
import {
  checkDatabaseReadiness,
  persistCapturedEmail,
  persistCompletedScan,
  type ScannerDatabaseAdapter,
} from "./database.js";

const result = scanResultSchema.parse({
  url: "https://example.com/",
  score: 100,
  scores: {
    Accessibility: 100,
    Performance: 100,
    SEO: 100,
    "AI-tell": 100,
    Security: 100,
  },
  scannedAt: new Date().toISOString(),
  findings: [],
});

test("missing database configuration never fails a completed scan", async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;

  const outcome = await persistCompletedScan(result, "hashed-ip", "2af6895c-8bbb-473c-905c-e4fe96b03483");
  assert.equal(outcome.status, "skipped");
  assert.equal(outcome.reason, "not_configured");
  await assert.doesNotReject(persistCapturedEmail("owner@example.com", "2af6895c-8bbb-473c-905c-e4fe96b03483"));

  if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousDatabaseUrl;
});

test("completed scan persistence is idempotent and reports duplicate delivery", async () => {
  const seen = new Set<string>();
  const events: string[] = [];
  const adapter: ScannerDatabaseAdapter = {
    async insertCompletedScan(record) {
      if (seen.has(record.id)) return "duplicate";
      seen.add(record.id);
      return "stored";
    },
    async insertCapturedEmail() {},
    async ping() {},
  };
  const options = {
    adapter,
    logger: { info: (line: unknown) => events.push(String(line)), error: (line: unknown) => events.push(String(line)) },
  };
  const scanId = "2af6895c-8bbb-473c-905c-e4fe96b03483";

  assert.equal((await persistCompletedScan(result, "hashed-ip", scanId, options)).status, "stored");
  assert.equal((await persistCompletedScan(result, "hashed-ip", scanId, options)).status, "duplicate");
  assert.equal(seen.size, 1);
  assert.match(events.at(-1) ?? "", /"status":"duplicate"/);
});

test("storage failures stay bounded, redact details, and never reject the scan", async () => {
  const events: string[] = [];
  const adapter: ScannerDatabaseAdapter = {
    async insertCompletedScan() {
      throw new Error("postgres://scanner:secret@internal-host/database");
    },
    async insertCapturedEmail() {},
    async ping() {
      throw new Error("private topology");
    },
  };
  const logger = { info: (line: unknown) => events.push(String(line)), error: (line: unknown) => events.push(String(line)) };

  const outcome = await persistCompletedScan(
    result,
    "hashed-ip",
    "2af6895c-8bbb-473c-905c-e4fe96b03483",
    { adapter, logger, timeoutMs: 50 },
  );
  assert.deepEqual(outcome, {
    scanId: "2af6895c-8bbb-473c-905c-e4fe96b03483",
    status: "failed",
    reason: "unavailable",
  });
  assert.doesNotMatch(events.join("\n"), /secret|internal-host|private topology/i);
  assert.deepEqual(await checkDatabaseReadiness({ adapter, timeoutMs: 50 }), {
    configured: true,
    available: false,
  });
});

test("a stalled database operation times out without an unhandled rejection", async () => {
  const adapter: ScannerDatabaseAdapter = {
    async insertCompletedScan() {
      return await new Promise<"stored">(() => undefined);
    },
    async insertCapturedEmail() {},
    async ping() {},
  };

  const outcome = await persistCompletedScan(
    result,
    undefined,
    "2af6895c-8bbb-473c-905c-e4fe96b03483",
    { adapter, timeoutMs: 20, logger: { info() {}, error() {} } },
  );
  assert.equal(outcome.status, "failed");
  assert.equal(outcome.reason, "timeout");
});

test("unlock request validation accepts a normalized email and rejects malformed input", () => {
  const valid = unlockRequestSchema.parse({
    email: "  ATHARVA@example.com ",
    scanId: "2af6895c-8bbb-473c-905c-e4fe96b03483",
  });
  assert.equal(valid.email, "atharva@example.com");

  assert.equal(unlockRequestSchema.safeParse({
    email: "not-an-email",
    scanId: "2af6895c-8bbb-473c-905c-e4fe96b03483",
  }).success, false);
  assert.equal(unlockRequestSchema.safeParse({
    email: "owner@example.com",
    scanId: "not-a-scan-id",
  }).success, false);
});
