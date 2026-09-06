import type { ScanIssue } from "./scan-schema";

/** Keep stored scanner prompts intact; present the source-editing variant without vendor branding. */
export function repairPrompt(finding: ScanIssue): string | undefined {
  const original = finding.fixPrompts.find((item) => item.tool === "Cursor")?.prompt
    ?? finding.fixPrompts[0]?.prompt;
  if (!original) return undefined;
  return original
    .replace(/^In (?:my|this).*?:\s*/u, "In this website project, make a focused, reviewable repair:\n\n")
    // Observed evidence and issue details must remain verbatim, even when they name a vendor.
    .split("\n")
    .map((line) => /^(?:Issue|Location|Observed evidence|Required correction):/u.test(line)
      ? line
      : line.replace(/\b(?:Lovable|Cursor(?: Agent)?|Bolt|v0|Replit(?: Agent)?)\b/gu, "existing"))
    .join("\n")
    .replace(/Category: AI-tell/gu, "Category: Content quality")
    .replace(/App Router metadata or document-head source/gu, "metadata or document-head source");
}
