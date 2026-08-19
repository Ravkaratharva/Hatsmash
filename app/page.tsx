"use client";

import { FormEvent, useState } from "react";

type ScanState = "idle" | "scanning" | "complete" | "error";

const scanSteps = [
  "Loading rendered page",
  "Checking accessibility",
  "Reading metadata & scripts",
  "Finding AI-build leftovers",
];

const tools = ["Lovable", "Cursor", "Bolt", "v0", "Replit Agent"];
const issues = [
  { level: "critical", category: "Accessibility", title: "Hero image has no alt text", detail: "Screen readers skip the page’s most important visual." },
  { level: "critical", category: "Security", title: "Public API key found in client bundle", detail: "A credential is readable in a shipped JavaScript file." },
  { level: "attention", category: "Performance", title: "Largest image ships at 2.8 MB", detail: "Your LCP is 4.1s on a mid-range mobile connection." },
  { level: "attention", category: "SEO", title: "Every page uses the same title", detail: "Search results can’t distinguish your routes." },
  { level: "quick", category: "AI-tell", title: "Placeholder copy survived the build", detail: "“Lorem ipsum” appears in the pricing FAQ." },
];

const promptByTool: Record<string, string> = {
  Lovable: "Update the hero image in src/components/Hero.tsx. Add concise, descriptive alt text that explains what the image contributes to the page. If the image is purely decorative, use alt=\"\" instead. Keep the current layout and styling unchanged.",
  Cursor: "In src/components/Hero.tsx, find the primary hero <img> or <Image> element. Add a meaningful alt attribute describing the image’s purpose in context. Use alt=\"\" only if it is decorative. Do not change the source, dimensions, layout, or styles.",
  Bolt: "Fix the missing accessible name on the hero image. Add contextual alt text to the hero image component, preserve the existing responsive sizing, and verify the rendered image has an alt attribute in the DOM.",
  v0: "Update the hero media component to meet WCAG image text-alternative requirements. Add descriptive alt text to the image while preserving all Tailwind classes, responsive behavior, and component props.",
  "Replit Agent": "Locate the main hero image component and add an appropriate alt attribute. Describe the image’s function in one short sentence, or use an empty alt value if decorative. Run the existing checks after the edit and avoid unrelated changes.",
};

export default function Home() {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<ScanState>("idle");
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [selectedTool, setSelectedTool] = useState("Cursor");
  const [copied, setCopied] = useState(false);

  async function runScan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    let normalizedUrl = url.trim();
    if (!/^https?:\/\//i.test(normalizedUrl)) normalizedUrl = `https://${normalizedUrl}`;

    try {
      new URL(normalizedUrl);
      setUrl(normalizedUrl);
      setState("scanning");
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: normalizedUrl }),
      });
      if (!response.ok) throw new Error("We couldn’t reach that page. Check the URL and try again.");
      await response.json();
      setState("complete");
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : "Something interrupted the scan. Try again.");
      setState("error");
    }
  }

  function unlockPrompts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) return;
    setUnlocked(true);
  }

  async function copyPrompt() {
    await navigator.clipboard.writeText(promptByTool[selectedTool]);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Hatsmash home">
          <span className="brand-mark" aria-hidden="true"><i /><b /></span>
          <span>Hatsmash</span>
        </a>
        <nav aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#pricing">Pricing</a>
          <a className="nav-cta" href="#scan">Run a scan</a>
        </nav>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow"><span /> Website QA for AI-built sites</p>
          <h1>Your site looks done.<br /><em>Let’s test that.</em></h1>
          <p className="hero-intro">
            Paste your URL. Hatsmash finds what your AI builder missed—and writes the exact prompt to fix each issue in Lovable, Cursor, Bolt, v0, or Replit.
          </p>

          <form className="scan-form" id="scan" onSubmit={runScan} noValidate>
            <label htmlFor="site-url">Website URL</label>
            <div className="input-row">
              <span aria-hidden="true">↗</span>
              <input
                id="site-url"
                type="text"
                inputMode="url"
                placeholder="your-site.com"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                required
                aria-describedby={error ? "scan-error" : "scan-note"}
              />
              <button type="submit" disabled={state === "scanning" || !url.trim()}>
                {state === "scanning" ? "Scanning…" : state === "complete" ? "Scan again" : "Smash test it"}
                <span aria-hidden="true">→</span>
              </button>
            </div>
            {error ? <p className="form-error" id="scan-error" role="alert">{error}</p> : <p className="form-note" id="scan-note">No signup. Your first 3 scans each day are free.</p>}
          </form>
        </div>

        <div className={`audit-window ${state}`} aria-live="polite">
          <div className="browser-bar">
            <div className="browser-dots" aria-hidden="true"><span /><span /><span /></div>
            <div className="address-bar">{url || "your-site.com"}</div>
            <div className="status-pill"><i /> {state === "scanning" ? "SCANNING" : state === "complete" ? "AUDIT READY" : "LIVE AUDIT"}</div>
          </div>
          <div className="audit-body">
            <div className="preview-pane" aria-hidden="true">
              <div className="mock-nav"><span /><span /><span /></div>
              <div className="mock-title" />
              <div className="mock-copy" />
              <div className="mock-copy short" />
              <div className="mock-button" />
              <div className="redline redline-one">01 <span>Missing alt text</span></div>
              <div className="redline redline-two">02 <span>Contrast 2.8:1</span></div>
              <div className="scan-line" />
            </div>

            <aside className="findings-pane">
              <div className="score-row">
                <div><small>Site health</small><strong>{state === "complete" ? "72" : "—"}<sup>/100</sup></strong></div>
                <span className="grade">{state === "complete" ? "C" : "?"}</span>
              </div>
              <div className="finding-summary">
                <p><span className="severity high" /> Critical <b>{state === "complete" ? "2" : "—"}</b></p>
                <p><span className="severity medium" /> Needs attention <b>{state === "complete" ? "7" : "—"}</b></p>
                <p><span className="severity low" /> Quick wins <b>{state === "complete" ? "11" : "—"}</b></p>
              </div>
              {state === "scanning" ? (
                <div className="scan-progress">
                  {scanSteps.map((step, index) => <p key={step} style={{ "--delay": `${index * 0.35}s` } as React.CSSProperties}><i /> {step}</p>)}
                </div>
              ) : (
                <div className={`locked-prompt ${unlocked ? "is-unlocked" : ""}`}>
                  <span>{selectedTool.toUpperCase()} FIX-PROMPT</span>
                  <p>{promptByTool[selectedTool]}</p>
                  <div>{unlocked ? "✓ Prompts unlocked" : "⌁ Unlock exact fix"}</div>
                </div>
              )}
            </aside>
          </div>
          <div className="window-footer"><span>ACCESSIBILITY</span><span>PERFORMANCE</span><span>SEO</span><span>AI-TELLS</span><span>SECURITY</span></div>
        </div>
      </section>

      {state === "complete" && (
        <section className="results" id="results">
          <div className="section-kicker">Scan complete · {url.replace(/^https?:\/\//, "")}</div>
          <div className="results-heading">
            <div><h2>20 things worth fixing.</h2><p>Here’s the evidence. The exact repair prompts are ready when you are.</p></div>
            <div className="result-score"><strong>72</strong><span>Site health<br />Needs attention</span></div>
          </div>

          <div className="results-layout">
            <div className="issue-list">
              {issues.map((issue, index) => (
                <article className="issue" key={issue.title}>
                  <span className={`issue-number ${issue.level}`}>{String(index + 1).padStart(2, "0")}</span>
                  <div><small>{issue.category} · {issue.level === "quick" ? "Quick win" : issue.level}</small><h3>{issue.title}</h3><p>{issue.detail}</p></div>
                  <button type="button" aria-label={`View fix for ${issue.title}`}>→</button>
                </article>
              ))}
              <p className="more-issues">+ 15 more issues across accessibility, performance, SEO, AI-tells, and security</p>
            </div>

            <aside className="prompt-card">
              {!unlocked ? (
                <>
                  <div className="prompt-lock">⌁</div>
                  <p className="section-kicker">Your fix-prompts are ready</p>
                  <h3>Don’t just find the issue.<br />Paste the fix.</h3>
                  <div className="blurred-code"><span>// Cursor</span><p>{promptByTool.Cursor}</p></div>
                  <form onSubmit={unlockPrompts} className="email-form">
                    <label htmlFor="unlock-email">Email address</label>
                    <input id="unlock-email" type="email" required placeholder="you@company.com" value={email} onChange={(event) => setEmail(event.target.value)} />
                    <button type="submit">Unlock all fix-prompts <span>→</span></button>
                  </form>
                  <small className="privacy-note">One useful email when your report is ready. Unsubscribe anytime.</small>
                </>
              ) : (
                <>
                  <div className="unlocked-badge">✓ FIX-PROMPTS UNLOCKED</div>
                  <h3>Paste this into {selectedTool}.</h3>
                  <div className="tool-tabs" role="tablist" aria-label="Target AI builder">
                    {tools.map((tool) => <button key={tool} type="button" role="tab" aria-selected={selectedTool === tool} onClick={() => setSelectedTool(tool)}>{tool}</button>)}
                  </div>
                  <div className="prompt-code"><span>// Fix 01 · Missing alt text</span><p>{promptByTool[selectedTool]}</p></div>
                  <button className="copy-button" type="button" onClick={copyPrompt}>{copied ? "Copied to clipboard ✓" : "Copy prompt"}</button>
                  <p className="unlock-confirmation">Prompts unlocked for this report. No redirect, no inbox detour.</p>
                </>
              )}
            </aside>
          </div>
        </section>
      )}

      <section className="how" id="how-it-works">
        <div className="how-copy">
          <p className="section-kicker">How Hatsmash works</p>
          <h2>A code review for the site your AI just shipped.</h2>
        </div>
        <ol className="process-list">
          <li><span>Paste</span><strong>Give us the live URL</strong><p>No repo access or setup. We inspect what your visitors actually receive.</p></li>
          <li><span>Inspect</span><strong>We test the rendered site</strong><p>Accessibility, speed, responsive behavior, SEO, security basics, and obvious AI leftovers.</p></li>
          <li><span>Repair</span><strong>Copy the fix into your builder</strong><p>Every issue comes with a prompt written for the tool you already use.</p></li>
        </ol>
      </section>

      <section className="pricing" id="pricing">
        <div className="pricing-intro"><p className="section-kicker">Simple pricing</p><h2>Free is useful.<br />Pro saves the history.</h2><p>We don’t hide whether your site works. Pay when you need volume, monitoring, and reports.</p></div>
        <div className="price-card free"><span>FREE</span><strong>$0</strong><p>For checking what you just shipped.</p><ul><li>3 scans per day</li><li>Full issue summary</li><li>Fix-prompts for one AI tool</li><li>No login required</li></ul><a href="#scan">Run a free scan →</a></div>
        <div className="price-card pro"><span>PRO · MONTHLY</span><strong>$19<small>/mo</small></strong><p>For sites you keep improving.</p><ul><li>Unlimited scans</li><li>All tool prompts side by side</li><li>Saved sites and scan history</li><li>PDF exports and weekly monitoring</li></ul><button type="button">Join the early-access list →</button></div>
      </section>

      <footer><a className="brand" href="#top"><span className="brand-mark" aria-hidden="true"><i /><b /></span><span>Hatsmash</span></a><p>Find what your AI builder missed.</p><small>© 2026 Hatsmash</small></footer>
    </main>
  );
}
