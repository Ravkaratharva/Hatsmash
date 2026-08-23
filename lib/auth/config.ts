import "server-only";

export const PRODUCTION_SITE_ORIGIN = "https://hatsmash-audit.ravkaratharva01.chatgpt.site";

const APPROVED_AUTH_ORIGINS = new Set([
  PRODUCTION_SITE_ORIGIN,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

export class AuthConfigurationError extends Error {
  constructor(message = "Hatsmash authentication is not configured.") {
    super(message);
    this.name = "AuthConfigurationError";
  }
}

export type AuthRuntimeConfig = {
  supabaseUrl: string;
  supabasePublishableKey: string;
  turnstileSiteKey: string;
  rateLimitSalt: string;
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new AuthConfigurationError();
  return value;
}

function validateSupabaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new AuthConfigurationError();
  }
  if (url.protocol !== "https:" || !url.hostname.endsWith(".supabase.co") || url.pathname !== "/") {
    throw new AuthConfigurationError();
  }
  return url.origin;
}

export function getAuthRuntimeConfig(): AuthRuntimeConfig {
  const supabasePublishableKey = required("SUPABASE_PUBLISHABLE_KEY");
  const rateLimitSalt = required("AUTH_RATE_LIMIT_SALT");

  if (!supabasePublishableKey.startsWith("sb_publishable_") || rateLimitSalt.length < 32) {
    throw new AuthConfigurationError();
  }

  return {
    supabaseUrl: validateSupabaseUrl(required("SUPABASE_URL")),
    supabasePublishableKey,
    turnstileSiteKey: required("TURNSTILE_SITE_KEY"),
    rateLimitSalt,
  };
}

export function isAuthConfigured(): boolean {
  try {
    getAuthRuntimeConfig();
    return true;
  } catch {
    return false;
  }
}

export function approvedOriginFromRequest(request: Request): string | null {
  const origin = new URL(request.url).origin;
  return APPROVED_AUTH_ORIGINS.has(origin) ? origin : null;
}

export function isApprovedAuthHostname(hostname: string): boolean {
  for (const origin of APPROVED_AUTH_ORIGINS) {
    if (new URL(origin).hostname === hostname) return true;
  }
  return false;
}
