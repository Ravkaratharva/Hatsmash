import type { Metadata } from "next";
import { AuthPanel } from "../_components/AuthPanel";
import { SiteNav } from "../_components/SiteNav";
import { safeInternalReturnPath } from "../../lib/auth/redirects";

const title = "Log In — Hatsmash";
const description = "Log in to your Hatsmash account interface.";
export const metadata: Metadata = { title, description, openGraph: { title, description, images: [] }, twitter: { title, description, images: [] } };

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ returnTo?: string | string[] }> }) {
  const params = await searchParams;
  const returnTo = safeInternalReturnPath(Array.isArray(params.returnTo) ? params.returnTo[0] : params.returnTo);
  return <main className="marketing-page auth-page"><SiteNav /><section className="auth-shell"><div className="auth-visual" aria-hidden="true"><div className="auth-stamp">SECURE<br />ACCESS</div><div className="auth-redline"><span>EMAIL CODE</span><b>No password to steal</b></div><div className="auth-redline second"><span>SESSION</span><b>Server-verified access</b></div></div><AuthPanel mode="login" returnTo={returnTo} /></section></main>;
}
