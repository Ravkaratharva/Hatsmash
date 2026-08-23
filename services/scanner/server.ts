import cors from "@fastify/cors";
import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { scanResultSchema } from "../../lib/scan-schema.js";
import { SCAN_PORT } from "./config.js";
import { decodeWorkerError, toPublicScanError } from "./errors.js";
import type { ScanProgress } from "./pipeline.js";
import { createScanInfrastructure } from "./queue.js";
import { consumeFreeScan } from "./quota.js";
import { assertPublicUrl } from "./url-safety.js";

const app = Fastify({
  logger: true,
  trustProxy: process.env.TRUST_PROXY === "true",
  bodyLimit: 32_768,
});
const infrastructure = createScanInfrastructure();
const submitSchema = z.object({
  url: z.string().trim().min(1).max(2_048),
  requestId: z.uuid().optional(),
});
const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS ?? "http://localhost:3000")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);

await app.register(cors, {
  methods: ["GET", "POST", "OPTIONS"],
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) callback(null, true);
    else callback(new Error("Origin is not allowed"), false);
  },
});

app.get("/healthz", async (_request, reply) => {
  try {
    await infrastructure.quotaConnection.ping();
    return { ok: true, queue: "ready" };
  } catch {
    return reply.code(503).send({ ok: false, queue: "unavailable" });
  }
});

app.post("/api/scan", async (request, reply) => {
  try {
    const parsed = submitSchema.parse(request.body);
    const url = await assertPublicUrl(parsed.url);
    const jobId = parsed.requestId ?? randomUUID();
    const existingJob = parsed.requestId ? await infrastructure.queue.getJob(jobId) : undefined;
    if (existingJob) {
      if (existingJob.data.url !== url) {
        return reply.code(409).send({ error: { code: "REQUEST_CONFLICT", message: "Start a new scan request for this URL." } });
      }
      return reply.code(202).send({
        jobId,
        stage: "queued",
        remainingFreeScans: existingJob.data.remainingFreeScans,
      });
    }
    const quota = await consumeFreeScan(infrastructure.quotaConnection, request.ip);
    await infrastructure.queue.add("scan", { url, remainingFreeScans: quota.remaining }, { jobId });
    return reply.code(202).send({ jobId, stage: "queued", remainingFreeScans: quota.remaining });
  } catch (error) {
    const publicError = toPublicScanError(error);
    const statusCode = error instanceof z.ZodError ? 400 : publicError.statusCode;
    return reply.code(statusCode).send({
      error: {
        code: error instanceof z.ZodError ? "INVALID_URL" : publicError.code,
        message: error instanceof z.ZodError ? "Enter a complete website URL, such as https://example.com." : publicError.message,
      },
    });
  }
});

app.get<{ Params: { jobId: string } }>("/api/scan-status/:jobId", async (request, reply) => {
  const job = await infrastructure.queue.getJob(request.params.jobId);
  if (!job) return reply.code(404).send({ error: { code: "JOB_NOT_FOUND", message: "That scan has expired or does not exist." } });

  const state = await job.getState();
  if (state === "completed") {
    const completedJob = await infrastructure.queue.getJob(request.params.jobId);
    const parsedResult = scanResultSchema.safeParse(completedJob?.returnvalue);
    if (parsedResult.success) {
      return {
        jobId: job.id,
        stage: "done",
        statusText: "Audit complete.",
        result: parsedResult.data,
      };
    }
    return reply.code(202).send({
      jobId: job.id,
      stage: "generating-fixes",
      statusText: "Finalizing verified audit results…",
    });
  }
  if (state === "failed") {
    return {
      jobId: job.id,
      stage: "failed",
      statusText: "Scan stopped.",
      error: decodeWorkerError(job.failedReason),
    };
  }

  const progress = typeof job.progress === "object" && job.progress
    ? job.progress as ScanProgress
    : { stage: "queued" as const, statusText: "Waiting for a scanner…" };
  return { jobId: job.id, ...progress };
});

async function shutdown() {
  await app.close();
  await infrastructure.close();
}

process.once("SIGINT", () => void shutdown());
process.once("SIGTERM", () => void shutdown());

await app.listen({ host: "0.0.0.0", port: SCAN_PORT });
