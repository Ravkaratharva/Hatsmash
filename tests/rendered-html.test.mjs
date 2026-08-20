import assert from "node:assert/strict";
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

test("landing navigation only opens pricing in a new tab", async () => {
  const html = await htmlFor("/");
  assert.match(html, /<title>Hatsmash — Find what your AI builder missed<\/title>/i);
  assert.match(html, /Your site looks done/);
  assert.match(html, /href="\/app"[^>]*>Smash It/i);
  assert.match(html, /href="\/pricing"(?=[^>]*target="_blank")/i);
  for (const route of ["community", "login", "signup", "app"]) {
    const link = html.match(new RegExp(`<a[^>]*href="/${route}"[^>]*>`, "i"));
    assert.ok(link, `/${route} link should exist`);
    assert.doesNotMatch(link[0], /target="_blank"/i);
  }
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|TestPilot|site-creator/i);
});

test("scan experience remains available at /app", async () => {
  const html = await htmlFor("/app");
  assert.match(html, /<title>Run a Scan — Hatsmash<\/title>/i);
  assert.match(html, /Paste your URL/);
  assert.match(html, /Scan this site/);
  assert.match(html, /Three free scans per day\./);
  assert.doesNotMatch(html, /og\.png/i);
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
