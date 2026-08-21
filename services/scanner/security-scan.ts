import type { ScanIssueBase } from "../../lib/scan-schema.js";
import { createIssue } from "./issues.js";
import type { ScriptBundle } from "./render-page.js";

const securityHeaders = [
  {
    name: "content-security-policy",
    label: "Content-Security-Policy",
    fix: "Add a restrictive Content-Security-Policy that permits only the scripts, styles, images, frames, and connections the site actually uses.",
  },
  {
    name: "x-frame-options",
    label: "X-Frame-Options",
    fix: "Add X-Frame-Options: DENY or SAMEORIGIN unless this page intentionally needs to be embedded.",
  },
  {
    name: "strict-transport-security",
    label: "Strict-Transport-Security",
    fix: "Serve Strict-Transport-Security over HTTPS with an appropriate max-age after confirming every subdomain supports HTTPS.",
  },
] as const;

const exposedKeyPatterns = [
  { label: "OpenAI-style secret", regex: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/ },
  { label: "Google API key", regex: /\bAIza[0-9A-Za-z_-]{30,}\b/ },
  { label: "AWS access key", regex: /\bAKIA[0-9A-Z]{16}\b/ },
  { label: "GitHub token", regex: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/ },
  { label: "Slack token", regex: /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/ },
  { label: "Stripe secret", regex: /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/ },
] as const;

export function runSecurityChecks(input: {
  finalUrl: string;
  responseHeaders: Record<string, string>;
  scriptBundles: ScriptBundle[];
}) {
  const issues: ScanIssueBase[] = [];
  const protocol = new URL(input.finalUrl).protocol;

  if (protocol !== "https:") {
    issues.push(createIssue({
      category: "Security",
      severity: "critical",
      message: "The page is not served over HTTPS.",
      location: input.finalUrl,
      fixDescription: "Enable HTTPS, redirect HTTP to HTTPS, and update every internal asset and canonical URL to use HTTPS.",
      ruleId: "security-https",
      evidence: "The final page URL uses HTTP.",
    }));
  }

  for (const header of securityHeaders) {
    if (input.responseHeaders[header.name]) continue;
    if (header.name === "strict-transport-security" && protocol !== "https:") continue;
    issues.push(createIssue({
      category: "Security",
      severity: "warning",
      message: `${header.label} is missing from the page response.`,
      location: "main document response headers",
      fixDescription: header.fix,
      ruleId: `security-header-${header.name}`,
      evidence: `No ${header.label} response header was present.`,
    }));
  }

  for (const bundle of input.scriptBundles) {
    for (const pattern of exposedKeyPatterns) {
      if (!pattern.regex.test(bundle.content)) continue;
      issues.push(createIssue({
        category: "Security",
        severity: "critical",
        message: `A ${pattern.label} shaped value was found in client JavaScript.`,
        location: new URL(bundle.url).pathname || "served JavaScript bundle",
        fixDescription: "Remove the credential from client code, rotate it immediately, and move the privileged request behind a server-only endpoint with restricted permissions.",
        ruleId: `security-exposed-${pattern.label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        evidence: "A key-shaped string matched a high-confidence credential pattern. The value is intentionally not included here.",
      }));
    }
  }

  return issues;
}
