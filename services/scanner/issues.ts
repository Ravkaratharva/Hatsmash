import { createHash } from "node:crypto";
import type { ScanIssueBase } from "../../lib/scan-schema.js";

type IssueInput = Omit<ScanIssueBase, "id">;

export function createIssue(input: IssueInput): ScanIssueBase {
  const fingerprint = [input.category, input.ruleId, input.location, input.message].join("|");
  const id = createHash("sha256").update(fingerprint).digest("hex").slice(0, 16);
  return { id, ...input };
}

export function dedupeIssues(issues: ScanIssueBase[]) {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.ruleId}|${issue.location}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
