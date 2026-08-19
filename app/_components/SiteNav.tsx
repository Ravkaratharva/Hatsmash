"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const externalNav = [
  { href: "/pricing", label: "Pricing" },
  { href: "/community", label: "Community" },
];

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
        {externalNav.map((item) => (
          <a
            className={current === item.label.toLowerCase() ? "active" : ""}
            href={item.href}
            target="_blank"
            rel="noopener noreferrer"
            key={item.href}
          >
            {item.label}
          </a>
        ))}
        <span className="nav-divider" aria-hidden="true" />
        <a href="/login" target="_blank" rel="noopener noreferrer">Log In</a>
        <a className="signup-link" href="/signup" target="_blank" rel="noopener noreferrer">Sign Up</a>
        <Link className="smash-nav-cta" href="/app">Smash It <span aria-hidden="true">→</span></Link>
      </nav>
    </header>
  );
}
