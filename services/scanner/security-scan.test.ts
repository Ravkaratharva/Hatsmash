import assert from "node:assert/strict";
import test from "node:test";
import { runSecurityChecks } from "./security-scan.js";

test("security checks flag missing headers without leaking a detected value", () => {
  const secretLikeValue = `sk-${"a".repeat(28)}`;
  const issues = runSecurityChecks({
    finalUrl: "https://example.com/",
    responseHeaders: {},
    scriptBundles: [{ url: "https://example.com/app.js", content: `const token = '${secretLikeValue}'` }],
  });
  assert.ok(issues.some((issue) => issue.ruleId.startsWith("security-exposed")));
  assert.ok(issues.some((issue) => issue.ruleId === "security-header-content-security-policy"));
  assert.ok(issues.every((issue) => !issue.message.includes(secretLikeValue) && !issue.evidence.includes(secretLikeValue)));
});
