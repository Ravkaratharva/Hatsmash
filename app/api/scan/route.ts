export async function POST(request: Request) {
  const body = await request.json() as { url?: string };
  if (!body.url) return Response.json({ error: "A URL is required." }, { status: 400 });

  try {
    const parsed = new URL(body.url);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
  } catch {
    return Response.json({ error: "Enter a valid website URL." }, { status: 400 });
  }

  await new Promise((resolve) => setTimeout(resolve, 1600));
  return Response.json({ score: 72, counts: { critical: 2, attention: 7, quickWins: 11 }, status: "complete" });
}
