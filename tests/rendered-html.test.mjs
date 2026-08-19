import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Hatsmash scan experience", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Hatsmash — Find what your AI builder missed<\/title>/i);
  assert.match(html, /Paste your URL/);
  assert.match(html, /Fix what AI missed/);
  assert.match(html, /Scan this site/);
  assert.match(html, /Three free scans per day\./);
  assert.doesNotMatch(html, /pricing|unlock all fix-prompts|scan history/i);
  assert.doesNotMatch(html, /codex-preview|SkeletonPreview|TestPilot|site-creator/i);
});
