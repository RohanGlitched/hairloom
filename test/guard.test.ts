import { test, before } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

process.env.HANDLE_SECRET = "test-handle-secret";
process.env.JUDGE_CODE = "test-judge-code";
process.env.GLOBAL_DAILY_UNITS = "10";
process.env.JUDGE_DAILY_UNITS = "6";
type Guard = typeof import("../lib/guard.ts");
let g: Guard;
before(async () => {
  process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), "hairloom-guard-"))); // local file store lands here
  g = await import("../lib/guard.ts");
});

test("signed task handles round-trip and reject tampering", () => {
  const h = g.signHandle("wig", "abc_DEF-123.x", "judge", "2026-10-22");
  assert.deepEqual(g.readHandle(h), { kind: "wig", taskId: "abc_DEF-123.x", lane: "judge", day: "2026-10-22" });
  const raw = Buffer.from(h, "base64url").toString();
  const forge = (a: string, b: string) => Buffer.from(raw.replace(a, b)).toString("base64url");
  assert.equal(g.readHandle(forge("abc_DEF", "zzz_DEF")), null, "changed task id");
  assert.equal(g.readHandle(forge("judge", "public")), null, "changed lane");
  assert.equal(g.readHandle(forge("2026-10-22", "2026-10-21")), null, "changed day");
  assert.equal(g.readHandle("not-a-handle"), null);
  assert.equal(g.readHandle(g.signHandle("wig", "t", "public", g.today(), -5)), null, "expired");
});

test("units are reserved per visitor and released on failure", () => {
  const ip = "203.0.113." + Math.floor(Math.random() * 200);
  const releases = [];
  for (let i = 0; i < 30; i++) releases.push(g.reserve(ip, 2)); // 60 units: the hourly share
  assert.ok(releases.every(Boolean));
  assert.equal(g.reserve(ip, 2), null, "61st unit refused");
  releases[0]!();
  assert.ok(g.reserve(ip, 2), "a released reservation frees room");
});

test("the judge lane needs the exact code", () => {
  assert.equal(g.laneOf(null), "public");
  assert.equal(g.laneOf(""), "public");
  assert.equal(g.laneOf("test-judge-code"), "judge");
  assert.equal(g.laneOf("test-judge-cod"), null);
  assert.equal(g.laneOf("TEST-JUDGE-CODE"), null);
});

test("daily caps are per lane, never overshoot under parallel requests, and refund", async () => {
  const day = g.today();
  const runs = await Promise.all(Array.from({ length: 8 }, () => g.dailyAllows(2, "public", day)));
  assert.equal(runs.filter((r) => r.ok).length, 5, "10 units a day: five 2-unit tasks");
  assert.ok(runs.every((r) => r.used <= 10));
  assert.equal(await g.dayLeft("public"), 0);
  assert.equal(await g.dayLeft("judge"), 6, "the judge lane has its own counter");
  await g.refundDay(2, "public", day);
  assert.equal(await g.dayLeft("public"), 2, "a failed task gives its units back");
  await g.refundDay(50, "public", day);
  assert.equal(await g.dayLeft("public"), 10, "never below zero used");
});

test("the counter is compare-and-swap: a write from a stale read is refused", async () => {
  const { store } = await import("../lib/storage.ts");
  const a = await store().readGen("cas.json");
  assert.equal(await store().putIf("cas.json", "1", a?.gen ?? "0"), true);
  assert.equal(await store().putIf("cas.json", "2", a?.gen ?? "0"), false, "stale generation");
  const b = await store().readGen("cas.json");
  assert.equal(b?.text, "1");
});

test("an ended task is recorded once and remembered", async () => {
  const id = "task-" + Math.random();
  assert.equal(await g.endOf(id), null);
  assert.equal(await g.markEnd(id, "gone"), true, "first end: refund");
  assert.equal(await g.markEnd(id, "gone"), false, "second end: no second refund");
  assert.equal(await g.endOf(id), "gone");
  const done = "task-" + Math.random();
  assert.equal(await g.markEnd(done, "done"), true);
  assert.equal(await g.endOf(done), "done");
  assert.equal(await g.markEnd(done, "gone"), false, "deleting after success refunds nothing");
  assert.equal(await g.endOf(done), "gone");
});

test("polls and deletes are throttled per handle and per visitor", () => {
  assert.equal(g.pollAllowed("h1"), true);
  assert.equal(g.pollAllowed("h1"), false);
  assert.equal(g.pollAllowed("del:h1", 5000), true);
  assert.equal(g.pollAllowed("del:h1", 5000), false);
  const ip = "198.51.100.7";
  for (let i = 0; i < 30; i++) assert.equal(g.visitorAllowed(ip), true);
  assert.equal(g.visitorAllowed(ip), false, "30 forwarded calls a minute per visitor, under YouCam's 50 for the whole key");
});

test("production refuses to sign handles without HANDLE_SECRET", () => {
  const keep = { secret: process.env.HANDLE_SECRET, env: process.env.VERCEL_ENV };
  try {
    delete process.env.HANDLE_SECRET;
    process.env.VERCEL_ENV = "production";
    assert.throws(() => g.signHandle("wig", "t"), /HANDLE_SECRET is not set/);
    assert.throws(() => g.readHandle(Buffer.from("wig.public.2026-10-22.t.9.mac").toString("base64url")), /HANDLE_SECRET is not set/);
  } finally {
    process.env.HANDLE_SECRET = keep.secret;
    if (keep.env === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = keep.env;
  }
  assert.ok(g.readHandle(g.signHandle("wig", "t")), "signs again once it is set");
});

test("the public floor keeps what judges may still use today in reserve", async () => {
  // JUDGE_DAILY_UNITS is 6 here, so the reserve is the judges' 6 left plus their own floor of 20.
  assert.equal(await g.floorOf("judge"), 20);
  assert.equal(await g.floorOf("public"), Math.max(120, 20 + 6));
});
