import {
  scanResultSchema,
  targetTools,
  type IssueCategory,
  type ScanIssueBase,
  type ScanResult,
  type ScanStage,
} from "../../lib/scan-schema.js";
import { runAxeScan } from "./axe-scan.js";
import { generateFixPrompts } from "./fix-prompts.js";
import { runAiTellHeuristics } from "./heuristics/index.js";
import { dedupeIssues } from "./issues.js";
import { runLighthouseScan } from "./lighthouse-scan.js";
import { renderPage } from "./render-page.js";
import { runSecurityChecks } from "./security-scan.js";

export type ScanProgress = {
  stage: Exclude<ScanStage, "done" | "failed">;
  statusText: string;
};

type ProgressReporter = (progress: ScanProgress) => Promise<void> | void;

function issueScore(issues: ScanIssueBase[], category: IssueCategory) {
  const deductions = { critical: 24, warning: 10, info: 3 } as const;
  return Math.max(0, 100 - issues
    .filter((issue) => issue.category === category)
    .reduce((total, issue) => total + deductions[issue.severity], 0));
}

export async function runScanPipeline(inputUrl: string, reportProgress: ProgressReporter = () => undefined): Promise<ScanResult> {
  await reportProgress({ stage: "rendering", statusText: "Rendering page…" });
  const rendered = await renderPage(inputUrl);
  let renderedClosed = false;

  try {
    await reportProgress({ stage: "scanning", statusText: "Checking performance, accessibility, SEO, and security…" });
    const aiTellIssues = runAiTellHeuristics(rendered);
    const securityIssues = runSecurityChecks(rendered);
    const unfilteredAxeIssues = await runAxeScan(rendered.page, new Set());

    // Keep memory below small-host limits by closing Playwright before Lighthouse starts its own Chrome process.
    rendered.screenshot = Buffer.alloc(0);
    rendered.html = "";
    rendered.scriptBundles.length = 0;
    await rendered.close();
    renderedClosed = true;

    const lighthouse = await runLighthouseScan(rendered.finalUrl);
    const axeIssues = unfilteredAxeIssues.filter((issue) => !lighthouse.ruleIds.has(issue.ruleId));
    const baseIssues = dedupeIssues([
      ...lighthouse.issues,
      ...axeIssues,
      ...aiTellIssues,
      ...securityIssues,
    ]);

    await reportProgress({ stage: "generating-fixes", statusText: "Generating tool-specific fix prompts…" });
    const findings = baseIssues.map((issue) => ({
      ...issue,
      fixPrompts: targetTools.map((tool) => ({ tool, prompt: generateFixPrompts(issue, tool) })),
    }));
    const scores = {
      Accessibility: lighthouse.scores.Accessibility,
      Performance: lighthouse.scores.Performance,
      SEO: lighthouse.scores.SEO,
      "AI-tell": issueScore(baseIssues, "AI-tell"),
      Security: issueScore(baseIssues, "Security"),
    };
    const score = Math.round(Object.values(scores).reduce((total, value) => total + value, 0) / 5);

    return scanResultSchema.parse({
      url: rendered.finalUrl,
      score,
      scores,
      scannedAt: new Date().toISOString(),
      findings,
    });
  } finally {
    if (!renderedClosed) await rendered.close();
  }
}
