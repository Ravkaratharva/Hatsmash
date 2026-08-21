import { forwardScannerRequest } from "../_scanner";

export async function POST(request: Request) {
  return forwardScannerRequest(request, "/api/scan", "POST");
}
