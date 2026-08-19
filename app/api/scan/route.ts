const MOCK_FINDINGS = [
  {
    id: "a11y-alt-hero",
    category: "Accessibility",
    severity: "critical",
    title: "Hero image has no alt text",
    evidence: "The largest above-the-fold image is announced only as “image”.",
  },
  {
    id: "perf-lcp-image",
    category: "Performance",
    severity: "warning",
    title: "Largest image ships at 2.8 MB",
    evidence: "Estimated mobile LCP is 4.1 seconds on a mid-range connection.",
  },
  {
    id: "seo-long-title",
    category: "SEO",
    severity: "warning",
    title: "Page title is too long",
    evidence: "The 74-character title will likely be truncated in search results.",
  },
  {
    id: "ai-placeholder-copy",
    category: "AI-tell",
    severity: "info",
    title: "Placeholder copy is still visible",
    evidence: "“Lorem ipsum” appears once in the FAQ accordion.",
  },
  {
    id: "security-client-key",
    category: "Security",
    severity: "critical",
    title: "Credential-like value found in client code",
    evidence: "A public JavaScript bundle contains a value prefixed with sk_live_.",
  },
] as const;

export async function POST(request: Request) {
  let body: { url?: string };
  try {
    body = await request.json() as { url?: string };
  } catch {
    return Response.json({ error: "The scan request was not valid." }, { status: 400 });
  }

  if (!body.url) {
    return Response.json({ error: "Paste a website URL to start the scan." }, { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(body.url);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("unsupported protocol");
  } catch {
    return Response.json({ error: "Enter a valid public website URL." }, { status: 400 });
  }

  await new Promise((resolve) => setTimeout(resolve, 1650));

  if (parsed.hostname === "fail.test" || parsed.hostname.includes("unreachable")) {
    return Response.json(
      { error: "We couldn’t reach that site. It may be private, offline, or blocking automated visits." },
      { status: 502 },
    );
  }

  return Response.json({
    url: parsed.toString(),
    score: 68,
    scannedAt: new Date().toISOString(),
    findings: MOCK_FINDINGS,
  });
}
