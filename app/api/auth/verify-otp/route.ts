import { AuthConfigurationError, getAuthRuntimeConfig } from "../../../../lib/auth/config";
import { logAuthSecurityEvent } from "../../../../lib/auth/audit";
import { verifyOtpPublicError } from "../../../../lib/auth/errors";
import { clientIp, jsonNoStore, requireSameOriginAndCsrf } from "../../../../lib/auth/http";
import { AuthRateLimitUnavailableError, consumeAuthRateLimit } from "../../../../lib/auth/rate-limit";
import { safeInternalReturnPath } from "../../../../lib/auth/redirects";
import { createSupabaseRequestClient, publicAccountFromVerifiedUser } from "../../../../lib/auth/supabase-server";
import { verifyOtpSchema } from "../../../../lib/auth/validation";

export async function POST(request: Request) {
  const rejected = requireSameOriginAndCsrf(request);
  if (rejected) return rejected;

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > 4_096) throw new Error("body_too_large");
    body = JSON.parse(text);
  } catch {
    body = null;
  }
  const parsed = verifyOtpSchema.safeParse(body);
  if (!parsed.success) {
    return jsonNoStore({ error: { code: "OTP_INVALID_OR_EXPIRED", message: "Enter the six-digit code from your email." } }, { status: 400 });
  }

  try {
    getAuthRuntimeConfig();
    const ip = clientIp(request);
    const [ipLimit, emailLimit] = await Promise.all([
      consumeAuthRateLimit({ action: "verify_otp_ip", scope: `ip:${ip}`, limit: 12, windowSeconds: 15 * 60 }),
      consumeAuthRateLimit({ action: "verify_otp_email", scope: `email:${parsed.data.email}`, limit: 6, windowSeconds: 15 * 60 }),
    ]);
    if (!ipLimit.allowed || !emailLimit.allowed) {
      const retryAfter = Math.max(ipLimit.retryAfter, emailLimit.retryAfter);
      logAuthSecurityEvent("auth_rate_limited");
      return jsonNoStore(
        { error: { code: "AUTH_RATE_LIMITED", message: "Too many attempts. Wait a moment before trying again." } },
        { status: 429, headers: { "retry-after": String(retryAfter) } },
      );
    }

    const { supabase, commit } = createSupabaseRequestClient(request);
    const { data, error } = await supabase.auth.verifyOtp({
      email: parsed.data.email,
      token: parsed.data.token,
      type: "email",
    });
    const account = error ? null : publicAccountFromVerifiedUser(data.user);

    if (error || !account || account.email !== parsed.data.email) {
      if (data.session) await supabase.auth.signOut({ scope: "local" });
      logAuthSecurityEvent("auth_otp_verify_failed", { code: error?.code ?? "unverified_user", status: error?.status });
      const publicError = verifyOtpPublicError(error ?? { status: 403, code: "unverified_user" });
      return commit(jsonNoStore({ error: publicError }, { status: publicError.status }));
    }

    return commit(jsonNoStore({ ok: true, returnTo: safeInternalReturnPath(parsed.data.returnTo), user: account }));
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
