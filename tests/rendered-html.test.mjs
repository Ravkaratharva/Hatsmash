import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${path}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

async function htmlFor(path) {
  const response = await render(path);
  assert.equal(response.status, 200, `${path} should render successfully`);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  return response.text();
}

test("all internal landing navigation stays in the current tab", async () => {
  const html = await htmlFor("/");
  assert.match(html, /<title>Hatsmash — Find what your AI builder missed<\/title>/i);
  assert.match(html, /Your site looks done/);
  assert.match(html, /href="\/app"[^>]*>Smash It/i);
  for (const route of ["pricing", "community", "login", "signup", "app"]) {
    const link = html.match(new RegExp(`<a[^>]*href="/${route}"[^>]*>`, "i"));
    assert.ok(link, `/${route} link should exist`);
    assert.doesNotMatch(link[0], /target="_blank"/i);
  }
  assert.doesNotMatch(html, /target="_blank"/i);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|TestPilot|site-creator/i);
});

test("internal navigation uses native links so deployed clicks cannot be intercepted", async () => {
  const files = [
    "app/_components/SiteNav.tsx",
    "app/_components/AuthPanel.tsx",
    "app/page.tsx",
    "app/community/page.tsx",
    "app/pricing/page.tsx",
  ];

  for (const file of files) {
    const source = await readFile(new URL(`../${file}`, import.meta.url), "utf8");
    assert.doesNotMatch(source, /from ["']next\/link["']/);
  }
});

test("scan experience remains available at /app", async () => {
  const html = await htmlFor("/app");
  assert.match(html, /<title>Run a Scan — Hatsmash<\/title>/i);
  assert.match(html, /Website analysis/);
  assert.match(html, /Paste your URL/);
  assert.match(html, /Scan website/);
  assert.match(html, /Three free scans per day\./);
  assert.match(html, /Connect GitHub/);
  assert.match(html, /Unlock GitHub connection/);
  assert.match(html, /href="\/pricing"/);
  assert.match(html, /Switch to light mode/);
  assert.match(html, /DEMO FINDINGS/);
  assert.match(html, /Page title is 74 characters/);
  assert.match(html, /Hero image has no alt text/);
  assert.match(html, /Placeholder copy is still visible/);
  assert.doesNotMatch(html, /Waiting for a URL/);
  assert.doesNotMatch(html, /INSPECTING DOM|site-preview|annotation-slot/);
  assert.doesNotMatch(html, /og\.png/i);
});

test("demo findings stop at submission and the live scan streams real findings", async () => {
  const pageSource = await readFile(new URL("../app/app/page.tsx", import.meta.url), "utf8");
  const routeSource = await readFile(new URL("../app/api/scan/route.ts", import.meta.url), "utf8");
  const schemaSource = await readFile(new URL("../lib/scan-schema.ts", import.meta.url), "utf8");
  const pipelineSource = await readFile(new URL("../services/scanner/pipeline.ts", import.meta.url), "utf8");
  assert.match(pageSource, /api\/scan-status/);
  assert.match(pageSource, /Generating tool-specific fix prompts/);
  assert.match(pageSource, /state === "idle"[\s\S]*demoFindings\.slice/);
  assert.match(pageSource, /current\.liveFindings/);
  assert.match(pageSource, /aria-label="Filter findings by category"/);
  assert.doesNotMatch(routeSource, /MOCK_FINDINGS|setTimeout\(resolve/);
  assert.match(schemaSource, /scanIssueSchema/);
  assert.match(schemaSource, /liveFindings: z\.array\(scanIssueBaseSchema\)\.optional/);
  assert.match(schemaSource, /Lovable.*Cursor.*Bolt.*v0.*Replit Agent/s);
  assert.match(pipelineSource, /liveFindings: preliminaryIssues/);
  assert.match(pipelineSource, /liveFindings: baseIssues/);
});

test("secondary routes render their own content and metadata", async () => {
  const routes = [
    ["/pricing", "Pricing — Hatsmash", "Free catches the issue"],
    ["/community", "Community — Hatsmash", "most smashable sites"],
    ["/login", "Log In — Hatsmash", "Log in and keep smashing"],
    ["/signup", "Sign Up — Hatsmash", "Save the sites you smash"],
  ];

  for (const [path, title, content] of routes) {
    const html = await htmlFor(path);
    assert.match(html, new RegExp(`<title>${title}<\\/title>`, "i"));
    assert.match(html, new RegExp(content, "i"));
    assert.doesNotMatch(html, /og\.png/i);
  }
});
