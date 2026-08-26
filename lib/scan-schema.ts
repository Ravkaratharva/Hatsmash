import { z } from "zod";

export const issueCategories = [
  "Accessibility",
  "Performance",
  "SEO",
  "AI-tell",
  "Security",
] as const;

export const issueSeverities = ["critical", "warning", "info"] as const;
export const targetTools = ["Lovable", "Cursor", "Bolt", "v0", "Replit Agent"] as const;
export const scanStages = [
  "queued",
  "rendering",
  "scanning",
  "generating-fixes",
  "done",
  "failed",
] as const;

export const issueCategorySchema = z.enum(issueCategories);
export const issueSeveritySchema = z.enum(issueSeverities);
export const targetToolSchema = z.enum(targetTools);
export const scanStageSchema = z.enum(scanStages);

export const fixPromptSchema = z.object({
  tool: targetToolSchema,
  prompt: z.string().min(20),
});

export const scanIssueBaseSchema = z.object({
  id: z.string().min(1),
  category: issueCategorySchema,
  severity: issueSeveritySchema,
  message: z.string().min(1),
  location: z.string().min(1),
  fixDescription: z.string().min(1),
  ruleId: z.string().min(1),
  evidence: z.string().min(1),
});

export const scanIssueSchema = scanIssueBaseSchema.extend({
  fixPrompts: z.array(fixPromptSchema).length(targetTools.length),
});

export const categoryScoresSchema = z.object({
  Accessibility: z.number().min(0).max(100),
  Performance: z.number().min(0).max(100),
  SEO: z.number().min(0).max(100),
  "AI-tell": z.number().min(0).max(100),
  Security: z.number().min(0).max(100),
});

export const scanResultSchema = z.object({
  url: z.url(),
  score: z.number().int().min(0).max(100),
  scores: categoryScoresSchema,
  scannedAt: z.iso.datetime(),
  findings: z.array(scanIssueSchema),
});

export const scanJobAcceptedSchema = z.object({
  jobId: z.string().min(1),
  stage: z.literal("queued"),
  remainingFreeScans: z.number().int().min(0),
});

export const scanJobStatusSchema = z.discriminatedUnion("stage", [
  z.object({
    jobId: z.string(),
    stage: z.enum(["queued", "rendering", "scanning", "generating-fixes"]),
    statusText: z.string(),
    liveFindings: z.array(scanIssueBaseSchema).optional(),
  }),
  z.object({
    jobId: z.string(),
    scanId: z.uuid(),
    stage: z.literal("done"),
    statusText: z.string(),
    result: scanResultSchema,
  }),
  z.object({
    jobId: z.string(),
    stage: z.literal("failed"),
    statusText: z.string(),
    error: z.object({ code: z.string(), message: z.string() }),
  }),
]);

export const unlockEmailSchema = z
  .string()
  .trim()
  .max(254)
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, "Enter a valid email address.")
  .transform((email) => email.toLowerCase());

export const unlockRequestSchema = z.object({
  email: unlockEmailSchema,
  scanId: z.uuid(),
});

export type IssueCategory = z.infer<typeof issueCategorySchema>;
export type IssueSeverity = z.infer<typeof issueSeveritySchema>;
export type TargetTool = z.infer<typeof targetToolSchema>;
export type ScanStage = z.infer<typeof scanStageSchema>;
export type ScanIssueBase = z.infer<typeof scanIssueBaseSchema>;
export type ScanIssue = z.infer<typeof scanIssueSchema>;
export type ScanResult = z.infer<typeof scanResultSchema>;
export type ScanJobAccepted = z.infer<typeof scanJobAcceptedSchema>;
export type ScanJobStatus = z.infer<typeof scanJobStatusSchema>;
export type UnlockRequest = z.infer<typeof unlockRequestSchema>;
