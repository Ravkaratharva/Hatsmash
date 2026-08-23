import "server-only";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authPagePath } from "./redirects";
import { getAuthRuntimeConfig, AuthConfigurationError } from "./config";
import { logAuthSecurityEvent } from "./audit";

function copyCookiesAndCacheHeaders(source: NextResponse, target: NextResponse): NextResponse {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  for (const name of ["cache-control", "expires", "pragma"]) {
    const value = source.headers.get(name);
    if (value) target.headers.set(name, value);
  }
  return target;
}

export async function updateAuthSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  response.headers.set("cache-control", "private, no-store, max-age=0");

  let config;
  try {
    config = getAuthRuntimeConfig();
  } catch (error) {
    if (!(error instanceof AuthConfigurationError)) throw error;
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?returnTo=${encodeURIComponent(request.nextUrl.pathname)}&error=auth_unavailable`;
    return NextResponse.redirect(url);
  }

  const supabase = createServerClient(config.supabaseUrl, config.supabasePublishableKey, {
    cookieOptions: {
      path: "/",
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      httpOnly: true,
      priority: "high",
    },
    cookies: {
      encode: "tokens-only",
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, cacheHeaders) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, {
          ...options,
          domain: undefined,
          path: "/",
          sameSite: "lax",
          secure: request.nextUrl.protocol === "https:",
          httpOnly: true,
          priority: "high",
        }));
        Object.entries(cacheHeaders).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });

  let claims = null;
  try {
    const { data, error } = await supabase.auth.getClaims();
    if (error) logAuthSecurityEvent("auth_otp_verify_failed", { code: error.code, status: error.status });
    claims = data?.claims ?? null;
  } catch {
    logAuthSecurityEvent("auth_otp_verify_failed", { code: "session_validation_failed" });
  }
  if (!claims) {
    const loginUrl = new URL(authPagePath("login", `${request.nextUrl.pathname}${request.nextUrl.search}`), request.url);
    return copyCookiesAndCacheHeaders(response, NextResponse.redirect(loginUrl));
  }

  response.headers.set("cache-control", "private, no-store, max-age=0");
  return response;
}
