import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { requestOtpPublicError, verifyOtpPublicError } from "../lib/auth/errors.ts";
import { authPagePath, safeInternalReturnPath } from "../lib/auth/redirects.ts";

test("return paths accept only approved internal Hatsmash destinations", () => {
  for (const value of ["https://evil.example", "//evil.example", "/\\evil", "/admin", "/account/other", "javascript:alert(1)"]) {
    assert.equal(safeInternalReturnPath(value), "/account");
  }
  assert.equal(safeInternalReturnPath("/pricing?from=account#plans"), "/pricing?from=account#plans");
  assert.equal(authPagePath("login", "/app"), "/login?returnTo=%2Fapp");
});

test("public auth errors handle expired codes and resist account enumeration", () => {
  const absent = requestOtpPublicError({ status: 400, code: "user_not_found" });
  const existing = requestOtpPublicError({ status: 400, code: "user_already_exists" });
  assert.deepEqual(absent, existing);
  assert.equal(verifyOtpPublicError({ status: 403, code: "otp_expired" }).code, "OTP_INVALID_OR_EXPIRED");
  assert.match(verifyOtpPublicError({ status: 400 }).message, /invalid or expired/i);
});

test("an unauthenticated account request is redirected to login with a safe return path", async () => {
  const workerUrl = new URL(`../dist/server/index.js?auth-test=${Date.now()}`, import.meta.url);
  const { default: worker } = await import(workerUrl.href);
  const response = await worker.fetch(
    new Request("http://localhost:3000/account", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  assert.equal(response.status, 307);
  assert.match(response.headers.get("location") ?? "", /^\/login\?returnTo=%2Faccount/);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.match(response.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
});

test("signed-in navigation and sign-out rely on the server session endpoint", async () => {
  const nav = await readFile(new URL("../app/_components/SiteNav.tsx", import.meta.url), "utf8");
  const session = await readFile(new URL("../app/api/auth/session/route.ts", import.meta.url), "utf8");
  const signOut = await readFile(new URL("../app/api/auth/sign-out/route.ts", import.meta.url), "utf8");
  assert.match(nav, /api\/auth\/session/);
  assert.match(nav, /account \? \(/);
  assert.match(session, /auth\.getUser\(\)/);
  assert.match(signOut, /requireSameOriginAndCsrf/);
  assert.match(signOut, /signOut\(\{ scope: "local" \}\)/);
});

async function allFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? allFiles(fullPath) : [fullPath];
  }));
  return nested.flat();
}

test("client bundles contain no server credentials or session secrets", async () => {
  const files = (await allFiles(path.resolve("dist/client"))).filter((file) => /\.(?:js|json|html)$/i.test(file));
  const contents = (await Promise.all(files.map((file) => readFile(file, "utf8")))).join("\n");
  assert.doesNotMatch(contents, /sb_secret_|service[_-]?role|SUPABASE_SERVICE_ROLE|AUTH_RATE_LIMIT_SALT|SUPABASE_PUBLISHABLE_KEY|SUPABASE_URL/i);
  assert.doesNotMatch(contents, /rediss:\/\/default:/i);
});

test("Cloudflare frontend code never imports the TCP Postgres connection", async () => {
  const files = (await allFiles(path.resolve("app"))).filter((file) => /\.(?:ts|tsx)$/i.test(file));
  const contents = (await Promise.all(files.map((file) => readFile(file, "utf8")))).join("\n");

  assert.doesNotMatch(contents, /drizzle-orm\/postgres-js|from ["']postgres["']|DATABASE_URL|db\/schema/i);
  assert.doesNotMatch(contents, /SUPABASE_SERVICE_ROLE_KEY|VITE_SUPABASE_SERVICE_ROLE/i);
});
