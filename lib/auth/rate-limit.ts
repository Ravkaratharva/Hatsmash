import "server-only";
import { env } from "cloudflare:workers";
import { getAuthRuntimeConfig } from "./config";

export class AuthRateLimitUnavailableError extends Error {
  constructor() {
    super("Authentication rate limiting is unavailable.");
    this.name = "AuthRateLimitUnavailableError";
  }
}

type RateLimitInput = {
  action: string;
  scope: string;
  limit: number;
  windowSeconds: number;
};

async function hashScope(scope: string): Promise<string> {
  const { rateLimitSalt } = getAuthRuntimeConfig();
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(rateLimitSalt),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(scope));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function consumeAuthRateLimit(input: RateLimitInput): Promise<{ allowed: boolean; retryAfter: number }> {
  if (!env.DB) throw new AuthRateLimitUnavailableError();

  const now = Math.floor(Date.now() / 1000);
  const windowStartedAt = now - (now % input.windowSeconds);
  const expiresAt = windowStartedAt + input.windowSeconds * 2;
  const keyHash = await hashScope(input.scope);

  try {
    const [, write] = await env.DB.batch([
      env.DB.prepare("DELETE FROM auth_rate_limits WHERE expires_at < ?").bind(now),
      env.DB.prepare(`
        INSERT INTO auth_rate_limits (key_hash, action, window_started_at, count, expires_at)
        VALUES (?, ?, ?, 1, ?)
        ON CONFLICT(key_hash, action) DO UPDATE SET
          count = CASE
            WHEN auth_rate_limits.window_started_at < excluded.window_started_at THEN 1
            ELSE auth_rate_limits.count + 1
          END,
          window_started_at = CASE
            WHEN auth_rate_limits.window_started_at < excluded.window_started_at THEN excluded.window_started_at
            ELSE auth_rate_limits.window_started_at
          END,
          expires_at = excluded.expires_at
        RETURNING count
      `).bind(keyHash, input.action, windowStartedAt, expiresAt),
    ]);

    const row = write.results?.[0] as { count?: number } | undefined;
    const count = Number(row?.count ?? input.limit + 1);
    return {
      allowed: count <= input.limit,
      retryAfter: Math.max(1, windowStartedAt + input.windowSeconds - now),
    };
  } catch {
    throw new AuthRateLimitUnavailableError();
  }
}
