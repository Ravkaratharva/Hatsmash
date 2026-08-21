import assert from "node:assert/strict";
import test from "node:test";
import { auditDetailLocation } from "./lighthouse-scan.js";

test("Lighthouse detail parsing tolerates non-list audit details", () => {
  const fallback = "https://example.com/";

  assert.equal(auditDetailLocation({ items: { type: "table" } }, fallback), fallback);
  assert.equal(auditDetailLocation({ items: [{ node: { selector: "main img" } }] }, fallback), "main img");
  assert.equal(auditDetailLocation({ items: [{ url: "https://example.com/app.js" }] }, fallback), "https://example.com/app.js");
});
