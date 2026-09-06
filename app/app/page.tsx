"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  issueCategories,
  unlockEmailSchema,
  type IssueCategory,
  type ScanIssue,
  type ScanIssueBase,
  type ScanJobAccepted,
  type ScanJobStatus,
  type ScanResult,
  type ScanStage,
} from "@/lib/scan-schema";
import { SiteNav } from "../_components/SiteNav";
import { repairPrompt } from "@/lib/repair-prompt";

type ScanState = "idle" | "scanning" | "complete" | "error";

const UNLOCK_EMAIL_STORAGE_KEY = "hatsmash_unlock_email";

function storedUnlockEmail() {
  if (typeof window === "undefined") return null;
  const storedEmail = window.localStorage.getItem(UNLOCK_EMAIL_STORAGE_KEY);
  const parsedEmail = unlockEmailSchema.safeParse(storedEmail);
  if (parsedEmail.success) return parsedEmail.data;
  if (storedEmail) window.localStorage.removeItem(UNLOCK_EMAIL_STORAGE_KEY);
  return null;
}

const scanSteps: Array<{ stage: Exclude<ScanStage, "done" | "failed">; label: string }> = [
  { stage: "queued", label: "Waiting for an available scanner" },
  { stage: "rendering", label: "Rendering the live page" },
  { stage: "scanning", label: "Checking accessibility, performance, SEO, content quality, and security" },
  { stage: "generating-fixes", label: "Preparing repair instructions" },
];

const stageOrder = scanSteps.map((step) => step.stage);

const categoryLabels: Record<IssueCategory, { badge: string; tab: string }> = {
  Accessibility: { badge: "A11Y", tab: "Accessibility" },
  Performance: { badge: "PERF", tab: "Performance" },
  SEO: { badge: "SEO", tab: "SEO" },
  "AI-tell": { badge: "QUALITY", tab: "Content quality" },
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

function errorCode(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("error" in payload)) return "";
  const error = (payload as { error?: unknown }).error;
  return error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : "";
}

async function readJsonResponse(response: Response) {
  const body = await response.text();
  if (!body) return null;
  try {
    return JSON.parse(body) as unknown;
  } catch {
    return {
      error: {
        code: "INVALID_SCANNER_RESPONSE",
        message: response.ok
          ? "The scanner returned an incomplete response. Please try again."
          : "The scanner is temporarily unavailable. Please try again shortly.",
      },
    };
  }
}

async function submitUnlockRequest(email: string, scanId: string) {
  try {
    const response = await fetch("/api/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, scanId }),
    });
    const payload = await readJsonResponse(response);
    if (response.status === 400) {
      return {
        invalid: true,
        message: errorMessage(payload, "Enter a valid email address and try again."),
      };
    }
  } catch {
    // A valid email still unlocks prompts when persistence is temporarily
    // unavailable. The scanner stores captures on a best-effort basis.
  }

  return { invalid: false, message: "" };
}

function isTransientScannerFailure(response: Response, payload: unknown) {
  return response.status === 502
    || response.status === 503
    || response.status === 504
    || errorCode(payload) === "SCANNER_WAKING";
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
  const [scanId, setScanId] = useState<string | null>(null);
  const [liveFindings, setLiveFindings] = useState<ScanIssueBase[]>([]);
  const [completedFindings, setCompletedFindings] = useState<ScanIssue[] | null>(null);
  const [demoVisibleCount, setDemoVisibleCount] = useState(3);
  const [activeCategory, setActiveCategory] = useState<IssueCategory | null>(null);
  const [expandedFindings, setExpandedFindings] = useState<Set<string>>(new Set());
  const [copyFeedback, setCopyFeedback] = useState<{ findingId: string; mode: "copied" | "selected" } | null>(null);
  const [unlockEmail, setUnlockEmail] = useState<string | null>(() => storedUnlockEmail());
  const [unlockEmailInput, setUnlockEmailInput] = useState(() => storedUnlockEmail() ?? "");
  const [unlockError, setUnlockError] = useState("");
  const [unlockSubmitting, setUnlockSubmitting] = useState(false);
  const reportedScanIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (state !== "complete" || !scanId || !unlockEmail || reportedScanIds.current.has(scanId)) return;
    reportedScanIds.current.add(scanId);
    void submitUnlockRequest(unlockEmail, scanId);
  }, [scanId, state, unlockEmail]);

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
      ? completedFindings ?? []
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
    setScanId(null);
    setLiveFindings([]);
    setCompletedFindings(null);
    setActiveCategory(null);
    setExpandedFindings(new Set());
    setCopyFeedback(null);

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
      const requestId = crypto.randomUUID();
      let accepted: ScanJobAccepted | null = null;
      for (let startAttempt = 0; startAttempt < 4; startAttempt += 1) {
        if (startAttempt > 0) {
          setStatusText(`Scanner is warming up… retry ${startAttempt + 1} of 4`);
          await wait(3_500);
        }

        const response = await fetch("/api/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: normalizedUrl, requestId }),
        });
        const payload = await readJsonResponse(response) as ScanJobAccepted | unknown;
        if (response.ok) {
          accepted = payload as ScanJobAccepted;
          break;
        }
        if (isTransientScannerFailure(response, payload) && startAttempt < 3) continue;
        throw new Error(errorMessage(payload, "The scan could not be started."));
      }
      if (!accepted) throw new Error("The scanner is still waking up. Please wait a minute and try again.");

      for (let attempt = 0; attempt < 160; attempt += 1) {
        if (attempt > 0) await wait(1_500);
        const statusResponse = await fetch(`/api/scan-status/${encodeURIComponent(accepted.jobId)}`, { cache: "no-store" });
        const statusPayload = await readJsonResponse(statusResponse) as ScanJobStatus | unknown;
        if (!statusResponse.ok) {
          if (isTransientScannerFailure(statusResponse, statusPayload)) {
            setStatusText("Reconnecting to the live scanner…");
            continue;
          }
          throw new Error(errorMessage(statusPayload, "The scan status could not be checked."));
        }

        const current = statusPayload as ScanJobStatus;
        if (current.stage === "failed") throw new Error(current.error.message);
        if (current.stage === "done") {
          setStatusText(current.statusText);
          setScan(current.result);
          setScanId(current.scanId);
          setCompletedFindings(current.result.findings);
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

  function toggleFinding(findingId: string) {
    if (state !== "complete") return;
    setExpandedFindings((current) => {
      const next = new Set(current);
      if (next.has(findingId)) next.delete(findingId);
      else next.add(findingId);
      return next;
    });
  }

  async function copyPrompt(finding: ScanIssue) {
    const prompt = repairPrompt(finding);
    if (!prompt) return;

    let mode: "copied" | "selected" = "copied";
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard API unavailable");
      await navigator.clipboard.writeText(prompt);
    } catch {
      mode = "selected";
      const selection = window.getSelection();
      const promptElement = document.getElementById(`prompt-${finding.id}`);
      if (selection && promptElement) {
        const range = document.createRange();
        range.selectNodeContents(promptElement);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }

    setCopyFeedback({ findingId: finding.id, mode });
    window.setTimeout(() => setCopyFeedback((current) => current?.findingId === finding.id ? null : current), 2_000);
  }

  async function unlockFixPrompts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUnlockError("");

    const parsedEmail = unlockEmailSchema.safeParse(unlockEmailInput);
    if (!parsedEmail.success) {
      setUnlockError("Enter a valid email address, such as you@example.com.");
      return;
    }
    if (!scanId) {
      setUnlockError("This scan is still finishing. Please try again in a moment.");
      return;
    }

    setUnlockSubmitting(true);
    const result = await submitUnlockRequest(parsedEmail.data, scanId);
    setUnlockSubmitting(false);
    if (result.invalid) {
      setUnlockError(result.message);
      return;
    }

    reportedScanIds.current.add(scanId);
    window.localStorage.setItem(UNLOCK_EMAIL_STORAGE_KEY, parsedEmail.data);
    setUnlockEmail(parsedEmail.data);
    setUnlockEmailInput(parsedEmail.data);
  }

  return (
    <main className="audit-app-shell">
      <SiteNav current="app" />

      <section className="audit-workspace" id="top">
        <div className="audit-workspace-heading">
          <div>
            <p className="eyebrow"><span aria-hidden="true">↳</span> Hatsmash analysis workspace</p>
            <h1>Website <em>analysis.</em></h1>
          </div>
          <p>Paste your URL to inspect accessibility, performance, SEO, content quality, and security in one focused report.</p>
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
              <p className="form-message" id="scan-note">Three free scans per day. Start with a live website URL.</p>
            )}
          </form>

          <aside className="github-pro-card" aria-label="Repository connection for Pro users">
            <div className="audit-control-heading">
              <div><span>02</span><strong>Connect repository</strong></div>
              <small className="pro-badge">Pro</small>
            </div>
            <p>Planned for Pro: connect your repository to bring findings closer to the code that needs attention.</p>
            <a href="/pricing" title="Repository connections are planned for Hatsmash Pro">
              <span className="github-mark" aria-hidden="true">&lt;/&gt;</span>
              Explore Pro
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
                {state === "complete" && (
                  <p className="repair-prompt-note">Expand a finding for evidence-based repair instructions.</p>
                )}
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
                    <div
                      className={`finding ${state === "complete" ? "is-expandable" : ""} ${expandedFindings.has(finding.id) ? "is-expanded" : ""}`}
                      key={finding.id}
                    >
                      {state === "complete" ? (
                        <button
                          type="button"
                          className="finding-toggle"
                          aria-expanded={expandedFindings.has(finding.id)}
                          aria-controls={`finding-details-${finding.id}`}
                          onClick={() => toggleFinding(finding.id)}
                        >
                          <span className="finding-meta">
                            <b className={`finding-category ${finding.severity}`}>{categoryLabels[finding.category].badge}</b>
                            <span className={`severity-label ${finding.severity}`}><i />{finding.severity}<span className="finding-chevron" aria-hidden="true">⌄</span></span>
                          </span>
                          <strong>{finding.message}</strong>
                          {finding.location && <small>{finding.location}</small>}
                        </button>
                      ) : (
                        <>
                          <div className="finding-meta">
                            <b className={`finding-category ${finding.severity}`}>{categoryLabels[finding.category].badge}</b>
                            <span className={`severity-label ${finding.severity}`}><i />{finding.severity}</span>
                          </div>
                          <strong>{finding.message}</strong>
                          {finding.location && <small>{finding.location}</small>}
                        </>
                      )}
                      {state === "complete" && (() => {
                        const completedFinding = completedFindings?.find((item) => item.id === finding.id);
                        if (!completedFinding) return null;
                        const prompt = repairPrompt(completedFinding);
                        return (
                          <div className="finding-details" id={`finding-details-${finding.id}`} aria-hidden={!expandedFindings.has(finding.id)}>
                            <div className="finding-details-inner">
                              {unlockEmail ? (
                                <>
                                  <p className="finding-fix-description">
                                    <span>Recommended fix</span>
                                    {completedFinding.fixDescription}
                                  </p>
                                  <div className="prompt-block">
                                    <div className="prompt-heading">
                                      <span>Repair prompt</span>
                                      <button
                                        type="button"
                                        aria-live="polite"
                                        tabIndex={expandedFindings.has(finding.id) ? 0 : -1}
                                        onClick={() => void copyPrompt(completedFinding)}
                                      >
                                        {copyFeedback?.findingId === finding.id
                                          ? copyFeedback.mode === "copied" ? "Copied" : "Text selected"
                                          : "Copy prompt"}
                                      </button>
                                    </div>
                                    <p id={`prompt-${finding.id}`}>{prompt ?? "A repair prompt is not available for this finding."}</p>
                                  </div>
                                </>
                              ) : (
                                <form className="unlock-gate" onSubmit={unlockFixPrompts} noValidate>
                                  <span className="unlock-gate-kicker">Fix prompts locked</span>
                                  <strong>Unlock every fix-prompt</strong>
                                  <p>Enter your email to unlock every fix-prompt for this scan.</p>
                                  <label htmlFor={`unlock-email-${finding.id}`}>Email address</label>
                                  <div className={`unlock-email-row ${unlockError ? "has-error" : ""}`}>
                                    <input
                                      id={`unlock-email-${finding.id}`}
                                      type="email"
                                      inputMode="email"
                                      autoComplete="email"
                                      placeholder="you@example.com"
                                      value={unlockEmailInput}
                                      tabIndex={expandedFindings.has(finding.id) ? 0 : -1}
                                      aria-invalid={Boolean(unlockError)}
                                      aria-describedby={unlockError ? `unlock-error-${finding.id}` : undefined}
                                      onChange={(event) => {
                                        setUnlockEmailInput(event.target.value);
                                        if (unlockError) setUnlockError("");
                                      }}
                                    />
                                    <button
                                      type="submit"
                                      disabled={unlockSubmitting}
                                      tabIndex={expandedFindings.has(finding.id) ? 0 : -1}
                                    >
                                      {unlockSubmitting ? "Unlocking…" : "Unlock prompts"}
                                      <span aria-hidden="true">→</span>
                                    </button>
                                  </div>
                                  {unlockError && <small id={`unlock-error-${finding.id}`} role="alert">{unlockError}</small>}
                                  <em>One unlock covers this scan and future scans in this browser.</em>
                                </form>
                              )}
                            </div>
                          </div>
                        );
                      })()}
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
          <span>Clear findings. Practical fixes.</span>
          <a href="/pricing">Compare plans →</a>
        </footer>
      </section>
    </main>
  );
}
