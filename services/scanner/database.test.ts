import assert from "node:assert/strict";
import test from "node:test";
import { scanResultSchema } from "../../lib/scan-schema.js";
import { persistCompletedScan } from "./database.js";

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

  await assert.doesNotReject(persistCompletedScan(result, "hashed-ip"));

  if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = previousDatabaseUrl;
});
