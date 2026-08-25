import { Queue, Worker, type Job } from "bullmq";
import { Redis } from "ioredis";
import type { ScanResult } from "../../lib/scan-schema.js";
import { closeScannerDatabase } from "./database.js";
import {
  SCAN_JOB_TTL_SECONDS,
  SCAN_QUEUE_NAME,
  SCAN_WORKER_CONCURRENCY,
  SCAN_WORKER_LOCK_DURATION_MS,
  requireRedisUrl,
} from "./config.js";
import { encodeWorkerError } from "./errors.js";
import { runScanPipeline, type ScanProgress } from "./pipeline.js";

export type ScanJobData = { url: string; remainingFreeScans: number; ipHash?: string };

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
      attempts: 2,
      backoff: { type: "exponential", delay: 3_000 },
      removeOnComplete: { age: SCAN_JOB_TTL_SECONDS, count: 1_000 },
      removeOnFail: { age: SCAN_JOB_TTL_SECONDS, count: 1_000 },
    },
  });
  const worker = process.env.RUN_SCAN_WORKER === "false" ? undefined : new Worker<ScanJobData, ScanResult>(
    SCAN_QUEUE_NAME,
    async (job: Job<ScanJobData, ScanResult>) => {
      try {
        return await runScanPipeline(
          job.data.url,
          (progress: ScanProgress) => job.updateProgress(progress),
          job.data.ipHash,
        );
      } catch (error) {
        throw new Error(encodeWorkerError(error));
      }
    },
    {
      connection: createRedisConnection(),
      concurrency: SCAN_WORKER_CONCURRENCY,
      // Lighthouse can monopolize the tiny CPU allocation on a free Render instance.
      // Keep the lock valid for the complete verified audit even if a renewal timer is delayed.
      lockDuration: SCAN_WORKER_LOCK_DURATION_MS,
      lockRenewTime: 60_000,
      stalledInterval: 60_000,
    },
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
      await closeScannerDatabase();
    },
  };
}
