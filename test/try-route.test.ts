import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { dataUrl, jpeg } from "./fixtures.ts";

// /api/try end to end against a fake YouCam: global fetch is stubbed, so no real task is ever created.
process.env.YOUCAM_API_KEY = "fake-key-for-tests";
process.env.HANDLE_SECRET = "test-handle-secret";
process.env.JUDGE_CODE = "test-judge-code";
process.env.UNIT_FLOOR = "10";

type Route = typeof import("../app/api/try/route.ts");
let route: Route;
let NextRequest: typeof import("next/server").NextRequest;
const realFetch = globalThis.fetch;
const calls: string[] = [];
let outcome: "running" | "error" | "success" = "error";
let taskNo = 0;

before(async () => {
  process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), "hairloom-route-")));
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    const method = init?.method ?? "GET";
    calls.push(`${method} ${url.replace(/^https:\/\/[^/]+/, "")}`);
    const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    if (url.endsWith("/s2s/v1.0/client/credit")) return json({ results: [{ amount_dec: 500 }] });
    if (url.endsWith("/s2s/v2.0/file")) return json({ data: { files: [{ file_id: "file-1", requests: [{ url: "https://upload.test/put", headers: {} }] }] } });
    if (url === "https://upload.test/put") return new Response(null, { status: 200 });
    if (url.endsWith("/s2s/v2.0/task/delete")) return json({ status: 200 });
    if (/\/task\/[\w-]+$/.test(url) && method === "POST") return json({ data: { task_id: `task-${++taskNo}` } });
    if (/\/task\/[\w-]+\/task-\d+$/.test(url)) {
      if (outcome === "running") return json({ data: { task_status: "running" } });
      if (outcome === "error") return json({ data: { task_status: "error", error: "error_no_face" } });
      return json({ data: { task_status: "success", results: { hair_length: { term: "long hair" } } } });
    }
    throw new Error(`unexpected fetch ${url}`);
  }) as typeof fetch;
  ({ NextRequest } = await import("next/server"));
  route = await import("../app/api/try/route.ts");
});
after(() => { globalThis.fetch = realFetch; });

const photo = dataUrl(jpeg(768, 1024));
const ip = () => `192.0.2.${Math.floor(Math.random() * 250)}`;
const post = (body: unknown, headers: Record<string, string> = {}) =>
  route.POST(new NextRequest("http://localhost/api/try", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json", "x-forwarded-for": ip(), ...headers } }));
const poll = (h: string) => route.GET(new NextRequest(`http://localhost/api/try?h=${encodeURIComponent(h)}`, { headers: { "x-forwarded-for": ip() } }));
const del = (h: string) => route.DELETE(new NextRequest(`http://localhost/api/try?h=${encodeURIComponent(h)}`, { method: "DELETE", headers: { "x-forwarded-for": ip() } }));
const used = (name: string) => { try { return JSON.parse(fs.readFileSync(path.join(".data", name), "utf8")).used as number; } catch { return 0; } };
const today = () => new Date().toISOString().slice(0, 10);
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("junk images and loose options are refused before any unit or YouCam call", async () => {
  calls.length = 0;
  for (const [body, code] of [
    [{ kind: "hairLength", images: ["data:image/jpeg;base64,AAAA"] }, "bad_images"],
    [{ kind: "hairLength", images: [`data:image/jpeg;base64,${Buffer.alloc(12_000, 7).toString("base64")}`] }, "bad_images"],
    [{ kind: "hairColor", images: [photo], opt: { hex: ["#123456"] } }, "bad_option"],
    [{ kind: "hairColor", images: [photo], opt: ["#123456"] }, "bad_option"],
    [{ kind: "hairLength", images: [photo] }, "bad_judge_code"],
  ] as const) {
    const r = await post(body, code === "bad_judge_code" ? { "x-judge-code": "guess" } : {});
    assert.equal((await r.json()).code, code);
  }
  assert.deepEqual(calls, [], "nothing reached YouCam");
  assert.equal(used(`budget_${today()}.json`), 0);
});

test("a task YouCam fails refunds the day's units, and its handle is dead afterwards", async () => {
  outcome = "error";
  const r = await post({ kind: "hairLength", images: [photo] });
  const s = await r.json();
  assert.equal(s.ok, true);
  assert.equal(used(`budget_${today()}.json`), 2, "reserved on start");

  calls.length = 0;
  const p = await (await poll(s.handle)).json();
  assert.equal(p.status, "error");
  assert.equal(used(`budget_${today()}.json`), 0, "refunded: YouCam charges only on success");
  assert.equal(calls.filter((c) => c.endsWith("/task/delete")).length, 1, "the failed task was deleted");

  await wait(1600); // past the per-handle poll throttle
  calls.length = 0;
  const again = await poll(s.handle);
  assert.equal(again.status, 410);
  assert.equal((await del(s.handle)).status, 410);
  assert.deepEqual(calls, [], "ended handles never reach YouCam");
});

test("after success, polls are refused and one delete goes through", async () => {
  outcome = "success";
  const s = await (await post({ kind: "hairLength", images: [photo] })).json();
  const p = await (await poll(s.handle)).json();
  assert.equal(p.status, "success");
  assert.equal(used(`budget_${today()}.json`), 2, "a success keeps its units");
  await wait(1600);
  calls.length = 0;
  assert.equal((await poll(s.handle)).status, 410);
  assert.deepEqual((await (await del(s.handle)).json()), { ok: true });
  assert.equal((await del(s.handle)).status, 429, "deletes are throttled per handle");
  assert.equal(calls.filter((c) => c.endsWith("/task/delete")).length, 1);
});

test("a tab-closing beacon (POST with _method=DELETE) deletes a running task", async () => {
  outcome = "running";
  const s = await (await post({ kind: "hairLength", images: [photo] })).json();
  calls.length = 0;
  const r = await route.POST(new NextRequest(`http://localhost/api/try?h=${encodeURIComponent(s.handle)}&_method=DELETE`, { method: "POST", headers: { "x-forwarded-for": ip() } }));
  assert.deepEqual(await r.json(), { ok: true });
  assert.deepEqual(calls, ["POST /s2s/v2.0/task/delete"]);
  assert.equal((await poll(s.handle)).status, 410);
});

test("the judge lane draws on its own daily counter", async () => {
  outcome = "running";
  const before = used(`budget_${today()}.json`);
  const s = await (await post({ kind: "hairLength", images: [photo] }, { "x-judge-code": "test-judge-code" })).json();
  assert.equal(s.ok, true);
  assert.equal(used(`budget_${today()}-judge.json`), 2);
  assert.equal(used(`budget_${today()}.json`), before, "public allowance untouched");
});
