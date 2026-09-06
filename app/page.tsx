import { SiteNav } from "./_components/SiteNav";

export default function LandingPage() {
  return (
    <main className="marketing-page landing-page refreshed-landing">
      <SiteNav current="home" />
      <section className="welcome-hero" aria-labelledby="welcome-title">
        <p className="marketing-eyebrow">A little more care for your website</p>
        <div className="welcome-orbit" aria-hidden="true"><i /><i /><i /><i /></div>
        <h1 id="welcome-title"><span>Get started with</span>Hatsmash<span className="welcome-period">.</span></h1>
        <p className="welcome-description">Find what needs attention.<br />Make your website safer, faster, and easier to use.</p>
        <a className="primary-smash" href="/app">Start your website audit <span aria-hidden="true">↗</span></a>
        <a className="welcome-details" href="#how-it-works">See how it works <span aria-hidden="true">↓</span></a>
        <div className="welcome-categories" aria-label="What we check"><span>Security</span><span>Performance</span><span>Accessibility</span><span>SEO</span><span>Content quality</span></div>
      </section>
      <section className="care-section" id="how-it-works">
        <div className="care-heading"><p className="marketing-eyebrow">From finding to fixing</p><h2>Know what’s wrong.<br /><em>Know what to do next.</em></h2><p>A clear report of the issues we detect, with evidence and practical repair instructions. Start with what matters most.</p></div>
        <div className="repair-example" aria-label="Example finding and recommended fix">
          <div className="repair-example-heading"><span>EXAMPLE FINDING</span><span className="example-severity">Security · Needs attention</span></div>
          <h3>Missing protection against embedded pages</h3>
          <p>The response doesn’t specify which sites may display this page inside a frame.</p>
          <div className="repair-example-fix"><span>RECOMMENDED FIX</span><p>Set a frame-ancestors policy that permits only the origins your website needs. Test legitimate embeds before deploying the change.</p></div>
          <a href="/app">Find the issues on your website <span aria-hidden="true">→</span></a>
        </div>
      </section>
      <section className="care-steps" aria-label="How to audit your website">
        <article><span>01 / INSPECT</span><h3>Start with a URL.</h3><p>Enter your live website. We inspect the page your visitors receive.</p></article>
        <article><span>02 / UNDERSTAND</span><h3>See the details.</h3><p>Review findings by severity and category, with the evidence behind each issue.</p></article>
        <article><span>03 / IMPROVE</span><h3>Put the fix to work.</h3><p>Copy clear repair instructions, make the change, and run a fresh audit.</p></article>
      </section>
      <footer className="care-footer"><span>Hatsmash. Built for a better web.</span><a href="/app">Let’s check your website <span aria-hidden="true">↗</span></a></footer>
    </main>
  );
}
