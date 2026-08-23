import { AuthConfigurationError, getAuthRuntimeConfig } from "../../../../lib/auth/config";
import { logAuthSecurityEvent } from "../../../../lib/auth/audit";
import { requestOtpPublicError } from "../../../../lib/auth/errors";
import { clientIp, jsonNoStore, requireSameOriginAndCsrf } from "../../../../lib/auth/http";
import { AuthRateLimitUnavailableError, consumeAuthRateLimit } from "../../../../lib/auth/rate-limit";
import { safeInternalReturnPath } from "../../../../lib/auth/redirects";
import { createSupabaseRequestClient } from "../../../../lib/auth/supabase-server";
import { requestOtpSchema } from "../../../../lib/auth/validation";

async function parseBody(request: Request): Promise<unknown> {
  const text = await request.text();
  if (text.length > 4_096) throw new Error("body_too_large");
  return JSON.parse(text);
}

function rateLimited(retryAfter: number): Response {
  logAuthSecurityEvent("auth_rate_limited");
  return jsonNoStore(
    { error: { code: "AUTH_RATE_LIMITED", message: "Too many attempts. Wait a moment before trying again." } },
    { status: 429, headers: { "retry-after": String(retryAfter) } },
  );
}

export async function POST(request: Request) {
  const rejected = requireSameOriginAndCsrf(request);
  if (rejected) return rejected;

  let parsed;
  try {
    parsed = requestOtpSchema.safeParse(await parseBody(request));
  } catch {
    parsed = { success: false } as const;
  }
  if (!parsed.success) {
    return jsonNoStore({ error: { code: "INVALID_INPUT", message: "Enter a valid email address and complete the security check." } }, { status: 400 });
  }

  try {
    getAuthRuntimeConfig();
    const ip = clientIp(request);
    const [ipLimit, emailLimit] = await Promise.all([
      consumeAuthRateLimit({ action: "request_otp_ip", scope: `ip:${ip}`, limit: 8, windowSeconds: 15 * 60 }),
      consumeAuthRateLimit({ action: "request_otp_email", scope: `email:${parsed.data.email}`, limit: 3, windowSeconds: 15 * 60 }),
    ]);
    if (!ipLimit.allowed || !emailLimit.allowed) return rateLimited(Math.max(ipLimit.retryAfter, emailLimit.retryAfter));

    const { supabase, commit } = createSupabaseRequestClient(request);
    const { error } = await supabase.auth.signInWithOtp({
      email: parsed.data.email,
      options: {
        shouldCreateUser: true,
        captchaToken: parsed.data.captchaToken,
      },
    });

    if (error) {
      logAuthSecurityEvent("auth_otp_request_failed", { code: error.code, status: error.status });
      const publicError = requestOtpPublicError(error);
      return commit(jsonNoStore({ error: publicError }, { status: publicError.status }));
    }

    return commit(jsonNoStore({
      ok: true,
      returnTo: safeInternalReturnPath(parsed.data.returnTo),
      message: "If the address can receive Hatsmash email, a six-digit code is on its way.",
    }));
  } catch (error) {
    if (error instanceof AuthRateLimitUnavailableError) {
      logAuthSecurityEvent("auth_rate_limit_unavailable");
    } else if (error instanceof AuthConfigurationError) {
      logAuthSecurityEvent("auth_configuration_missing");
    } else {
      throw error;
    }
    return jsonNoStore({ error: { code: "AUTH_UNAVAILABLE", message: "Secure sign-in is temporarily unavailable. Please try again later." } }, { status: 503 });
  }
}
