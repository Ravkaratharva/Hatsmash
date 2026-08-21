import { AxeBuilder } from "@axe-core/playwright";
import type { Page } from "playwright";
import type { ScanIssueBase } from "../../lib/scan-schema.js";
import { createIssue } from "./issues.js";

function severityForImpact(impact: string | null | undefined) {
  if (impact === "critical" || impact === "serious") return "critical" as const;
  if (impact === "moderate") return "warning" as const;
  return "info" as const;
}

export async function runAxeScan(page: Page, lighthouseRuleIds: Set<string>) {
  const results = await new AxeBuilder({ page }).analyze();
  const issues: ScanIssueBase[] = [];

  for (const violation of results.violations) {
    if (lighthouseRuleIds.has(violation.id)) continue;
    const firstNode = violation.nodes[0];
    issues.push(createIssue({
      category: "Accessibility",
      severity: severityForImpact(violation.impact),
      message: violation.help,
      location: firstNode?.target.join(" ") ?? "rendered page",
      fixDescription: violation.description,
      ruleId: violation.id,
      evidence: (firstNode?.failureSummary ?? `${violation.nodes.length} affected element(s).`).replace(/\s+/g, " ").slice(0, 500),
    }));
  }

  return issues;
}
