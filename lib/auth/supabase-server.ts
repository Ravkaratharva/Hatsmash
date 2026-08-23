import "server-only";
import { createServerClient, parseCookieHeader, serializeCookieHeader, type CookieOptions } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { cookies, headers } from "next/headers";
import { getAuthRuntimeConfig } from "./config";

type PendingCookie = { name: string; value: string; options: CookieOptions };

function hardenedCookieOptions(options: CookieOptions, secure: boolean): CookieOptions {
  return {
    ...options,
    domain: undefined,
    path: "/",
    sameSite: "lax",
    secure,
    httpOnly: true,
    priority: "high",
  };
}

export function createSupabaseRequestClient(request: Request) {
  const { supabaseUrl, supabasePublishableKey } = getAuthRuntimeConfig();
  const secure = new URL(request.url).protocol === "https:";
  const pendingCookies: PendingCookie[] = [];
  const pendingHeaders = new Headers();

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookieOptions: { path: "/", sameSite: "lax", secure, httpOnly: true, priority: "high" },
    cookies: {
      encode: "tokens-only",
      getAll() {
        return parseCookieHeader(request.headers.get("cookie") ?? "");
      },
      setAll(cookiesToSet, cacheHeaders) {
        pendingCookies.push(...cookiesToSet);
        Object.entries(cacheHeaders).forEach(([name, value]) => pendingHeaders.set(name, value));
      },
    },
  });

  function commit(response: Response): Response {
    response.headers.set("cache-control", pendingHeaders.get("cache-control") ?? "private, no-store, max-age=0");
    response.headers.set("pragma", pendingHeaders.get("pragma") ?? "no-cache");
    if (pendingHeaders.has("expires")) response.headers.set("expires", pendingHeaders.get("expires")!);
    for (const cookie of pendingCookies) {
      response.headers.append(
        "set-cookie",
        serializeCookieHeader(cookie.name, cookie.value, hardenedCookieOptions(cookie.options, secure)),
      );
    }
    return response;
  }

  return { supabase, commit };
}

export async function createSupabaseServerComponentClient() {
  const { supabaseUrl, supabasePublishableKey } = getAuthRuntimeConfig();
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const secure = requestHeaders.get("x-forwarded-proto") !== "http"
    && !requestHeaders.get("host")?.startsWith("localhost");

  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookieOptions: { path: "/", sameSite: "lax", secure, httpOnly: true, priority: "high" },
    cookies: {
      encode: "tokens-only",
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, hardenedCookieOptions(options, secure));
          });
        } catch {
          // The proxy refreshes protected-route sessions before rendering.
        }
      },
    },
  });
}

export type PublicAccount = {
  email: string;
  displayName: string;
};

export function publicAccountFromVerifiedUser(user: User | null): PublicAccount | null {
  if (!user?.email || !user.email_confirmed_at) return null;
  const email = user.email.toLowerCase();
  const localPart = email.split("@")[0] ?? "Hatsmash user";
  const displayName = localPart.replace(/[._-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  return { email, displayName: displayName || "Hatsmash user" };
}
