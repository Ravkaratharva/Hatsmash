"use client";

import { FormEvent, useState } from "react";

type ScanState = "idle" | "scanning" | "complete" | "error";
type Severity = "critical" | "warning" | "info";

type Finding = {
  id: string;
  category: "Accessibility" | "Performance" | "SEO" | "AI-tell" | "Security";
  severity: Severity;
  title: string;
  evidence: string;
};

type ScanResponse = {
  url: string;
  score: number;
  scannedAt: string;
  findings: Finding[];
};

const scanSteps = [
  "Rendering the live page",
  "Testing semantics and contrast",
  "Reading network and metadata",
  "Checking for AI-build leftovers",
];

function normalizeUrl(value: string) {
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  const parsed = new URL(withProtocol);
  if (!parsed.hostname.includes(".") && parsed.hostname !== "localhost") throw new Error("invalid");
  return parsed.toString();
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<ScanState>("idle");
  const [error, setError] = useState("");
  const [scan, setScan] = useState<ScanResponse | null>(null);

  async function runScan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setScan(null);

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

    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: normalizedUrl }),
      });
      const payload = await response.json() as ScanResponse | { error?: string };
      if (!response.ok) {
        throw new Error("error" in payload && payload.error ? payload.error : "The scan failed before it could finish.");
      }
      setScan(payload as ScanResponse);
      setState("complete");
    } catch (scanError) {
      setState("error");
      setError(scanError instanceof Error ? scanError.message : "The scan failed before it could finish. Please try again.");
    }
  }

  return (
    <main className="page-shell">
      <header className="site-header">
        <a className="logo-link" href="#top" aria-label="Hatsmash home">
          <img src="/hatsmash-logo.png" width="378" height="153" alt="Hatsmash" />
        </a>
        <p><span aria-hidden="true" /> Free scan · no login</p>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow"><span aria-hidden="true">↳</span> Website QA for AI-built sites</p>
          <h1>Paste your URL.<br /><em>Fix what AI missed.</em></h1>
          <p className="hero-intro">
            Hatsmash checks the site your AI builder shipped, then turns every issue into an exact prompt for Lovable, Cursor, Bolt, v0, or Replit.
          </p>

          <form className="scan-form" onSubmit={runScan} noValidate>
            <label htmlFor="site-url">Website to inspect</label>
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
                {state === "scanning" ? "Inspecting…" : state === "complete" ? "Scan again" : "Scan this site"}
                <span aria-hidden="true">→</span>
              </button>
            </div>
            {error ? (
              <p className="form-message error-message" id="scan-error" role="alert"><b>Scan stopped.</b> {error}</p>
            ) : (
              <p className="form-message" id="scan-note">No repo access. No account. Three free scans per day.</p>
            )}
          </form>

          <div className="builder-line" aria-label="Supported AI website builders">
            <span>Fix prompts for</span>
            <b>Lovable</b><b>Cursor</b><b>Bolt</b><b>v0</b><b>Replit</b>
          </div>
        </div>

        <div className={`inspection-window ${state}`} aria-live="polite" aria-label="Website inspection preview">
          <div className="browser-bar">
            <div className="browser-dots" aria-hidden="true"><i /><i /><i /></div>
            <div className="address-bar"><span aria-hidden="true">⌁</span>{url || "your-site.com"}</div>
            <div className="scan-status"><i />{state === "scanning" ? "SCANNING" : state === "complete" ? "SCAN COMPLETE" : state === "error" ? "SCAN STOPPED" : "READY"}</div>
          </div>

          <div className="inspection-body">
            <div className="site-preview" aria-hidden="true">
              <div className="preview-nav"><i /><span /><span /><span /></div>
              <div className="preview-hero-line wide" />
              <div className="preview-hero-line" />
              <div className="preview-copy" />
              <div className="preview-copy short" />
              <div className="preview-action" />
              <div className="preview-cards"><i /><i /><i /></div>
              <div className="annotation annotation-alt"><b>A11Y</b><span>Image has no alt text</span></div>
              <div className="annotation annotation-title"><b>SEO</b><span>Title is 74 characters</span></div>
              <div className="annotation annotation-copy"><b>AI</b><span>Placeholder copy found</span></div>
              <div className="scan-beam"><span>INSPECTING DOM</span></div>
            </div>

            <aside className="findings-rail">
              <div className="rail-heading">
                <span>LIVE FINDINGS</span>
                <b>{scan ? scan.findings.length : "—"}</b>
              </div>

              {state === "scanning" && (
                <div className="scan-progress">
                  {scanSteps.map((step, index) => (
                    <p key={step} style={{ "--step-delay": `${index * 0.32}s` } as React.CSSProperties}><i />{step}</p>
                  ))}
                </div>
              )}

              {state === "error" && (
                <div className="rail-error">
                  <span>×</span>
                  <strong>Couldn’t finish this scan</strong>
                  <p>Check that the site is public and try again.</p>
                </div>
              )}

              {state === "complete" && scan && (
                <>
                  <div className="score-block"><strong>{scan.score}</strong><span>/100<br />SITE HEALTH</span></div>
                  <div className="finding-list">
                    {scan.findings.slice(0, 3).map((finding) => (
                      <div className="finding" key={finding.id}>
                        <i className={finding.severity} />
                        <div><span>{finding.category}</span><strong>{finding.title}</strong></div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {state === "idle" && (
                <div className="rail-idle">
                  <div className="reticle" aria-hidden="true"><i /></div>
                  <strong>Waiting for a URL</strong>
                  <p>The live audit will appear here.</p>
                </div>
              )}
            </aside>
          </div>

          <div className="category-strip" aria-hidden="true">
            <span>ACCESSIBILITY</span><span>PERFORMANCE</span><span>SEO</span><span>AI-TELLS</span><span>SECURITY</span>
          </div>
        </div>
      </section>
    </main>
  );
}
