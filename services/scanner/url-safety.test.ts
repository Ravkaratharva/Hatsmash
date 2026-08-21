import assert from "node:assert/strict";
import test from "node:test";
import { ScanError } from "./errors.js";
import { assertPublicUrl } from "./url-safety.js";

test("URL validation rejects private and non-web targets with distinct errors", async () => {
  await assert.rejects(
    () => assertPublicUrl("file:///etc/passwd"),
    (error: unknown) => error instanceof ScanError && error.code === "INVALID_URL",
  );
  await assert.rejects(
    () => assertPublicUrl("http://127.0.0.1/admin"),
    (error: unknown) => error instanceof ScanError && error.code === "PRIVATE_URL",
  );
});
