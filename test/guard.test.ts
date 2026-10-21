import { test } from "node:test";
import assert from "node:assert/strict";
import { readHandle, reserve, signHandle } from "../lib/guard.ts";

test("signed task handles round-trip and reject tampering", () => {
  const h = signHandle("wig", "abc_DEF-123.x");
  assert.deepEqual(readHandle(h), { kind: "wig", taskId: "abc_DEF-123.x" });
  const raw = Buffer.from(h, "base64url").toString();
  const forged = Buffer.from(raw.replace("abc_DEF", "zzz_DEF")).toString("base64url");
  assert.equal(readHandle(forged), null, "changed task id");
  assert.equal(readHandle("not-a-handle"), null);
  assert.equal(readHandle(signHandle("wig", "t", -5)), null, "expired");
});

test("units are reserved per visitor and released on failure", () => {
  const ip = "203.0.113." + Math.floor(Math.random() * 200);
  const releases = [];
  for (let i = 0; i < 30; i++) releases.push(reserve(ip, 2)); // 60 units: the hourly share
  assert.ok(releases.every(Boolean));
  assert.equal(reserve(ip, 2), null, "61st unit refused");
  releases[0]!();
  assert.ok(reserve(ip, 2), "a released reservation frees room");
});
