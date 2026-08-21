import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { ScanError } from "./errors.js";

const hostnameCache = new Map<string, { expiresAt: number; check: Promise<void> }>();
const HOSTNAME_CACHE_MS = 60_000;

function isPrivateIpv4(address: string) {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateIpv6(address: string) {
  const normalized = address.toLowerCase().split("%")[0];
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (/^fe[89ab]/.test(normalized)) return true;
  if (normalized.startsWith("::ffff:")) {
    const mapped = normalized.slice("::ffff:".length);
    return isIP(mapped) === 4 ? isPrivateIpv4(mapped) : true;
  }
  return false;
}

function assertPublicAddress(address: string) {
  const family = isIP(address);
  if ((family === 4 && isPrivateIpv4(address)) || (family === 6 && isPrivateIpv6(address))) {
    throw new ScanError("PRIVATE_URL", "Hatsmash can only scan public websites.", 400);
  }
}

async function assertPublicHostname(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local") ||
    normalized === "metadata.google.internal"
  ) {
    throw new ScanError("PRIVATE_URL", "Hatsmash can only scan public websites.", 400);
  }

  if (isIP(normalized)) {
    assertPublicAddress(normalized);
    return;
  }

  try {
    const addresses = await lookup(normalized, { all: true, verbatim: true });
    if (!addresses.length) throw new Error("no addresses");
    for (const { address } of addresses) assertPublicAddress(address);
  } catch (error) {
    if (error instanceof ScanError) throw error;
    throw new ScanError("UNREACHABLE_URL", "We couldn’t find that website. Check the address and try again.", 422);
  }
}

export async function assertPublicUrl(value: string) {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new ScanError("INVALID_URL", "Enter a complete website URL, such as https://example.com.", 400);
  }

  if (!["http:", "https:"].includes(parsed.protocol) || parsed.username || parsed.password) {
    throw new ScanError("INVALID_URL", "Enter a public HTTP or HTTPS website URL.", 400);
  }

  const allowPrivate = process.env.ALLOW_PRIVATE_SCAN_URLS === "true";
  if (!allowPrivate) {
    const existing = hostnameCache.get(parsed.hostname);
    const cached = existing && existing.expiresAt > Date.now()
      ? existing
      : { expiresAt: Date.now() + HOSTNAME_CACHE_MS, check: assertPublicHostname(parsed.hostname) };
    hostnameCache.set(parsed.hostname, cached);
    try {
      await cached.check;
    } catch (error) {
      hostnameCache.delete(parsed.hostname);
      throw error;
    }
  }

  parsed.hash = "";
  return parsed.toString();
}
