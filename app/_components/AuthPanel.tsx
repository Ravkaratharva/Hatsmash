"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { authPagePath } from "../../lib/auth/redirects";
import { getCsrfToken, readAuthJson } from "./auth-client";

declare global {
  interface Window {
    turnstile?: {
      render(container: HTMLElement, options: Record<string, unknown>): string;
      reset(widgetId: string): void;
      remove(widgetId: string): void;
    };
  }
}

type Notice = { kind: "error" | "success" | "info"; text: string } | null;

export function AuthPanel({ mode, returnTo = "/account" }: { mode: "login" | "signup"; returnTo?: string }) {
  const [email, setEmail] = useState("");
  const [stage, setStage] = useState<"email" | "otp" | "success">("email");
  const [otp, setOtp] = useState("");
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [siteKey, setSiteKey] = useState("");
  const [captchaToken, setCaptchaToken] = useState("");
  const turnstileContainer = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const isLogin = mode === "login";

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/config", { credentials: "same-origin", cache: "no-store" })
      .then((response) => readAuthJson<{ configured?: boolean; turnstileSiteKey?: string | null }>(response))
      .then((data) => {
        if (cancelled) return;
        setConfigured(data.configured === true);
        setSiteKey(data.turnstileSiteKey ?? "");
        if (!data.configured) setNotice({ kind: "error", text: "Secure account access is being configured. Anonymous scans are still available." });
      })
      .catch(() => {
        if (!cancelled) {
          setConfigured(false);
          setNotice({ kind: "error", text: "Secure account access is temporarily unavailable. Anonymous scans are still available." });
        }
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!siteKey || stage !== "email" || !turnstileContainer.current) return;
    let cancelled = false;

    const renderWidget = () => {
      if (cancelled || !turnstileContainer.current || !window.turnstile || widgetId.current) return;
      widgetId.current = window.turnstile.render(turnstileContainer.current, {
        sitekey: siteKey,
        theme: "dark",
        size: "flexible",
        action: "hatsmash_auth",
        callback: (token: string) => setCaptchaToken(token),
        "expired-callback": () => {
          setCaptchaToken("");
          setNotice({ kind: "info", text: "The security check expired. Complete it again to continue." });
        },
        "error-callback": () => {
          setCaptchaToken("");
          setNotice({ kind: "error", text: "The security check could not load. Refresh the page and try again." });
        },
      });
    };

    const existing = document.querySelector<HTMLScriptElement>('script[data-hatsmash-turnstile="true"]');
    if (window.turnstile) renderWidget();
    else if (existing) existing.addEventListener("load", renderWidget, { once: true });
    else {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.dataset.hatsmashTurnstile = "true";
      script.addEventListener("load", renderWidget, { once: true });
      document.head.appendChild(script);
    }

    return () => {
      cancelled = true;
      existing?.removeEventListener("load", renderWidget);
      if (widgetId.current && window.turnstile) window.turnstile.remove(widgetId.current);
      widgetId.current = null;
    };
  }, [siteKey, stage]);

  function resetCaptcha() {
    setCaptchaToken("");
    if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current);
  }

  async function handleEmailSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!captchaToken) {
      setNotice({ kind: "error", text: "Complete the security check before continuing." });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const csrf = await getCsrfToken();
      const response = await fetch("/api/auth/request-otp", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { accept: "application/json", "content-type": "application/json", "x-hatsmash-csrf": csrf },
        body: JSON.stringify({ email, mode, returnTo, captchaToken }),
      });
      const data = await readAuthJson<{ message?: string }>(response);
      if (!response.ok) throw new Error(data.error?.message ?? "We could not send a code right now.");
      setStage("otp");
      setNotice({ kind: "success", text: data.message ?? "Check your email for a six-digit code." });
    } catch (reason) {
      setNotice({ kind: "error", text: reason instanceof Error ? reason.message : "We could not send a code right now." });
      resetCaptcha();
    } finally {
      setBusy(false);
    }
  }

  async function handleOtpSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice(null);
    try {
      const csrf = await getCsrfToken();
      const response = await fetch("/api/auth/verify-otp", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { accept: "application/json", "content-type": "application/json", "x-hatsmash-csrf": csrf },
        body: JSON.stringify({ email, token: otp, returnTo }),
      });
      const data = await readAuthJson<{ returnTo?: string }>(response);
      if (!response.ok || !data.returnTo) throw new Error(data.error?.message ?? "That code is invalid or expired.");
      setStage("success");
      setNotice({ kind: "success", text: "Email verified. Opening your Hatsmash account…" });
      window.location.assign(data.returnTo);
    } catch (reason) {
      setNotice({ kind: "error", text: reason instanceof Error ? reason.message : "That code is invalid or expired." });
      setBusy(false);
    }
  }

  return (
    <div className="auth-panel">
      <p className="marketing-eyebrow"><span>{isLogin ? "WELCOME BACK" : "START HERE"}</span> Hatsmash account</p>
      <h1>{isLogin ? "Log in and keep smashing." : "Create your Hatsmash account."}</h1>
      <p className="auth-intro">
        {isLogin ? "Enter your email" : "Enter your email to create your account."} We will send a secure, one-time verification code. No password required.
      </p>

      {stage === "email" && (
        <form onSubmit={handleEmailSubmit}>
          <label htmlFor={`${mode}-email`}>
            Email
            <input id={`${mode}-email`} type="email" name="email" autoComplete="email" inputMode="email" placeholder="you@company.com" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} required disabled={busy} />
          </label>
          <div className="turnstile-shell" ref={turnstileContainer} aria-label="Security verification" />
          <button className="auth-submit" type="submit" disabled={busy || configured !== true || !captchaToken}>
            {busy ? "Sending secure code…" : isLogin ? "Email me a code" : "Create account with email"} <span aria-hidden="true">→</span>
          </button>
        </form>
      )}

      {(stage === "otp" || stage === "success") && (
        <form onSubmit={handleOtpSubmit}>
          <p className="otp-destination">Code sent to <strong>{email}</strong></p>
          <label htmlFor={`${mode}-otp`}>
            Six-digit verification code
            <input id={`${mode}-otp`} className="otp-input" type="text" name="otp" autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} placeholder="000000" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} required disabled={busy || stage === "success"} aria-describedby="otp-help" />
          </label>
          <p className="auth-helper" id="otp-help">The code expires shortly and can only be used once.</p>
          <button className="auth-submit" type="submit" disabled={busy || otp.length !== 6 || stage === "success"}>
            {busy || stage === "success" ? "Verifying…" : "Verify and continue"} <span aria-hidden="true">→</span>
          </button>
          <button className="auth-secondary" type="button" disabled={busy || stage === "success"} onClick={() => { setStage("email"); setOtp(""); setNotice(null); }}>
            Use a different email or request a new code
          </button>
        </form>
      )}

      {notice && <p className={`auth-notice is-${notice.kind}`} role={notice.kind === "error" ? "alert" : "status"} aria-live="polite">{notice.text}</p>}
      <p className="auth-privacy">Hatsmash never stores a password. Verification is handled by Supabase Auth, and anonymous website scans remain available.</p>
      <p className="auth-switch">
        {isLogin ? "New to Hatsmash?" : "Already have an account?"}{" "}
        <a href={authPagePath(isLogin ? "signup" : "login", returnTo)}>{isLogin ? "Sign up" : "Log in"}</a>
      </p>
    </div>
  );
}
