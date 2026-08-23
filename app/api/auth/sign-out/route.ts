import { AuthConfigurationError } from "../../../../lib/auth/config";
import { logAuthSecurityEvent } from "../../../../lib/auth/audit";
import { jsonNoStore, requireSameOriginAndCsrf } from "../../../../lib/auth/http";
import { safeInternalReturnPath } from "../../../../lib/auth/redirects";
import { createSupabaseRequestClient } from "../../../../lib/auth/supabase-server";

export async function POST(request: Request) {
  const rejected = requireSameOriginAndCsrf(request);
  if (rejected) return rejected;

  let returnTo: unknown = "/";
  try {
    const text = await request.text();
    if (text.length > 2_048) throw new Error("body_too_large");
    returnTo = (JSON.parse(text) as { returnTo?: unknown }).returnTo;
  } catch {
    return jsonNoStore({ error: { code: "INVALID_INPUT", message: "That request could not be verified." } }, { status: 400 });
  }

  try {
    const { supabase, commit } = createSupabaseRequestClient(request);
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) {
      logAuthSecurityEvent("auth_signout_failed", { code: error.code, status: error.status });
      return commit(jsonNoStore({ error: { code: "SIGN_OUT_FAILED", message: "We could not sign you out. Please try again." } }, { status: 503 }));
    }
    return commit(jsonNoStore({ ok: true, returnTo: safeInternalReturnPath(returnTo, "/") }));
  } catch (error) {
    if (!(error instanceof AuthConfigurationError)) throw error;
    logAuthSecurityEvent("auth_configuration_missing");
    return jsonNoStore({ error: { code: "AUTH_UNAVAILABLE", message: "Secure sign-out is temporarily unavailable." } }, { status: 503 });
  }
}
