import { Queue, Worker, type Job } from "bullmq";
import { Redis } from "ioredis";
import type { ScanResult } from "../../lib/scan-schema.js";
import { SCAN_JOB_TTL_SECONDS, SCAN_QUEUE_NAME, SCAN_WORKER_CONCURRENCY, requireRedisUrl } from "./config.js";
import { encodeWorkerError } from "./errors.js";
import { runScanPipeline, type ScanProgress } from "./pipeline.js";

export type ScanJobData = { url: string };

function createRedisConnection() {
  return new Redis(requireRedisUrl(), {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    tls: requireRedisUrl().startsWith("rediss://") ? {} : undefined,
  });
}

export function createScanInfrastructure() {
  const queueConnection = createRedisConnection();
  const quotaConnection = createRedisConnection();
  const queue = new Queue<ScanJobData, ScanResult>(SCAN_QUEUE_NAME, {
    connection: queueConnection,
    defaultJobOptions: {
      attempts: 1,
      removeOnComplete: { age: SCAN_JOB_TTL_SECONDS, count: 1_000 },
      removeOnFail: { age: SCAN_JOB_TTL_SECONDS, count: 1_000 },
    },
  });
  const worker = process.env.RUN_SCAN_WORKER === "false" ? undefined : new Worker<ScanJobData, ScanResult>(
    SCAN_QUEUE_NAME,
    async (job: Job<ScanJobData, ScanResult>) => {
      try {
        return await runScanPipeline(job.data.url, (progress: ScanProgress) => job.updateProgress(progress));
      } catch (error) {
        throw new Error(encodeWorkerError(error));
      }
    },
    { connection: createRedisConnection(), concurrency: SCAN_WORKER_CONCURRENCY },
  );

  return {
    queue,
    worker,
    quotaConnection,
    close: async () => {
      await worker?.close();
      await queue.close();
      await quotaConnection.quit();
      await queueConnection.quit();
    },
  };
}
