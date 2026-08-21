import { load, type CheerioAPI } from "cheerio";
import type { AnyNode, Element } from "domhandler";
import type { ScanIssueBase } from "../../../lib/scan-schema.js";
import { createIssue } from "../issues.js";
import type { ConsoleFailure, NetworkRequest } from "../render-page.js";

function elementLocation($: CheerioAPI, element: Element) {
  const selection = $(element);
  const id = selection.attr("id");
  if (id) return `${element.tagName}#${id}`;
  const classes = (selection.attr("class") ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return `${element.tagName}${classes.length ? `.${classes.join(".")}` : ""}`;
}

function visibleText($: CheerioAPI) {
  $("script, style, noscript, template").remove();
  return $("body").text().replace(/\s+/g, " ").trim();
}

export function detectPlaceholderText(html: string): ScanIssueBase[] {
  const $ = load(html);
  const text = visibleText($);
  const patterns = [
    { id: "lorem-ipsum", regex: /\b(?:lorem ipsum|dolor sit amet)\b/i, label: "Lorem ipsum placeholder text" },
    { id: "template-placeholder", regex: /\b(?:your (?:company|brand|headline) here|replace (?:this|me)|coming soon)\b/i, label: "template placeholder text" },
    { id: "todo-copy", regex: /\b(?:todo|tbd)\s*[:-]/i, label: "unfinished TODO text" },
  ];

  return patterns.flatMap((pattern) => pattern.regex.test(text) ? [createIssue({
    category: "AI-tell",
    severity: "warning",
    message: `${pattern.label} is still visible on the page.`,
    location: "rendered page copy",
    fixDescription: "Replace the placeholder with final, product-specific copy and check hidden accordions and mobile-only sections too.",
    ruleId: `ai-${pattern.id}`,
    evidence: `The rendered page contains text matching the ${pattern.id} placeholder pattern.`,
  })] : []);
}

export function detectBrokenImages(html: string, networkRequests: NetworkRequest[], baseUrl: string): ScanIssueBase[] {
  const $ = load(html);
  const failedImages = new Map(
    networkRequests
      .filter((request) => request.resourceType === "image" && (request.failure || (request.status ?? 0) >= 400))
      .map((request) => [request.url, request]),
  );
  const issues: ScanIssueBase[] = [];

  $("img").each((_, node) => {
    const element = node as Element;
    const selection = $(element);
    const src = (selection.attr("src") ?? "").trim();
    const srcset = (selection.attr("srcset") ?? "").trim();
    const location = elementLocation($, element);
    if (!src && !srcset) {
      issues.push(createIssue({
        category: "AI-tell",
        severity: "critical",
        message: "An image has no usable source.",
        location,
        fixDescription: "Connect this image to a valid local or hosted asset and keep explicit width, height, and descriptive alt text.",
        ruleId: "ai-image-empty-src",
        evidence: "The rendered <img> element has neither src nor srcset.",
      }));
      return;
    }

    if (!src || src.startsWith("data:") || src.startsWith("blob:")) return;
    try {
      const absoluteSrc = new URL(src, baseUrl).toString();
      const failed = failedImages.get(absoluteSrc);
      if (!failed) return;
      issues.push(createIssue({
        category: "AI-tell",
        severity: "critical",
        message: "An image request fails when the page loads.",
        location,
        fixDescription: "Replace the broken image URL or restore the missing asset, then verify the final production URL returns an image successfully.",
        ruleId: "ai-image-broken-src",
        evidence: failed.failure ? "The browser reported a failed image request." : `The image request returned HTTP ${failed.status}.`,
      }));
    } catch {
      // Browsers ignore malformed image URLs, which is already covered by their failed request when emitted.
    }
  });

  return issues;
}

export function detectUnwiredForms(html: string): ScanIssueBase[] {
  const $ = load(html);
  const issues: ScanIssueBase[] = [];

  $("form").each((_, node) => {
    const element = node as Element;
    const form = $(element);
    const hasFormHandler = Boolean((form.attr("action") ?? "").trim() || form.attr("onsubmit"));
    const controls = form.find('button, input[type="submit"], input[type="image"]');
    const hasVisibleSubmit = controls.toArray().some((control: AnyNode) => {
      if (control.type !== "tag") return false;
      const candidate = $(control);
      const type = (candidate.attr("type") ?? (control.tagName === "button" ? "submit" : "")).toLowerCase();
      const hidden = candidate.attr("hidden") !== undefined || /display\s*:\s*none/i.test(candidate.attr("style") ?? "");
      return !hidden && (type === "submit" || Boolean(candidate.attr("onclick")));
    });

    if (!hasFormHandler && !hasVisibleSubmit) {
      issues.push(createIssue({
        category: "AI-tell",
        severity: "critical",
        message: "A form has no visible way to submit and no HTML submit handler.",
        location: elementLocation($, element),
        fixDescription: "Wire the form to a real submit handler or action and provide a visible submit button with loading, success, and error states.",
        ruleId: "ai-form-unwired",
        evidence: "The rendered form has no action or onsubmit attribute and contains no visible submit control.",
      }));
    }
  });

  return issues;
}

export function detectConsoleErrors(consoleErrors: ConsoleFailure[]): ScanIssueBase[] {
  return consoleErrors.slice(0, 10).map((failure) => createIssue({
    category: "AI-tell",
    severity: "critical",
    message: "The page throws an error in the browser console.",
    location: failure.location,
    fixDescription: "Trace this runtime error to its source component or request, handle the failure explicitly, and verify the production build has a clean console.",
    ruleId: `ai-console-${failure.type}`,
    evidence: failure.message.replace(/\s+/g, " ").slice(0, 260),
  }));
}

function spacingSignature(style: string) {
  const matches = [...style.matchAll(/(?:margin|padding|gap|width|height)(?:-[a-z]+)?\s*:\s*(-?\d+(?:\.\d+)?(?:px|rem))/gi)];
  return matches.map((match) => match[1].toLowerCase()).join("|");
}

export function detectInconsistentSpacingAndSizing(html: string): ScanIssueBase[] {
  const $ = load(html);
  const issues: ScanIssueBase[] = [];

  $("body *").each((_, parentNode) => {
    if (issues.length) return;
    const parent = $(parentNode);
    const children = parent.children().toArray().filter((child: AnyNode) => child.type === "tag") as Element[];
    if (children.length < 4) return;
    const grouped = new Map<string, string[]>();
    for (const child of children) {
      const signature = spacingSignature($(child).attr("style") ?? "");
      if (!signature) continue;
      const signatures = grouped.get(child.tagName) ?? [];
      signatures.push(signature);
      grouped.set(child.tagName, signatures);
    }

    for (const [tagName, signatures] of grouped) {
      if (signatures.length >= 4 && new Set(signatures).size >= 3) {
        issues.push(createIssue({
          category: "AI-tell",
          severity: "info",
          message: `Repeated ${tagName} elements use several one-off spacing or sizing values.`,
          location: parentNode.type === "tag" ? elementLocation($, parentNode as Element) : "rendered layout",
          fixDescription: "Replace one-off dimensions with a small shared spacing and sizing scale, then verify the repeated components at mobile and desktop widths.",
          ruleId: "ai-inconsistent-spacing-sizing",
          evidence: `${signatures.length} sibling elements use ${new Set(signatures).size} different inline spacing or sizing signatures.`,
        }));
        break;
      }
    }
  });

  return issues;
}

export function runAiTellHeuristics(input: {
  html: string;
  consoleErrors: ConsoleFailure[];
  networkRequests: NetworkRequest[];
  finalUrl: string;
}) {
  return [
    ...detectPlaceholderText(input.html),
    ...detectBrokenImages(input.html, input.networkRequests, input.finalUrl),
    ...detectUnwiredForms(input.html),
    ...detectConsoleErrors(input.consoleErrors),
    ...detectInconsistentSpacingAndSizing(input.html),
  ];
}
