import { SiteNav } from "./_components/SiteNav";

export default function LandingPage() {
  return (
    <main className="marketing-page landing-page">
      <SiteNav current="home" />

      <section className="landing-hero">
        <div className="landing-copy">
          <p className="marketing-eyebrow"><span>LIVE QA</span> Built for sites made with AI</p>
          <h1>Your site looks done.<br /><em>Let’s test that.</em></h1>
          <p>
            Hatsmash catches the accessibility misses, slow pages, broken metadata, exposed keys, and suspicious AI leftovers—then writes the prompt that fixes each one.
          </p>
          <div className="landing-actions">
            <a className="primary-smash" href="/app">Smash It <span aria-hidden="true">→</span></a>
            <a className="secondary-action" href="/community">Explore Community <span aria-hidden="true">→</span></a>
          </div>
          <div className="landing-trust">
            <span><i /> No login to scan</span>
            <span>3 free scans daily</span>
            <span>Prompts for your builder</span>
          </div>
        </div>

        <div className="landing-audit" aria-label="Example Hatsmash audit showing website issues">
          <div className="landing-browser-bar">
            <div><i /><i /><i /></div>
            <span>your-new-site.com</span>
            <b><i /> AUDIT COMPLETE</b>
          </div>
          <div className="landing-audit-body">
            <div className="landing-site-mock" aria-hidden="true">
              <div className="mock-top"><i /><span /><span /><span /></div>
              <div className="mock-headline" />
              <div className="mock-headline short" />
              <div className="mock-paragraph" />
              <div className="mock-button" />
              <div className="mock-panels"><i /><i /><i /></div>
              <div className="landing-mark mark-one"><b>A11Y</b> Missing alt text</div>
              <div className="landing-mark mark-two"><b>AI-TELL</b> Placeholder found</div>
              <div className="landing-scan-line" />
            </div>
            <aside className="landing-scorecard">
              <p>HATSMASH SCORE</p>
              <div className="big-score"><strong>68</strong><span>/100</span></div>
              <div className="score-grade">NEEDS A SECOND PASS</div>
              <ul>
                <li><i className="fail" /><span>Critical</span><b>2</b></li>
                <li><i className="warn" /><span>Needs attention</span><b>7</b></li>
                <li><i className="pass" /><span>Quick wins</span><b>11</b></li>
              </ul>
              <div className="prompt-preview"><span>CURSOR FIX-PROMPT</span><p>Update the hero image component to include descriptive alt text…</p></div>
            </aside>
          </div>
          <div className="audit-category-row"><span>ACCESSIBILITY</span><span>PERFORMANCE</span><span>SEO</span><span>AI-TELLS</span><span>SECURITY</span></div>
        </div>
      </section>

      <section className="landing-sequence">
        <div className="sequence-intro">
          <p className="marketing-eyebrow"><span>HOW IT WORKS</span> From live URL to clean fix</p>
          <h2>A code review for the site your AI just shipped.</h2>
        </div>
        <ol>
          <li><b>01</b><div><span>Paste the live URL</span><p>No repo access or setup. We inspect the page your visitors actually receive.</p></div></li>
          <li><b>02</b><div><span>See what survived the prompt</span><p>We flag accessibility, speed, responsive, SEO, AI-tell, and security issues.</p></div></li>
          <li><b>03</b><div><span>Paste the repair prompt</span><p>Every finding becomes a fix written for Lovable, Cursor, Bolt, v0, or Replit.</p></div></li>
        </ol>
      </section>

      <section className="landing-final-cta">
        <p>YOUR AI BUILDER SAID “DONE.”</p>
        <h2>Hatsmash gets the last word.</h2>
        <a className="primary-smash" href="/app">Smash It <span aria-hidden="true">→</span></a>
      </section>
    </main>
  );
}
