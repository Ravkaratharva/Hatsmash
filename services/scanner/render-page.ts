import { chromium, errors as playwrightErrors, type Browser, type Page } from "playwright";
import { ScanError } from "./errors.js";
import { assertPublicUrl } from "./url-safety.js";

export type ConsoleFailure = {
  type: "error" | "pageerror";
  message: string;
  location: string;
};

export type NetworkRequest = {
  url: string;
  method: string;
  resourceType: string;
  status?: number;
  failure?: string;
};

export type ScriptBundle = {
  url: string;
  content: string;
};

export type PageRenderData = {
  finalUrl: string;
  html: string;
  consoleErrors: ConsoleFailure[];
  networkRequests: NetworkRequest[];
  screenshot: Buffer;
  responseHeaders: Record<string, string>;
  responseStatus: number;
  scriptBundles: ScriptBundle[];
};

export type PageRenderSession = PageRenderData & {
  page: Page;
  close: () => Promise<void>;
};

const MAX_SCRIPT_BYTES = 1_000_000;
const MAX_TOTAL_SCRIPT_BYTES = 5_000_000;

function looksLikeHeadlessBlock(status: number, html: string) {
  if (![401, 403, 429, 503].includes(status)) return false;
  return /captcha|verify you are human|access denied|bot detection|cloudflare|attention required|unusual traffic/i.test(html);
}

function classifyNavigationError(error: unknown): ScanError {
  if (error instanceof playwrightErrors.TimeoutError) {
    return new ScanError("PAGE_TIMEOUT", "That page took longer than 15 seconds to respond.", 408);
  }

  const message = error instanceof Error ? error.message : String(error);
  if (/ERR_(NAME_NOT_RESOLVED|CONNECTION_REFUSED|CONNECTION_TIMED_OUT|ADDRESS_UNREACHABLE|INTERNET_DISCONNECTED)|ENOTFOUND|ECONNREFUSED/i.test(message)) {
    return new ScanError("UNREACHABLE_URL", "We couldn’t reach that website. It may be offline or the address may be wrong.", 422);
  }
  if (/ERR_BLOCKED_BY_CLIENT|ERR_FAILED/i.test(message)) {
    return new ScanError("HEADLESS_BLOCKED", "That website blocked the automated browser used for scans.", 422);
  }
  return new ScanError("SCAN_FAILED", "The page opened, but its rendered content could not be inspected.", 500);
}

export async function renderPage(inputUrl: string, timeoutMs = 15_000): Promise<PageRenderSession> {
  const url = await assertPublicUrl(inputUrl);
  let browser: Browser | undefined;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--disable-dev-shm-usage", "--no-sandbox", "--disable-setuid-sandbox"],
    });
    const context = await browser.newContext({
      userAgent: "HatsmashAuditBot/1.0 (+https://hatsmash.com)",
      viewport: { width: 1440, height: 1000 },
      ignoreHTTPSErrors: false,
    });
    const page = await context.newPage();
    const consoleErrors: ConsoleFailure[] = [];
    const requestMap = new Map<string, NetworkRequest[]>();
    const networkRequests: NetworkRequest[] = [];
    const scriptBundles: ScriptBundle[] = [];
    const pendingScriptReads: Promise<void>[] = [];
    let totalScriptBytes = 0;
    let privateNavigationError: ScanError | undefined;

    await page.route("**/*", async (route) => {
      const requestUrl = route.request().url();
      if (!/^https?:/i.test(requestUrl)) return route.continue();
      try {
        await assertPublicUrl(requestUrl);
        return route.continue();
      } catch (error) {
        if (error instanceof ScanError && error.code === "PRIVATE_URL") {
          privateNavigationError = error;
          return route.abort("blockedbyclient");
        }
        return route.continue();
      }
    });

    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const location = message.location();
      consoleErrors.push({
        type: "error",
        message: message.text().slice(0, 800),
        location: location.url ? `${location.url}:${location.lineNumber ?? 0}` : "browser console",
      });
    });
    page.on("pageerror", (error) => {
      consoleErrors.push({ type: "pageerror", message: error.message.slice(0, 800), location: "page runtime" });
    });
    page.on("request", (request) => {
      const record: NetworkRequest = {
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType(),
      };
      networkRequests.push(record);
      const queue = requestMap.get(request.url()) ?? [];
      queue.push(record);
      requestMap.set(request.url(), queue);
    });
    page.on("requestfailed", (request) => {
      const record = requestMap.get(request.url())?.at(-1);
      if (record) record.failure = request.failure()?.errorText ?? "request failed";
    });
    page.on("response", (response) => {
      const request = response.request();
      const record = requestMap.get(request.url())?.at(-1);
      if (record) record.status = response.status();

      if (request.resourceType() !== "script" || response.status() >= 400 || totalScriptBytes >= MAX_TOTAL_SCRIPT_BYTES) return;
      const contentLength = Number(response.headers()["content-length"] ?? 0);
      if (contentLength > MAX_SCRIPT_BYTES) return;

      pendingScriptReads.push((async () => {
        try {
          const content = await response.text();
          const bytes = Buffer.byteLength(content);
          if (bytes > MAX_SCRIPT_BYTES || totalScriptBytes + bytes > MAX_TOTAL_SCRIPT_BYTES) return;
          totalScriptBytes += bytes;
          scriptBundles.push({ url: response.url(), content });
        } catch {
          // Cross-origin and streaming responses are allowed to omit their body.
        }
      })());
    });

    let mainResponse;
    try {
      mainResponse = await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
    } catch (error) {
      if (privateNavigationError) throw privateNavigationError;
      throw error;
    }
    if (!mainResponse) {
      throw new ScanError("UNREACHABLE_URL", "We couldn’t get a response from that website.", 422);
    }

    await page.waitForLoadState("networkidle", { timeout: 3_000 }).catch(() => undefined);
    await Promise.allSettled(pendingScriptReads);

    const finalUrl = await assertPublicUrl(page.url());
    const html = await page.content();
    const responseStatus = mainResponse.status();
    if (looksLikeHeadlessBlock(responseStatus, html)) {
      throw new ScanError("HEADLESS_BLOCKED", "That website blocked the automated browser used for scans.", 422);
    }
    if (responseStatus >= 500) {
      throw new ScanError("UNREACHABLE_URL", `That website returned an error (${responseStatus}) instead of a page.`, 422);
    }

    const screenshot = await page.screenshot({ fullPage: true, type: "png" });
    return {
      page,
      finalUrl,
      html,
      consoleErrors,
      networkRequests,
      screenshot,
      responseHeaders: mainResponse.headers(),
      responseStatus,
      scriptBundles,
      close: () => browser?.close() ?? Promise.resolve(),
    };
  } catch (error) {
    await browser?.close();
    if (error instanceof ScanError) throw error;
    throw classifyNavigationError(error);
  }
}
