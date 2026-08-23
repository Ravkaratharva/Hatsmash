import { getAuthRuntimeConfig } from "../../../../lib/auth/config";
import { jsonNoStore } from "../../../../lib/auth/http";

export async function GET() {
  try {
    const { turnstileSiteKey } = getAuthRuntimeConfig();
    return jsonNoStore({ configured: true, turnstileSiteKey });
  } catch {
    return jsonNoStore({ configured: false, turnstileSiteKey: null });
  }
}
