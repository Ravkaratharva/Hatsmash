function scannerBaseUrl() {
  return process.env.SCANNER_SERVICE_URL?.trim().replace(/\/$/, "");
}

function clientIp(request: Request) {
  return request.headers.get("cf-connecting-ip")
    ?? request.headers.get("x-real-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? "unknown";
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
    });
    return new Response(response.body, {
      status: response.status,
      headers: { "content-type": response.headers.get("content-type") ?? "application/json" },
    });
  } catch {
    return Response.json(
      { error: { code: "SCANNER_UNAVAILABLE", message: "The scanner is waking up or temporarily unavailable. Wait a minute and try again." } },
      { status: 503 },
    );
  }
}
