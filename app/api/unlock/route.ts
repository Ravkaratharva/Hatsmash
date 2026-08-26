import { forwardScannerRequest } from "../_scanner";

export async function POST(request: Request) {
  return forwardScannerRequest(request, "/api/unlock", "POST");
}
