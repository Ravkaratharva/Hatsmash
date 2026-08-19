import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "../_components/SiteNav";

const title = "Community — Hatsmash";
const description = "See the funniest, sharpest, and most useful Hatsmash community audits.";
export const metadata: Metadata = {
  title, description,
  openGraph: { title, description, images: [] },
  twitter: { title, description, images: [] },
};

const submissions = [
  { site: "portfolio-but-make-it-3d.dev", score: 41, issue: "Three.js loaded 14 MB before the headline", builder: "v0", votes: 284 },
  { site: "definitely-not-a-template.com", score: 57, issue: "Six buttons still say “Get Started”", builder: "Lovable", votes: 219 },
  { site: "founder-mode-ai.io", score: 63, issue: "The contact form submits directly into the void", builder: "Bolt", votes: 176 },
];

const leaders = [
  { rank: "01", name: "Maya Chen", fixes: 43, badge: "REDLINE ROYALTY" },
  { rank: "02", name: "Dev Patel", fixes: 38, badge: "ALT-TEXT ENFORCER" },
  { rank: "03", name: "Noah Williams", fixes: 31, badge: "LIGHTHOUSE Tamer" },
  { rank: "04", name: "Lena Ortiz", fixes: 27, badge: "PLACEHOLDER HUNTER" },
];

export default function CommunityPage() {
  return (
    <main className="marketing-page inner-page community-page">
      <SiteNav current="community" />
      <section className="inner-hero community-hero">
        <p className="marketing-eyebrow"><span>COMMUNITY</span> The internet’s second pair of eyes</p>
        <h1>We found what the prompt <em>forgot.</em></h1>
        <p>Share spectacular misses, celebrate clean fixes, and see what other AI-built sites are getting wrong this week.</p>
        <div className="landing-actions">
          <Link className="primary-smash" href="/app">Smash your site <span>→</span></Link>
          <button className="secondary-action community-placeholder" type="button" title="Community posting is not connected yet">Share a result <span>↗</span></button>
        </div>
      </section>

      <section className="community-featured">
        <div className="section-heading"><p className="marketing-eyebrow"><span>TRENDING</span> Community finds</p><h2>This week’s most smashable sites.</h2></div>
        <div className="submission-grid">
          {submissions.map((submission) => (
            <article className="submission-card" key={submission.site}>
              <div className="submission-top"><span>{submission.builder}</span><b>{submission.score}<small>/100</small></b></div>
              <h3>{submission.site}</h3>
              <p>“{submission.issue}”</p>
              <div className="submission-footer"><span>▲ {submission.votes}</span><span>COMMUNITY VERIFIED</span></div>
            </article>
          ))}
        </div>
      </section>

      <section className="challenge-section">
        <div className="challenge-card">
          <span>WEEKLY CHALLENGE · 04 DAYS LEFT</span>
          <h2>Kill the placeholder.</h2>
          <p>Find and fix the most embarrassing placeholder copy that survived an AI build. Best repair prompt wins the “Lorem Slayer” badge.</p>
          <Link href="/app">Enter with a scan →</Link>
        </div>
        <div className="leaderboard">
          <p className="marketing-eyebrow"><span>LEADERBOARD</span> Fixes shipped this week</p>
          {leaders.map((leader) => (
            <div className="leader-row" key={leader.rank}><b>{leader.rank}</b><div><strong>{leader.name}</strong><span>{leader.badge}</span></div><em>{leader.fixes} fixes</em></div>
          ))}
        </div>
      </section>

      <section className="community-cta">
        <p>DISCORD IS COMING NEXT</p>
        <h2>Bring the site. We’ll bring the red pen.</h2>
        <button type="button" title="Discord community is not connected yet">Community invite coming soon</button>
      </section>
    </main>
  );
}
