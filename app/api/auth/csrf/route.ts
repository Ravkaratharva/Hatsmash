import { approvedOriginFromRequest } from "../../../../lib/auth/config";
import { csrfCookieHeader, jsonNoStore, newCsrfToken } from "../../../../lib/auth/http";

export async function GET(request: Request) {
  if (!approvedOriginFromRequest(request)) {
    return jsonNoStore({ error: { code: "REQUEST_REJECTED", message: "That request could not be verified." } }, { status: 403 });
  }
  const token = newCsrfToken();
  const response = jsonNoStore({ token });
  response.headers.append("set-cookie", csrfCookieHeader(request, token));
  return response;
}
