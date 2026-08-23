const ALLOWED_RETURN_PATHS = new Set([
  "/",
  "/account",
  "/app",
  "/community",
  "/pricing",
]);

const INTERNAL_ORIGIN = "https://hatsmash.internal";

export function safeInternalReturnPath(value: unknown, fallback = "/account"): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }
  if (value.includes("\\") || Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127;
  })) return fallback;

  try {
    const url = new URL(value, INTERNAL_ORIGIN);
    if (url.origin !== INTERNAL_ORIGIN || !ALLOWED_RETURN_PATHS.has(url.pathname)) {
      return fallback;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function authPagePath(mode: "login" | "signup", returnTo: unknown): string {
  const safeReturnTo = safeInternalReturnPath(returnTo);
  return `/${mode}?returnTo=${encodeURIComponent(safeReturnTo)}`;
}
