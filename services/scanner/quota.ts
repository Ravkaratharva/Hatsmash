import { createHash } from "node:crypto";
import type { Redis } from "ioredis";
import { FREE_SCANS_PER_IP } from "./config.js";
import { ScanError } from "./errors.js";

function secondsUntilUtcMidnight() {
  const now = new Date();
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(60, Math.ceil((midnight - now.getTime()) / 1_000));
}

export function hashIp(ip: string) {
  const salt = process.env.IP_HASH_SALT ?? "hatsmash-quota-v1";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex");
}

function quotaKey(ip: string) {
  return `hatsmash:quota:${new Date().toISOString().slice(0, 10)}:${hashIp(ip)}`;
}

export async function consumeFreeScan(redis: Redis, ip: string) {
  const key = quotaKey(ip);
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, secondsUntilUtcMidnight());
  if (count > FREE_SCANS_PER_IP) {
    throw new ScanError(
      "QUOTA_EXCEEDED",
      `This connection has used its ${FREE_SCANS_PER_IP} free scans for today. Try again tomorrow.`,
      429,
    );
  }
  return { remaining: Math.max(0, FREE_SCANS_PER_IP - count), ipHash: hashIp(ip) };
}
