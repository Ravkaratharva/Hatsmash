import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignOutButton } from "../_components/SignOutButton";
import { SiteNav } from "../_components/SiteNav";
import { isAuthConfigured } from "../../lib/auth/config";
import { authPagePath } from "../../lib/auth/redirects";
import { createSupabaseServerComponentClient, publicAccountFromVerifiedUser } from "../../lib/auth/supabase-server";

export const metadata: Metadata = {
  title: "Account — Hatsmash",
  description: "Manage your verified Hatsmash account.",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  if (!isAuthConfigured()) redirect(authPagePath("login", "/account"));

  const supabase = await createSupabaseServerComponentClient();
  const { data: { user } } = await supabase.auth.getUser();
  const account = publicAccountFromVerifiedUser(user);
  if (!account) redirect(authPagePath("login", "/account"));

  return (
    <main className="marketing-page account-page">
      <SiteNav current="account" />
      <section className="account-shell" aria-labelledby="account-title">
        <div className="account-heading">
          <p className="marketing-eyebrow"><span>VERIFIED</span> Hatsmash account</p>
          <h1 id="account-title">Your account.</h1>
          <p>Manage your account details and continue improving your websites.</p>
        </div>
        <div className="account-card">
          <div className="account-avatar" aria-hidden="true">{account.displayName.charAt(0).toUpperCase()}</div>
          <div>
            <small>Display name</small>
            <strong>{account.displayName}</strong>
          </div>
          <div>
            <small>Verified email</small>
            <strong>{account.email}</strong>
          </div>
          <div className="account-security-note">
            <b>Email verified</b>
            <span>Your session is verified before account details are shown.</span>
          </div>
          <SignOutButton />
        </div>
      </section>
    </main>
  );
}
