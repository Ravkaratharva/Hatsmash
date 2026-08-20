"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function SiteNav({ current = "" }: { current?: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const close = () => setOpen(false);
    window.addEventListener("resize", close);
    return () => window.removeEventListener("resize", close);
  }, []);

  return (
    <header className="marketing-nav">
      <Link className="marketing-logo" href="/" aria-label="Hatsmash home">
        <img src="/hatsmash-logo.png" width="378" height="153" alt="Hatsmash" />
      </Link>

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
        <Link className={current === "home" ? "active" : ""} href="/">Home</Link>
        <Link
          className={current === "pricing" ? "active" : ""}
          href="/pricing"
          target="_blank"
          rel="noopener noreferrer"
        >
          Pricing
        </Link>
        <Link className={current === "community" ? "active" : ""} href="/community">Community</Link>
        <span className="nav-divider" aria-hidden="true" />
        <Link href="/login">Log In</Link>
        <Link className="signup-link" href="/signup">Sign Up</Link>
        <Link className="smash-nav-cta" href="/app">Smash It <span aria-hidden="true">→</span></Link>
      </nav>
    </header>
  );
}
