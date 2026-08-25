import assert from "node:assert/strict";
import test from "node:test";
import { hashIp } from "./quota.js";

test("scan persistence reuses the quota IP hashing function", () => {
  const previousSalt = process.env.IP_HASH_SALT;
  process.env.IP_HASH_SALT = "test-only-hatsmash-salt";

  const first = hashIp("203.0.113.10");
  const second = hashIp("203.0.113.10");

  assert.equal(first, second);
  assert.match(first, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(first, /203\.0\.113\.10/);

  if (previousSalt === undefined) delete process.env.IP_HASH_SALT;
  else process.env.IP_HASH_SALT = previousSalt;
});
