"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  issueCategories,
  type IssueCategory,
  type ScanIssueBase,
  type ScanJobAccepted,
  type ScanJobStatus,
  type ScanResult,
  type ScanStage,
} from "@/lib/scan-schema";
import { ThemeToggle } from "../_components/ThemeToggle";

type ScanState = "idle" | "scanning" | "complete" | "error";

const scanSteps: Array<{ stage: Exclude<ScanStage, "done" | "failed">; label: string }> = [
  { stage: "queued", label: "Waiting for an available scanner" },
  { stage: "rendering", label: "Rendering the live page" },
  { stage: "scanning", label: "Checking accessibility, performance, SEO, AI-tells, and security" },
  { stage: "generating-fixes", label: "Generating tool-specific fix prompts" },
];

const stageOrder = scanSteps.map((step) => step.stage);

const categoryLabels: Record<IssueCategory, { badge: string; tab: string }> = {
  Accessibility: { badge: "A11Y", tab: "Accessibility" },
  Performance: { badge: "PERF", tab: "Performance" },
  SEO: { badge: "SEO", tab: "SEO" },
  "AI-tell": { badge: "AI", tab: "AI-Tells" },
  Security: { badge: "SEC", tab: "Security" },
};

const demoFindings: ScanIssueBase[] = [
  {
    id: "demo-title-length",
    category: "SEO",
    severity: "warning",
    message: "Page title is 74 characters",
    location: "document head · <title>",
    fixDescription: "Shorten the page title to a focused 50–60 characters.",
    ruleId: "document-title-length",
    evidence: "The current title is 74 characters long.",
  },
  {
    id: "demo-alt-text",
    category: "Accessibility",
    severity: "critical",
    message: "Hero image has no alt text",
    location: "hero · img:nth-of-type(1)",
    fixDescription: "Add concise alternative text that describes the hero image.",
    ruleId: "image-alt",
    evidence: "The image has no alt attribute.",
  },
  {
    id: "demo-placeholder-copy",
    category: "AI-tell",
    severity: "warning",
    message: "Placeholder copy is still visible",
    location: "feature grid · card 2",
    fixDescription: "Replace generic placeholder text with specific product copy.",
    ruleId: "placeholder-copy",
    evidence: "The card includes the phrase ‘Lorem ipsum’.",
  },
  {
    id: "demo-csp",
    category: "Security",
    severity: "warning",
    message: "Content Security Policy is missing",
    location: "response headers",
    fixDescription: "Add a restrictive Content-Security-Policy response header.",
    ruleId: "content-security-policy",
    evidence: "No Content-Security-Policy header was returned.",
  },
  {
    id: "demo-render-blocking",
    category: "Performance",
    severity: "critical",
    message: "Render-blocking script delays first paint",
    location: "document head · app.bundle.js",
    fixDescription: "Defer the script or load it after critical page content.",
    ruleId: "render-blocking-resources",
    evidence: "app.bundle.js blocks the initial render for 820 ms.",
  },
  {
    id: "demo-contrast",
    category: "Accessibility",
    severity: "info",
    message: "CTA label has low color contrast",
    location: "hero · primary button",
    fixDescription: "Increase the contrast between the CTA label and its background.",
    ruleId: "color-contrast",
    evidence: "Contrast ratio is 3.1:1; expected at least 4.5:1.",
  },
  {
    id: "demo-frame-options",
    category: "Security",
    severity: "info",
    message: "Clickjacking protection is not set",
    location: "response headers",
    fixDescription: "Set frame-ancestors or X-Frame-Options for this page.",
    ruleId: "frame-options",
    evidence: "Neither frame-ancestors nor X-Frame-Options was returned.",
  },
  {
    id: "demo-hero-image-size",
    category: "Performance",
    severity: "warning",
    message: "Hero image is 1.8 MB larger than needed",
    location: "hero · cover.webp",
    fixDescription: "Resize and recompress the hero image for its rendered dimensions.",
    ruleId: "uses-optimized-images",
    evidence: "The 2400 px image renders at 960 px wide.",
  },
];

function errorMessage(payload: unknown, fallback: string) {
  if (!payload || typeof payload !== "object" || !("error" in payload)) return fallback;
  const error = (payload as { error?: unknown }).error;
  if (typeof error === "string") return error;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return fallback;
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function normalizeUrl(value: string) {
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  const parsed = new URL(withProtocol);
  if (!parsed.hostname.includes(".") && parsed.hostname !== "localhost") throw new Error("invalid");
  return parsed.toString();
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<ScanState>("idle");
  const [stage, setStage] = useState<Exclude<ScanStage, "done" | "failed">>("queued");
  const [statusText, setStatusText] = useState("Waiting for an available scanner…");
  const [error, setError] = useState("");
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [liveFindings, setLiveFindings] = useState<ScanIssueBase[]>([]);
  const [demoVisibleCount, setDemoVisibleCount] = useState(3);
  const [activeCategory, setActiveCategory] = useState<IssueCategory | null>(null);

  useEffect(() => {
    if (state !== "idle") return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const resetTimer = window.setTimeout(() => {
      setDemoVisibleCount(reducedMotion ? demoFindings.length : 3);
    }, 0);
    if (reducedMotion) {
      return () => window.clearTimeout(resetTimer);
    }

    const interval = window.setInterval(() => {
      setDemoVisibleCount((current) => current >= demoFindings.length ? 3 : current + 1);
    }, 1_350);

    return () => {
      window.clearTimeout(resetTimer);
      window.clearInterval(interval);
    };
  }, [state]);

  const sourceFindings: ScanIssueBase[] = state === "idle"
    ? demoFindings.slice(0, demoVisibleCount)
    : state === "complete"
      ? scan?.findings ?? []
      : state === "scanning"
        ? liveFindings
        : [];
  const filteredFindings = activeCategory
    ? sourceFindings.filter((finding) => finding.category === activeCategory)
    : sourceFindings;
  const visibleFindings = filteredFindings;
  const severityCounts = {
    critical: filteredFindings.filter((finding) => finding.severity === "critical").length,
    warning: filteredFindings.filter((finding) => finding.severity === "warning").length,
    info: filteredFindings.filter((finding) => finding.severity === "info").length,
  };
  const categoryCounts = Object.fromEntries(issueCategories.map((category) => [
    category,
    sourceFindings.filter((finding) => finding.category === category).length,
  ])) as Record<IssueCategory, number>;

  async function runScan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setScan(null);
    setLiveFindings([]);
    setActiveCategory(null);

    if (!url.trim()) {
      setState("error");
      setError("Paste a website URL to start the scan.");
      return;
    }

    let normalizedUrl: string;
    try {
      normalizedUrl = normalizeUrl(url.trim());
    } catch {
      setState("error");
      setError("That URL doesn’t look right. Try something like https://your-site.com.");
      return;
    }

    setUrl(normalizedUrl);
    setState("scanning");
    setStage("queued");
    setStatusText("Waiting for an available scanner…");

    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: normalizedUrl }),
      });
      const payload = await response.json() as ScanJobAccepted | unknown;
      if (!response.ok) {
        throw new Error(errorMessage(payload, "The scan could not be started."));
      }
      const accepted = payload as ScanJobAccepted;

      for (let attempt = 0; attempt < 90; attempt += 1) {
        if (attempt > 0) await wait(1_500);
        const statusResponse = await fetch(`/api/scan-status/${encodeURIComponent(accepted.jobId)}`, { cache: "no-store" });
        const statusPayload = await statusResponse.json() as ScanJobStatus | unknown;
        if (!statusResponse.ok) {
          throw new Error(errorMessage(statusPayload, "The scan status could not be checked."));
        }

        const current = statusPayload as ScanJobStatus;
        if (current.stage === "failed") throw new Error(current.error.message);
        if (current.stage === "done") {
          setStatusText(current.statusText);
          setScan(current.result);
          setLiveFindings(current.result.findings);
          setState("complete");
          return;
        }
        if (current.liveFindings) setLiveFindings(current.liveFindings);
        setStage(current.stage);
        setStatusText(current.statusText);
      }

      throw new Error("The audit is taking longer than expected. Please try again in a moment.");
    } catch (scanError) {
      setState("error");
      setError(scanError instanceof Error ? scanError.message : "The scan failed before it could finish. Please try again.");
    }
  }

  return (
    <main className="audit-app-shell">
      <header className="audit-app-header">
        <a className="logo-link" href="/" aria-label="Hatsmash home">
          <img src="/hatsmash-logo.png" width="378" height="153" alt="Hatsmash" />
        </a>
        <div className="audit-header-actions">
          <a href="/">Back to site</a>
          <ThemeToggle />
        </div>
      </header>

      <section className="audit-workspace" id="top">
        <div className="audit-workspace-heading">
          <div>
            <p className="eyebrow"><span aria-hidden="true">↳</span> Hatsmash analysis workspace</p>
            <h1>Website <em>analysis.</em></h1>
          </div>
          <p>Paste your URL to inspect accessibility, performance, SEO, AI-tells, and security in one focused report.</p>
        </div>

        <div className="audit-control-grid">
          <form className="scan-form audit-scan-form" onSubmit={runScan} noValidate>
            <div className="audit-control-heading">
              <div><span>01</span><strong>Scan a live website</strong></div>
              <small>3 free scans daily</small>
            </div>
            <label htmlFor="site-url">Website URL</label>
            <div className={`input-row ${error ? "has-error" : ""}`}>
              <span className="protocol" aria-hidden="true">https://</span>
              <input
                id="site-url"
                name="url"
                type="text"
                inputMode="url"
                autoComplete="url"
                placeholder="your-site.com"
                value={url.replace(/^https?:\/\//, "")}
                onChange={(event) => {
                  setUrl(event.target.value);
                  if (error) {
                    setError("");
                    setState("idle");
                  }
                }}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "scan-error" : "scan-note"}
              />
              <button type="submit" disabled={state === "scanning"}>
                {state === "scanning" ? "Inspecting…" : state === "complete" ? "Scan again" : "Scan website"}
                <span aria-hidden="true">→</span>
              </button>
            </div>
            {error ? (
              <p className="form-message error-message" id="scan-error" role="alert"><b>Scan stopped.</b> {error}</p>
            ) : (
              <p className="form-message" id="scan-note">No account required. Three free scans per day.</p>
            )}
          </form>

          <aside className="github-pro-card" aria-label="GitHub connection for Pro users">
            <div className="audit-control-heading">
              <div><span>02</span><strong>Connect GitHub</strong></div>
              <small className="pro-badge">Pro</small>
            </div>
            <p>Link the report to your repository and map findings to the exact files that need attention.</p>
            <a href="/pricing" title="GitHub connection is included with Hatsmash Pro">
              <span className="github-mark" aria-hidden="true">GH</span>
              Unlock GitHub connection
              <b aria-hidden="true">→</b>
            </a>
          </aside>
        </div>

        <section className={`inspection-window audit-results ${state}`} aria-live="polite" aria-label="Website analysis results">
          <div className="browser-bar">
            <div className="browser-dots" aria-hidden="true"><i /><i /><i /></div>
            <div className="address-bar"><span aria-hidden="true">⌁</span>{url || "hatsmash-demo.site"}</div>
            <div className="scan-status"><i />{state === "scanning" ? "LIVE SCAN" : state === "complete" ? "SCAN COMPLETE" : state === "error" ? "SCAN STOPPED" : "DEMO SCAN"}</div>
          </div>

          <div className="inspection-body">
            <div className="findings-rail">
              <div className="rail-heading">
                <div className="rail-title">
                  <span>{state === "idle" ? "DEMO FINDINGS" : "LIVE FINDINGS"}</span>
                  <b>{filteredFindings.length}<small>{filteredFindings.length === 1 ? " issue" : " issues"}</small></b>
                </div>
                {scan && <div className="analysis-score"><strong>{scan.score}</strong><span>/100<br />Hatsmash score</span></div>}
                <div className="severity-counts" aria-label="Finding severity counts">
                  <span className="critical"><i />{severityCounts.critical}<small>critical</small></span>
                  <span className="warning"><i />{severityCounts.warning}<small>warning</small></span>
                  <span className="info"><i />{severityCounts.info}<small>info</small></span>
                </div>
              </div>

              {state === "scanning" && liveFindings.length === 0 && (
                <div className="scan-progress">
                  {scanSteps.map((stepItem, index) => (
                    <p
                      className={stageOrder.indexOf(stepItem.stage) < stageOrder.indexOf(stage) ? "is-done" : stepItem.stage === stage ? "is-active" : "is-pending"}
                      key={stepItem.stage}
                      style={{ "--step-delay": `${index * 0.32}s` } as React.CSSProperties}
                    ><i />{stepItem.stage === stage ? statusText : stepItem.label}</p>
                  ))}
                </div>
              )}

              {state === "scanning" && liveFindings.length > 0 && (
                <div className="scan-progress-line"><i />{statusText}</div>
              )}

              {state === "error" && (
                <div className="rail-error">
                  <span>×</span>
                  <strong>Couldn’t finish this scan</strong>
                  <p>{error || "Check that the site is public and try again."}</p>
                </div>
              )}

              {state !== "error" && visibleFindings.length > 0 && (
                <div className="finding-list">
                  {visibleFindings.map((finding) => (
                    <div className="finding" key={finding.id}>
                      <div className="finding-meta">
                        <b className={`finding-category ${finding.severity}`}>{categoryLabels[finding.category].badge}</b>
                        <span className={`severity-label ${finding.severity}`}><i />{finding.severity}</span>
                      </div>
                      <strong>{finding.message}</strong>
                      {finding.location && <small>{finding.location}</small>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="category-strip" aria-label="Filter findings by category">
            {issueCategories.map((category) => (
              <button
                type="button"
                className={activeCategory === category ? "is-active" : ""}
                aria-pressed={activeCategory === category}
                aria-label={`${categoryLabels[category].tab}: ${categoryCounts[category]} findings`}
                key={category}
                onClick={() => setActiveCategory((current) => current === category ? null : category)}
              >
                <span>{categoryLabels[category].tab}</span><b>{categoryCounts[category]}</b>
              </button>
            ))}
          </div>
        </section>

        <footer className="audit-workspace-footer">
          <span><i /> Live browser inspection</span>
          <span>Fix prompts for Lovable, Cursor, Bolt, v0, and Replit</span>
          <a href="/pricing">Compare plans →</a>
        </footer>
      </section>
    </main>
  );
}
