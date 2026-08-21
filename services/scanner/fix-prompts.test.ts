import assert from "node:assert/strict";
import test from "node:test";
import { issueCategories, targetTools, type ScanIssueBase } from "../../lib/scan-schema.js";
import { generateFixPrompts } from "./fix-prompts.js";

test("every issue category has a substantive prompt for every supported tool", () => {
  for (const category of issueCategories) {
    const issue: ScanIssueBase = {
      id: "test",
      category,
      severity: "warning",
      message: "Example audit problem",
      location: "main > section",
      fixDescription: "Correct the underlying implementation.",
      ruleId: "example-rule",
      evidence: "The rendered page demonstrates the failure.",
    };
    const prompts = targetTools.map((tool) => generateFixPrompts(issue, tool));
    assert.equal(new Set(prompts).size, targetTools.length);
    for (const prompt of prompts) {
      assert.ok(prompt.length > 500);
      assert.match(prompt, /Example audit problem/);
      assert.match(prompt, /Acceptance criteria:/);
    }
  }
});
