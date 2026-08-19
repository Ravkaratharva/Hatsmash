import type { Metadata } from "next";
import { AuthPanel } from "../_components/AuthPanel";
import { SiteNav } from "../_components/SiteNav";

const title = "Log In — Hatsmash";
const description = "Log in to your Hatsmash account interface.";
export const metadata: Metadata = { title, description, openGraph: { title, description, images: [] }, twitter: { title, description, images: [] } };

export default function LoginPage() {
  return <main className="marketing-page auth-page"><SiteNav /><section className="auth-shell"><div className="auth-visual" aria-hidden="true"><div className="auth-stamp">RETURNING<br />INSPECTOR</div><div className="auth-redline"><span>HISTORY</span><b>12 saved scans</b></div><div className="auth-redline second"><span>MONITORING</span><b>3 sites active</b></div></div><AuthPanel mode="login" /></section></main>;
}
