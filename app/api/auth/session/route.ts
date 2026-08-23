import { AuthConfigurationError } from "../../../../lib/auth/config";
import { jsonNoStore } from "../../../../lib/auth/http";
import { createSupabaseRequestClient, publicAccountFromVerifiedUser } from "../../../../lib/auth/supabase-server";

export async function GET(request: Request) {
  try {
    const { supabase, commit } = createSupabaseRequestClient(request);
    const { data, error } = await supabase.auth.getUser();
    const account = error ? null : publicAccountFromVerifiedUser(data.user);
    if (!account && data.user) await supabase.auth.signOut({ scope: "local" });
    return commit(jsonNoStore({ configured: true, account }));
  } catch (error) {
    if (!(error instanceof AuthConfigurationError)) throw error;
    return jsonNoStore({ configured: false, account: null });
  }
}
