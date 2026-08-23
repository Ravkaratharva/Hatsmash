import "server-only";
import { parseCookieHeader, serializeCookieHeader } from "@supabase/ssr";
import { approvedOriginFromRequest } from "./config";
import { logAuthSecurityEvent } from "./audit";

export const CSRF_COOKIE_NAME = "hs_csrf";

export function jsonNoStore(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "private, no-store, max-age=0");
  headers.set("pragma", "no-cache");
  return new Response(JSON.stringify(body), { ...init, headers });
}

export function newCsrfToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function csrfCookieHeader(request: Request, token: string, maxAge = 30 * 60): string {
  return serializeCookieHeader(CSRF_COOKIE_NAME, token, {
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "strict",
    path: "/",
    maxAge,
  });
}

function cookieValue(request: Request, name: string): string | null {
  const cookies = parseCookieHeader(request.headers.get("cookie") ?? "");
  return cookies.find((cookie) => cookie.name === name)?.value ?? null;
}

function constantTimeEqual(left: string, right: string): boolean {
  const size = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < size; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

export function requireSameOriginAndCsrf(request: Request): Response | null {
  const approvedOrigin = approvedOriginFromRequest(request);
  const submittedOrigin = request.headers.get("origin");
  const contentType = request.headers.get("content-type") ?? "";

  if (!approvedOrigin || submittedOrigin !== approvedOrigin || !contentType.startsWith("application/json")) {
    logAuthSecurityEvent("auth_origin_rejected");
    return jsonNoStore({ error: { code: "REQUEST_REJECTED", message: "That request could not be verified." } }, { status: 403 });
  }

  const headerToken = request.headers.get("x-hatsmash-csrf") ?? "";
  const cookieToken = cookieValue(request, CSRF_COOKIE_NAME) ?? "";
  if (headerToken.length !== 64 || !constantTimeEqual(headerToken, cookieToken)) {
    logAuthSecurityEvent("auth_csrf_rejected");
    return jsonNoStore({ error: { code: "REQUEST_REJECTED", message: "That request could not be verified." } }, { status: 403 });
  }
  return null;
}

export function clientIp(request: Request): string {
  return request.headers.get("cf-connecting-ip")
    ?? request.headers.get("x-real-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? "unknown";
}
