import type { Metadata } from "next";
import { AuthPanel } from "../_components/AuthPanel";
import { SiteNav } from "../_components/SiteNav";
import { safeInternalReturnPath } from "../../lib/auth/redirects";

const title = "Sign Up — Hatsmash";
const description = "Create your Hatsmash account interface.";
export const metadata: Metadata = { title, description, openGraph: { title, description, images: [] }, twitter: { title, description, images: [] } };

export const dynamic = "force-dynamic";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ returnTo?: string | string[] }> }) {
  const params = await searchParams;
  const returnTo = safeInternalReturnPath(Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo);
  return <main className="marketing-page auth-page"><SiteNav /><section className="auth-shell"><div className="auth-visual signup-visual" aria-hidden="true"><div className="auth-stamp">NEW<br />INSPECTOR</div><div className="auth-redline"><span>VERIFY</span><b>Confirm your email</b></div><div className="auth-redline second"><span>PROTECT</span><b>Bot-checked access</b></div></div><AuthPanel mode="signup" returnTo={returnTo} /></section></main>;
}
