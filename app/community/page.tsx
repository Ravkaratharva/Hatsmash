import type { Metadata } from "next";
import { SiteNav } from "../_components/SiteNav";

const title = "Community — Hatsmash";
const description = "Learn from common website issues and practical ways to improve security, accessibility, and performance.";
export const metadata: Metadata = {
  title, description,
  openGraph: { title, description, images: [] },
  twitter: { title, description, images: [] },
};

const submissions = [
  { title: "A faster first impression", category: "PERFORMANCE", issue: "Large assets can delay the content visitors came to see.", fix: "Resize images and defer nonessential scripts. Compare load times after the change." },
  { title: "Clear actions for everyone", category: "ACCESSIBILITY", issue: "Generic button labels make a page harder to navigate with assistive technology.", fix: "Use meaningful labels that explain the action and check the keyboard focus order." },
  { title: "Safer page embedding", category: "SECURITY", issue: "Missing frame restrictions can leave a page exposed to unwanted embedding.", fix: "Set a frame-ancestors policy and verify that trusted integrations still work." },
];

const checks = [
  { rank: "01", name: "Review the evidence", detail: "Understand where and why the issue occurs." },
  { rank: "02", name: "Make a focused change", detail: "Preserve the parts of the website that already work." },
  { rank: "03", name: "Test the experience", detail: "Check small screens, keyboard use, and error states." },
  { rank: "04", name: "Run another audit", detail: "Confirm the reported issue has been resolved." },
];

export default function CommunityPage() {
  return (
    <main className="marketing-page inner-page community-page">
      <SiteNav current="community" />
      <section className="inner-hero community-hero">
        <p className="marketing-eyebrow"><span>COMMUNITY</span> Better websites, shared knowledge</p>
        <h1>Small fixes.<br /><em>Better experiences.</em></h1>
        <p>Explore common website issues and learn what a thoughtful repair looks like. These illustrative examples are a starting point for your own review.</p>
        <div className="landing-actions">
          <a className="primary-smash" href="/app">Review your website <span>→</span></a>
        </div>
      </section>

      <section className="community-featured">
        <div className="section-heading"><p className="marketing-eyebrow"><span>FIELD NOTES</span> Illustrative examples</p><h2>Common issues. Clear next steps.</h2></div>
        <div className="submission-grid">
          {submissions.map((submission) => (
            <article className="submission-card" key={submission.title}>
              <div className="submission-top"><span>{submission.category}</span></div>
              <h3>{submission.title}</h3>
              <p>{submission.issue}</p>
              <div className="submission-footer"><p>{submission.fix}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="challenge-section">
        <div className="challenge-card">
          <span>A GOOD PLACE TO START</span>
          <h2>Give every detail a purpose.</h2>
          <p>Review unfinished copy, unclear buttons, and missing image descriptions. Small improvements can make a meaningful difference to your visitors.</p>
          <a href="/app">Find your next improvement →</a>
        </div>
        <div className="leaderboard">
          <p className="marketing-eyebrow"><span>REPAIR CHECKLIST</span> A repeatable process</p>
          {checks.map((check) => (
            <div className="leader-row" key={check.rank}><b>{check.rank}</b><div><strong>{check.name}</strong><span>{check.detail}</span></div></div>
          ))}
        </div>
      </section>

      <section className="community-cta">
        <p>MORE TO COME</p>
        <h2>A space to learn from each other.</h2>
        <p>Community submissions are coming soon. Start with an audit of your own website.</p>
      </section>
    </main>
  );
}
