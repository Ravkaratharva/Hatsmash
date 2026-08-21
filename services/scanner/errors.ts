export type ScanErrorCode =
  | "INVALID_URL"
  | "PRIVATE_URL"
  | "UNREACHABLE_URL"
  | "PAGE_TIMEOUT"
  | "HEADLESS_BLOCKED"
  | "QUOTA_EXCEEDED"
  | "SCAN_FAILED";

export class ScanError extends Error {
  constructor(
    public readonly code: ScanErrorCode,
    message: string,
    public readonly statusCode = 500,
  ) {
    super(message);
    this.name = "ScanError";
  }
}

export function toPublicScanError(error: unknown) {
  if (error instanceof ScanError) {
    return { code: error.code, message: error.message, statusCode: error.statusCode };
  }

  return {
    code: "SCAN_FAILED" as const,
    message: "The audit stopped unexpectedly. Please try this site again.",
    statusCode: 500,
  };
}

export function encodeWorkerError(error: unknown) {
  const publicError = toPublicScanError(error);
  return JSON.stringify({ code: publicError.code, message: publicError.message });
}

export function decodeWorkerError(failedReason?: string) {
  if (!failedReason) {
    return { code: "SCAN_FAILED", message: "The audit stopped unexpectedly. Please try again." };
  }

  try {
    const parsed = JSON.parse(failedReason) as { code?: string; message?: string };
    if (parsed.code && parsed.message) return { code: parsed.code, message: parsed.message };
  } catch {
    // BullMQ stores the thrown message as plain text when it is not our encoded error.
  }

  return { code: "SCAN_FAILED", message: "The audit stopped unexpectedly. Please try again." };
}
