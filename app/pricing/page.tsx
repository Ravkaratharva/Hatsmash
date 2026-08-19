import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "../_components/SiteNav";

const title = "Pricing — Hatsmash";
const description = "Choose the Hatsmash plan that fits how often you audit AI-built websites.";
export const metadata: Metadata = {
  title, description,
  openGraph: { title, description, images: [] },
  twitter: { title, description, images: [] },
};

const plans = [
  {
    name: "Free",
    price: "$0",
    note: "For checking what you just shipped.",
    features: ["3 live scans per day", "Full issue summary", "Fix-prompts for one AI builder", "No login required"],
    cta: "Start smashing",
    popular: false,
  },
  {
    name: "Pro",
    price: "$19",
    suffix: "/month",
    note: "For people who ship AI-built sites weekly.",
    features: ["Unlimited live scans", "All builder prompts side by side", "Saved reports and site history", "Weekly re-scan monitoring", "Exportable reports"],
    cta: "Join the Pro waitlist",
    popular: true,
  },
  {
    name: "Creator",
    price: "$49",
    suffix: "/month",
    note: "For communities reviewing many projects.",
    features: ["Everything in Pro", "10 member workspaces", "Shared audit library", "Community challenges", "Priority report exports"],
    cta: "Join the Creator waitlist",
    popular: false,
  },
];

export default function PricingPage() {
  return (
    <main className="marketing-page inner-page">
      <SiteNav current="pricing" />
      <section className="inner-hero pricing-hero">
        <p className="marketing-eyebrow"><span>PRICING</span> The scan is useful before you pay</p>
        <h1>Free catches the issue.<br /><em>Pro remembers the site.</em></h1>
        <p>Pay for volume, history, and monitoring—not for the basic answer to “is this page broken?”</p>
      </section>

      <section className="pricing-grid" aria-label="Hatsmash plans">
        {plans.map((plan) => (
          <article className={plan.popular ? "plan-card popular" : "plan-card"} key={plan.name}>
            {plan.popular && <span className="popular-label">MOST POPULAR</span>}
            <h2>{plan.name}</h2>
            <div className="plan-price"><strong>{plan.price}</strong>{plan.suffix && <span>{plan.suffix}</span>}</div>
            <p>{plan.note}</p>
            <ul>{plan.features.map((feature) => <li key={feature}><span>✓</span>{feature}</li>)}</ul>
            {plan.name === "Free" ? (
              <Link href="/app">{plan.cta} <span>→</span></Link>
            ) : (
              <button type="button" title="Payments are not connected yet">{plan.cta} <span>→</span></button>
            )}
          </article>
        ))}
      </section>
      <p className="pricing-disclaimer">Pro and Creator checkout is intentionally not active yet. No payment will be collected.</p>

      <section className="faq-section">
        <div><p className="marketing-eyebrow"><span>FAQ</span> Straight answers</p><h2>Before you smash the buy button.</h2></div>
        <div className="faq-list">
          <details open><summary>What stays free?</summary><p>Three daily scans, the complete issue summary, and fix-prompts for one selected AI builder.</p></details>
          <details><summary>Why is there a scan limit?</summary><p>Live browser inspection costs money to run. The limit prevents abuse; it is not designed to make the free product useless.</p></details>
          <details><summary>Can I cancel anytime?</summary><p>Yes, once subscriptions launch. There is no active billing in this build.</p></details>
          <details><summary>Does Creator include client reports?</summary><p>Creator is planned to include shareable, exportable reports and a shared audit library.</p></details>
        </div>
      </section>
    </main>
  );
}
