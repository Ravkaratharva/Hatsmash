import type { Metadata } from "next";
import { AuthPanel } from "../_components/AuthPanel";
import { SiteNav } from "../_components/SiteNav";

const title = "Sign Up — Hatsmash";
const description = "Create your Hatsmash account interface.";
export const metadata: Metadata = { title, description, openGraph: { title, description, images: [] }, twitter: { title, description, images: [] } };

export default function SignupPage() {
  return <main className="marketing-page auth-page"><SiteNav /><section className="auth-shell"><div className="auth-visual signup-visual" aria-hidden="true"><div className="auth-stamp">NEW<br />INSPECTOR</div><div className="auth-redline"><span>SAVE</span><b>Keep every report</b></div><div className="auth-redline second"><span>WATCH</span><b>Re-scan on schedule</b></div></div><AuthPanel mode="signup" /></section></main>;
}
