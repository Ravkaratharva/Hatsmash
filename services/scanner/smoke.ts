import { issueCategories } from "../../lib/scan-schema.js";
import { runScanPipeline } from "./pipeline.js";

const defaultTargets = [
  "https://www.w3.org/WAI/demos/bad/before/home.html",
  "https://www.w3.org/WAI/demos/bad/after/home.html",
];
const targets = process.argv.slice(2).length ? process.argv.slice(2) : defaultTargets;

for (const url of targets) {
  console.log(`\nScanning ${url}`);
  const result = await runScanPipeline(url, (progress) => console.log(`  ${progress.statusText}`));
  console.log(`  Score: ${result.score}/100`);
  console.log(`  Findings: ${result.findings.length}`);
  for (const category of issueCategories) {
    console.log(`  ${category}: ${result.findings.filter((issue) => issue.category === category).length}`);
  }
}
