import { launch } from "chrome-launcher";
import lighthouse from "lighthouse";
import { chromium } from "playwright";
import type { IssueCategory, ScanIssueBase } from "../../lib/scan-schema.js";
import { LIGHTHOUSE_TIMEOUT_MS } from "./config.js";
import { ScanError } from "./errors.js";
import { createIssue } from "./issues.js";

type LighthouseAudit = {
  id: string;
  title: string;
  description?: string;
  score: number | null;
  scoreDisplayMode?: string;
  details?: { items?: unknown };
};

type LighthouseResult = {
  finalDisplayedUrl: string;
  audits: Record<string, LighthouseAudit>;
  categories: Record<string, {
    score: number | null;
    auditRefs: Array<{ id: string; weight: number }>;
  }>;
  runtimeError?: { code?: string; message?: string };
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

export function auditDetailLocation(details: { items?: unknown } | undefined, fallback: string) {
  const detailItems = Array.isArray(details?.items)
    ? details.items as Array<{ node?: { selector?: string }; url?: string }>
    : [];
  return detailItems.find((item) => item.node?.selector)?.node?.selector
    ?? detailItems.find((item) => item.url)?.url
    ?? fallback;
}

export function assertCompleteLighthouseResult(
  result: LighthouseResult,
  requiredCategories = ["accessibility", "performance", "seo"],
) {
  if (result.runtimeError?.code) {
    throw new ScanError("AUDIT_INCOMPLETE", "The browser audit could not load this page reliably. Hatsmash will retry automatically.", 503);
  }

  const incomplete = requiredCategories.some((categoryName) => {
    const category = result.categories[categoryName];
    return !category || typeof category.score !== "number" || !Array.isArray(category.auditRefs) || category.auditRefs.length === 0;
  });
  if (incomplete || !result.audits || Object.keys(result.audits).length === 0) {
    throw new ScanError("AUDIT_INCOMPLETE", "The browser audit returned incomplete evidence. Hatsmash will retry automatically.", 503);
  }
}

async function runLighthousePass(url: string, onlyCategories: string[]) {
  const chrome = await launch({
    chromePath: chromium.executablePath(),
    chromeFlags: [
      "--headless=new",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-background-networking",
      "--disable-extensions",
      "--disable-sync",
      "--metrics-recording-only",
      "--mute-audio",
      "--no-first-run",
    ],
  });

  try {
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timeoutHandle = setTimeout(() => {
        try {
          chrome.kill();
        } catch {
          // The browser may already have stopped itself.
        }
        reject(new ScanError(
          "AUDIT_TIMEOUT",
          "The performance audit exceeded the free scanner’s time limit. Wait a moment for the scanner to warm up, then try again.",
          408,
        ));
      }, LIGHTHOUSE_TIMEOUT_MS);
      timeoutHandle.unref?.();
    });

    const audit = lighthouse(url, {
      port: chrome.port,
      output: "json",
      logLevel: "error",
      onlyCategories,
      formFactor: "mobile",
      screenEmulation: { mobile: true, width: 390, height: 844, deviceScaleFactor: 2, disabled: false },
      // Simulation is CPU-heavy and can stall indefinitely on small free hosts.
      // "provided" still measures the page while keeping the scan responsive.
      throttlingMethod: "provided",
      maxWaitForFcp: 30_000,
      maxWaitForLoad: 45_000,
      disableStorageReset: true,
    });
    const result = await Promise.race([audit, timeout]).finally(() => {
      if (timeoutHandle) clearTimeout(timeoutHandle);
    });
    if (!result) throw new ScanError("SCAN_FAILED", "Lighthouse could not inspect this page.", 500);

    const lhr = result.lhr as unknown as LighthouseResult;
    assertCompleteLighthouseResult(lhr, onlyCategories);
    return lhr;
  } finally {
    try {
      await chrome.kill();
    } catch {
      // Chrome can exit before chrome-launcher removes its temporary profile on Windows.
    }
  }
}

export async function runLighthouseScan(url: string) {
  try {
    // Keeping the DOM/SEO and performance work in separate browser processes avoids
    // incomplete Lighthouse reports on memory- and CPU-constrained scanner hosts.
    const contentResult = await runLighthousePass(url, ["accessibility", "seo"]);
    const performanceResult = await runLighthousePass(url, ["performance"]);
    const lhr: LighthouseResult = {
      finalDisplayedUrl: performanceResult.finalDisplayedUrl || contentResult.finalDisplayedUrl,
      audits: { ...contentResult.audits, ...performanceResult.audits },
      categories: { ...contentResult.categories, ...performanceResult.categories },
    };
    assertCompleteLighthouseResult(lhr);
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

        const location = auditDetailLocation(audit.details, lhr.finalDisplayedUrl);
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
    const detail = error instanceof Error ? error.message : String(error);
    console.error(`[scanner] Lighthouse failed: ${detail}`);
    throw new ScanError("SCAN_FAILED", "The performance and SEO audit could not finish for this page.", 500);
  }
}
