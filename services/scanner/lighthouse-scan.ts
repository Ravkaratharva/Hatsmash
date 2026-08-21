import { launch } from "chrome-launcher";
import lighthouse from "lighthouse";
import { chromium } from "playwright";
import type { IssueCategory, ScanIssueBase } from "../../lib/scan-schema.js";
import { ScanError } from "./errors.js";
import { createIssue } from "./issues.js";

type LighthouseAudit = {
  id: string;
  title: string;
  description?: string;
  score: number | null;
  scoreDisplayMode?: string;
  details?: { items?: Array<{ node?: { selector?: string }; url?: string }> };
};

type LighthouseResult = {
  finalDisplayedUrl: string;
  audits: Record<string, LighthouseAudit>;
  categories: Record<string, {
    score: number | null;
    auditRefs: Array<{ id: string; weight: number }>;
  }>;
};

const categoryMap: Record<string, IssueCategory> = {
  accessibility: "Accessibility",
  performance: "Performance",
  seo: "SEO",
};

function cleanDescription(value?: string) {
  return (value ?? "Follow the audit guidance and verify the corrected page.")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

function severityForScore(score: number) {
  if (score < 0.5) return "critical" as const;
  if (score < 0.9) return "warning" as const;
  return "info" as const;
}

export async function runLighthouseScan(url: string) {
  const chrome = await launch({
    chromePath: chromium.executablePath(),
    chromeFlags: ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });

  try {
    const result = await lighthouse(url, {
      port: chrome.port,
      output: "json",
      logLevel: "error",
      onlyCategories: ["accessibility", "performance", "seo"],
      formFactor: "mobile",
      screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 2, disabled: false },
      throttlingMethod: "simulate",
    });
    if (!result) throw new ScanError("SCAN_FAILED", "Lighthouse could not inspect this page.", 500);

    const lhr = result.lhr as unknown as LighthouseResult;
    const issues: ScanIssueBase[] = [];
    const ruleIds = new Set<string>();
    const scores = {
      Accessibility: Math.round((lhr.categories.accessibility?.score ?? 0) * 100),
      Performance: Math.round((lhr.categories.performance?.score ?? 0) * 100),
      SEO: Math.round((lhr.categories.seo?.score ?? 0) * 100),
    };

    for (const [lighthouseCategory, hatsmashCategory] of Object.entries(categoryMap)) {
      const refs = lhr.categories[lighthouseCategory]?.auditRefs ?? [];
      for (const ref of refs) {
        const audit = lhr.audits[ref.id];
        if (!audit || audit.score === null || audit.score >= 1) continue;
        if (["notApplicable", "manual", "informative"].includes(audit.scoreDisplayMode ?? "")) continue;
        if (ref.weight === 0 && hatsmashCategory !== "Performance") continue;

        const location = audit.details?.items?.find((item) => item.node?.selector)?.node?.selector
          ?? audit.details?.items?.find((item) => item.url)?.url
          ?? lhr.finalDisplayedUrl;
        issues.push(createIssue({
          category: hatsmashCategory,
          severity: severityForScore(audit.score),
          message: audit.title,
          location,
          fixDescription: cleanDescription(audit.description),
          ruleId: audit.id,
          evidence: `Lighthouse score: ${Math.round(audit.score * 100)}/100.`,
        }));
        ruleIds.add(audit.id);
      }
    }

    return { issues, ruleIds, scores };
  } catch (error) {
    if (error instanceof ScanError) throw error;
    throw new ScanError("SCAN_FAILED", "The performance and SEO audit could not finish for this page.", 500);
  } finally {
    try {
      await chrome.kill();
    } catch {
      // Chrome can exit before chrome-launcher removes its temporary profile on Windows.
    }
  }
}
