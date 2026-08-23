import "server-only";

type AuthAuditEvent =
  | "auth_configuration_missing"
  | "auth_origin_rejected"
  | "auth_csrf_rejected"
  | "auth_rate_limited"
  | "auth_rate_limit_unavailable"
  | "auth_captcha_failed"
  | "auth_otp_request_failed"
  | "auth_otp_verify_failed"
  | "auth_signout_failed";

function safeCode(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
  return normalized || undefined;
}

export function logAuthSecurityEvent(
  event: AuthAuditEvent,
  details: { code?: unknown; status?: number } = {},
): void {
  console.warn(JSON.stringify({
    area: "product_auth",
    event,
    code: safeCode(details.code),
    status: details.status,
    requestId: crypto.randomUUID(),
  }));
}
