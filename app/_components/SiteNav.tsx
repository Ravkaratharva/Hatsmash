"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { readAuthJson } from "./auth-client";
import { SignOutButton } from "./SignOutButton";
import { ThemeToggle } from "./ThemeToggle";

export function SiteNav({ current = "" }: { current?: string }) {
  const [open, setOpen] = useState(false);
  const [account, setAccount] = useState<{ email: string; displayName: string } | null>(null);

  useEffect(() => {
    const close = () => setOpen(false);
    window.addEventListener("resize", close);
    return () => window.removeEventListener("resize", close);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/auth/session", {
      credentials: "same-origin",
      cache: "no-store",
      headers: { accept: "application/json" },
      signal: controller.signal,
    })
      .then((response) => readAuthJson<{ account?: { email: string; displayName: string } | null }>(response))
      .then((data) => setAccount(data.account ?? null))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  return (
    <header className="marketing-nav">
      <a className="marketing-logo" href="/" aria-label="Hatsmash home">
        <Image src="/hatsmash-logo.png" width="378" height="153" alt="Hatsmash" priority unoptimized />
      </a>

      <button
        className="menu-toggle"
        type="button"
        aria-label={open ? "Close navigation" : "Open navigation"}
        aria-expanded={open}
        aria-controls="primary-navigation"
        onClick={() => setOpen((value) => !value)}
      >
        <span /><span /><span />
      </button>

      <nav className={open ? "nav-links is-open" : "nav-links"} id="primary-navigation" aria-label="Primary navigation">
        <a className={current === "home" ? "active" : ""} href="/">Home</a>
        <a
          className={current === "pricing" ? "active" : ""}
          href="/pricing"
        >
          Pricing
        </a>
        <a className={current === "community" ? "active" : ""} href="/community">Community</a>
        <span className="nav-divider" aria-hidden="true" />
        {account ? (
          <details className="account-menu">
            <summary aria-label={`Account menu for ${account.email}`}>
              <span aria-hidden="true">{account.displayName.charAt(0).toUpperCase()}</span>
              <b>Account</b>
            </summary>
            <div className="account-menu-popover">
              <small>Signed in as</small>
              <strong>{account.email}</strong>
              <a href="/account">View account</a>
              <SignOutButton className="nav-signout" />
            </div>
          </details>
        ) : (
          <>
            <a href="/login">Log In</a>
            <a className="signup-link" href="/signup">Sign Up</a>
          </>
        )}
        <ThemeToggle compact />
        <a className={current === "app" ? "smash-nav-cta active" : "smash-nav-cta"} href="/app">Start audit <span aria-hidden="true">→</span></a>
      </nav>
    </header>
  );
}
