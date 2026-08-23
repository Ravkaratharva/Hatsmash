function scannerBaseUrl() {
  return process.env.SCANNER_SERVICE_URL?.trim().replace(/\/$/, "");
}

function clientIp(request: Request) {
  return request.headers.get("cf-connecting-ip")
    ?? request.headers.get("x-real-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? "unknown";
}

const SCANNER_TIMEOUT_MS = 20_000;
const transientScannerStatuses = new Set([502, 503, 504, 520, 521, 522, 523, 524]);

function scannerUnavailableResponse(message = "The scanner is warming up. Hatsmash will retry automatically.") {
  return Response.json(
    { error: { code: "SCANNER_WAKING", message } },
    { status: 503, headers: { "retry-after": "4", "cache-control": "no-store" } },
  );
}

function isJsonResponse(response: Response, body: string) {
  const contentType = response.headers.get("content-type") ?? "";
  const firstCharacter = body.trimStart()[0];
  return contentType.includes("application/json") || firstCharacter === "{" || firstCharacter === "[";
}

export async function forwardScannerRequest(request: Request, path: string, method: "GET" | "POST") {
  const baseUrl = scannerBaseUrl();
  if (!baseUrl) {
    return Response.json(
      { error: { code: "SCANNER_NOT_CONFIGURED", message: "The live scanner is being connected. Please try again shortly." } },
      { status: 503 },
    );
  }

  const headers = new Headers({
    accept: "application/json",
    "x-forwarded-for": clientIp(request),
  });
  if (method === "POST") headers.set("content-type", "application/json");

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: method === "POST" ? await request.text() : undefined,
      redirect: "manual",
      signal: AbortSignal.timeout(SCANNER_TIMEOUT_MS),
    });

    const body = await response.text();
    if (transientScannerStatuses.has(response.status)) {
      return scannerUnavailableResponse();
    }
    if (!isJsonResponse(response, body)) {
      return Response.json(
        {
          error: {
            code: "SCANNER_BAD_RESPONSE",
            message: response.ok
              ? "The scanner returned an incomplete response. Please try again."
              : "The scanner could not complete that request. Please try again.",
          },
        },
        { status: response.ok ? 502 : response.status, headers: { "cache-control": "no-store" } },
      );
    }

    return new Response(body, {
      status: response.status,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  } catch {
    return scannerUnavailableResponse("The scanner is taking longer than expected to wake up. Hatsmash will retry automatically.");
  }
}
