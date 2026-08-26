import assert from "node:assert/strict";
import test from "node:test";
import { scanResultSchema, unlockRequestSchema } from "../../lib/scan-schema.js";
import { persistCapturedEmail, persistCompletedScan } from "./database.js";

test("missing database configuration never fails a completed scan", async () => {
  const previousDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;

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

  await assert.doesNotReject(persistCompletedScan(result, "hashed-ip", "2af6895c-8bbb-473c-905c-e4fe96b03483"));
  await assert.doesNotReject(persistCapturedEmail("owner@example.com", "2af6895c-8bbb-473c-905c-e4fe96b03483"));

  if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousDatabaseUrl;
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
