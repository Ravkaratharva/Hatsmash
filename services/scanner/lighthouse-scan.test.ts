import assert from "node:assert/strict";
import test from "node:test";
import { assertCompleteLighthouseResult, auditDetailLocation } from "./lighthouse-scan.js";

test("Lighthouse detail parsing tolerates non-list audit details", () => {
  const fallback = "https://example.com/";

  assert.equal(auditDetailLocation({ items: { type: "table" } }, fallback), fallback);
  assert.equal(auditDetailLocation({ items: [{ node: { selector: "main img" } }] }, fallback), "main img");
  assert.equal(auditDetailLocation({ items: [{ url: "https://example.com/app.js" }] }, fallback), "https://example.com/app.js");
});

test("incomplete Lighthouse output is rejected instead of becoming a misleading score", () => {
  assert.throws(
    () => assertCompleteLighthouseResult({
      finalDisplayedUrl: "https://example.com/",
      audits: {},
      categories: {},
    }),
    (error: unknown) => error instanceof Error && error.message.includes("incomplete evidence"),
  );
});

test("a focused Lighthouse pass is accepted only when its requested category is complete", () => {
  assert.doesNotThrow(() => assertCompleteLighthouseResult({
    finalDisplayedUrl: "https://example.com/",
    audits: {
      "document-title": { id: "document-title", title: "Document has a title", score: 1 },
    },
    categories: {
      seo: { score: 1, auditRefs: [{ id: "document-title", weight: 1 }] },
    },
  }, ["seo"]));
});
