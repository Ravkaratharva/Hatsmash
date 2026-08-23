import type { NextRequest } from "next/server";
import { updateAuthSession } from "./lib/auth/proxy";

export async function proxy(request: NextRequest) {
  return updateAuthSession(request);
}

export const config = {
  matcher: ["/account/:path*"],
};
