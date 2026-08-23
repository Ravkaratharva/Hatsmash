"use client";

import { useState } from "react";
import { signOut } from "./auth-client";

export function SignOutButton({ className = "account-signout", returnTo = "/" }: { className?: string; returnTo?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSignOut() {
    setLoading(true);
    setError("");
    try {
      window.location.assign(await signOut(returnTo));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We could not sign you out.");
      setLoading(false);
    }
  }

  return (
    <>
      <button className={className} type="button" onClick={handleSignOut} disabled={loading}>
        {loading ? "Signing out…" : "Sign out"}
      </button>
      {error && <p className="account-action-error" role="alert">{error}</p>}
    </>
  );
}
