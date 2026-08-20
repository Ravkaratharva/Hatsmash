"use client";

import { FormEvent, useState } from "react";

export function AuthPanel({ mode }: { mode: "login" | "signup" }) {
  const [notice, setNotice] = useState("");
  const isLogin = mode === "login";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("Authentication is not connected yet. This interface is ready for the future auth provider.");
  }

  return (
    <div className="auth-panel">
      <p className="marketing-eyebrow"><span>{isLogin ? "WELCOME BACK" : "START HERE"}</span> Hatsmash account</p>
      <h1>{isLogin ? "Log in and keep smashing." : "Save the sites you smash."}</h1>
      <p className="auth-intro">
        {isLogin
          ? "Your scan history and monitored sites will live here once accounts are enabled."
          : "Create an account interface now; saved reports and scheduled scans arrive with the auth backend."}
      </p>

      <form onSubmit={handleSubmit}>
        {!isLogin && (
          <label>
            Name
            <input type="text" name="name" autoComplete="name" placeholder="Your name" required />
          </label>
        )}
        <label>
          Email
          <input type="email" name="email" autoComplete="email" placeholder="you@company.com" required />
        </label>
        <label>
          Password
          <input type="password" name="password" autoComplete={isLogin ? "current-password" : "new-password"} placeholder="At least 8 characters" minLength={8} required />
        </label>
        {!isLogin && (
          <label>
            Confirm password
            <input type="password" name="confirmPassword" autoComplete="new-password" placeholder="Repeat your password" minLength={8} required />
          </label>
        )}
        {isLogin && <button className="forgot-button" type="button" onClick={() => setNotice("Password recovery will be connected with the authentication provider.")}>Forgot password?</button>}
        <button className="auth-submit" type="submit">{isLogin ? "Log In" : "Create Account"} <span>→</span></button>
      </form>

      {notice && <p className="auth-notice" role="status">{notice}</p>}
      <p className="auth-switch">
        {isLogin ? "New to Hatsmash?" : "Already have an account?"}{" "}
        <a href={isLogin ? "/signup" : "/login"}>{isLogin ? "Sign up" : "Log in"}</a>
      </p>
    </div>
  );
}
