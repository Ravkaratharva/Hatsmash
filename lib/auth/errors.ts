export type PublicAuthError = {
  status: number;
  code: string;
  message: string;
};

type ProviderError = { code?: string; status?: number } | null | undefined;

function isRateLimit(error: ProviderError): boolean {
  return error?.status === 429 || error?.code?.includes("rate_limit") === true;
}

export function requestOtpPublicError(error: ProviderError): PublicAuthError {
  if (isRateLimit(error)) {
    return { status: 429, code: "AUTH_RATE_LIMITED", message: "Too many attempts. Wait a moment before trying again." };
  }
  return { status: 503, code: "AUTH_UNAVAILABLE", message: "We could not send a code right now. Please try again shortly." };
}

export function verifyOtpPublicError(error: ProviderError): PublicAuthError {
  if (isRateLimit(error)) {
    return { status: 429, code: "AUTH_RATE_LIMITED", message: "Too many attempts. Wait a moment before trying again." };
  }
  if (error?.status === 400 || error?.status === 403 || error?.status === 422 || error?.code === "otp_expired") {
    return { status: 400, code: "OTP_INVALID_OR_EXPIRED", message: "That code is invalid or expired. Request a new code and try again." };
  }
  return { status: 503, code: "AUTH_UNAVAILABLE", message: "We could not verify that code right now. Please try again shortly." };
}
