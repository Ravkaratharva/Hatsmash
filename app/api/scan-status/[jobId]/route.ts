import { forwardScannerRequest } from "../../_scanner";

export async function GET(request: Request, context: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await context.params;
  return forwardScannerRequest(request, `/api/scan-status/${encodeURIComponent(jobId)}`, "GET");
}
