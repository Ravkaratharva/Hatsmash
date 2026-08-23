export const SCAN_QUEUE_NAME = "hatsmash-scans";
export const FREE_SCANS_PER_IP = Number(process.env.FREE_SCANS_PER_IP ?? 3);
export const SCAN_JOB_TTL_SECONDS = Number(process.env.SCAN_JOB_TTL_SECONDS ?? 86_400);
export const SCAN_WORKER_CONCURRENCY = Number(process.env.SCAN_WORKER_CONCURRENCY ?? 1);
export const SCAN_WORKER_LOCK_DURATION_MS = Math.min(
  900_000,
  Math.max(300_000, Number(process.env.SCAN_WORKER_LOCK_DURATION_MS ?? 600_000)),
);
export const LIGHTHOUSE_TIMEOUT_MS = Math.min(
  150_000,
  Math.max(30_000, Number(process.env.LIGHTHOUSE_TIMEOUT_MS ?? 110_000)),
);
export const SCAN_PORT = Number(process.env.PORT ?? 8_788);

export function requireRedisUrl() {
  const value = process.env.REDIS_URL;
  if (!value) throw new Error("REDIS_URL is required to start the Hatsmash scanner service.");
  return value;
}
