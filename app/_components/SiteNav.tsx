"use client";

import { useEffect, useState } from "react";
import { ThemeToggle } from "./ThemeToggle";

export function SiteNav({ current = "" }: { current?: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const close = () => setOpen(false);
    window.addEventListener("resize", close);
    return () => window.removeEventListener("resize", close);
  }, []);

  return (
    <header className="marketing-nav">
      <a className="marketing-logo" href="/" aria-label="Hatsmash home">
        <img src="/hatsmash-logo.png" width="378" height="153" alt="Hatsmash" />
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
        <a href="/login">Log In</a>
        <a className="signup-link" href="/signup">Sign Up</a>
        <ThemeToggle compact />
        <a className="smash-nav-cta" href="/app">Smash It <span aria-hidden="true">→</span></a>
      </nav>
    </header>
  );
}
