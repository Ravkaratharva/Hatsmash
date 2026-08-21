import type { IssueCategory, ScanIssueBase, TargetTool } from "../../lib/scan-schema.js";

const categoryWork: Record<IssueCategory, Record<TargetTool, string>> = {
  Accessibility: {
    Lovable: "Update the affected Lovable component with semantic HTML and accessible labels. Keep the current visual style, verify keyboard operation, and check both desktop and mobile previews.",
    Cursor: "Locate the owning component and implement the semantic/ARIA fix in source, preferring native HTML over ARIA. Add or update an automated accessibility test for this exact regression.",
    Bolt: "Edit the affected component in the Bolt project, use native accessible elements, and verify focus order plus keyboard interaction in the live preview.",
    v0: "Regenerate only the affected React/Next.js component with correct semantic markup and accessible names. Preserve its props/API and existing Tailwind visual treatment.",
    "Replit Agent": "Find the rendered element in the Replit codebase, apply the semantic accessibility fix, run the app, and test it with keyboard navigation and the existing test command.",
  },
  Performance: {
    Lovable: "Optimize the relevant Lovable asset or component without changing the design. Use responsive images/lazy loading or defer non-critical work, then compare the mobile preview before and after.",
    Cursor: "Trace the slow resource or render path to its source file, implement the smallest performance fix, and measure the relevant Lighthouse metric before and after. Avoid unrelated refactors.",
    Bolt: "Fix the identified bottleneck in the Bolt project, prioritizing image sizing, code loading, and render-blocking work. Re-run the production preview and confirm the measured metric improves.",
    v0: "Revise the generated Next.js component to use framework-native image/font/script optimization and stable dimensions. Keep the public component interface unchanged.",
    "Replit Agent": "Profile the running Replit app, find the source of this bottleneck, implement a targeted optimization, and report the before/after metric from a production build.",
  },
  SEO: {
    Lovable: "Update the page-level SEO settings and rendered content in Lovable. Keep the title, description, canonical URL, headings, and link text specific to this page rather than generic site defaults.",
    Cursor: "Find the App Router metadata or document-head source for this route, correct the SEO output, and add a test that asserts the final rendered tag or heading.",
    Bolt: "Edit the affected route metadata and page structure in Bolt, then inspect the production preview source to confirm the corrected tag or heading is rendered server-side.",
    v0: "Update the generated Next.js route metadata and semantic heading/link structure. Use the Metadata API where applicable and preserve the existing layout component.",
    "Replit Agent": "Locate this route’s metadata/template code, correct the rendered SEO output, restart the app, and verify the final HTML rather than only the client-side view.",
  },
  "AI-tell": {
    Lovable: "Replace the unfinished or default-looking output in the named Lovable section with product-specific content and shared design tokens. Check the same component at mobile and desktop sizes.",
    Cursor: "Search for the exact evidence and owning component, remove the placeholder/default implementation, and consolidate one-off values into the project’s existing tokens. Add a focused regression test where practical.",
    Bolt: "Repair the unfinished behavior or styling in the affected Bolt component, using the project’s existing patterns. Exercise the interaction in preview, including success and failure states when it is a form.",
    v0: "Regenerate only the affected component with finished product copy/behavior and consistent Tailwind tokens. Do not replace the surrounding page or introduce a generic component-library style.",
    "Replit Agent": "Find the unfinished component or runtime error, implement the real behavior/content, and run the app through the affected interaction. Confirm there are no new console errors.",
  },
  Security: {
    Lovable: "Apply this security fix through Lovable’s server/integration settings and deployment configuration. Never move a secret into a client-visible variable; rotate any exposed credential after removal.",
    Cursor: "Trace the issue through source and deployment config, implement the server-side/header fix, and add a regression check. If a credential may be exposed, remove and rotate it without printing it in logs or commits.",
    Bolt: "Move privileged logic to a server-only function or configure the required response header in the Bolt deployment. Remove exposed values from client bundles and rotate them immediately.",
    v0: "Keep secrets and privileged calls in server-only Next.js code, update headers in the route/framework configuration, and ensure no secret-prefixed variable is referenced by a client component.",
    "Replit Agent": "Inspect source plus deployment secrets/config, implement the server-side or response-header fix, rotate any exposed credential, and verify the production response/bundle without echoing secret values.",
  },
};

const toolOpeners: Record<TargetTool, string> = {
  Lovable: "In my existing Lovable project, make this targeted fix without redesigning the page:",
  Cursor: "In this repository, use Cursor Agent to make a focused, reviewable patch:",
  Bolt: "In my current Bolt project, update the existing implementation in place:",
  v0: "In this existing v0/Next.js project, revise only the affected generated component or route:",
  "Replit Agent": "In my existing Replit project, inspect the running app and implement this fix end to end:",
};

export function generateFixPrompts(issue: ScanIssueBase, tool: TargetTool): string {
  // SWAP POINT: replace this function's body with a Claude API call when ready — signature and return shape must stay identical.
  return [
    toolOpeners[tool],
    "",
    `Issue: ${issue.message}`,
    `Category: ${issue.category}`,
    `Location: ${issue.location}`,
    `Observed evidence: ${issue.evidence}`,
    "",
    `Required correction: ${issue.fixDescription}`,
    categoryWork[issue.category][tool],
    "",
    "Acceptance criteria:",
    "- The reported issue is no longer present in the rendered production page.",
    "- Existing content and visual behavior outside this issue remain unchanged.",
    "- The fix works at mobile and desktop widths and introduces no console errors.",
    "- Summarize the files changed and the verification performed.",
  ].join("\n");
}
