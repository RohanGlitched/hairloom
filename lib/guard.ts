import "server-only";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { Exists, store } from "./storage";

/**
 * Spend controls for live YouCam runs.
 * - Signed task handles: a poll or delete is only forwarded to YouCam for a task this server created,
 *   and never again once the task has ended.
 * - Reservations: units are reserved synchronously, before any await, so parallel requests can't
 *   all pass the same check; they are released if the task never starts or YouCam fails it.
 * - A daily cap shared by every server instance, kept in storage and updated by compare-and-swap.
 *   Judges get their own lane with their own cap.
 */

/** The key task handles are signed with. Production fails closed without HANDLE_SECRET; it never falls back to the API key. */
let warned = false;
export function handleSecret(): string {
  if (process.env.HANDLE_SECRET) return process.env.HANDLE_SECRET;
  if (process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production") {
    throw new Error("HANDLE_SECRET is not set. Live tasks are off until it is: set it in the project's environment variables.");
  }
  if (!warned) { warned = true; console.warn("HANDLE_SECRET is not set; task handles are signed with a development key."); }
  return "dev-only-secret";
}

export type Lane = "public" | "judge";
export const today = () => new Date().toISOString().slice(0, 10);
const digest = (s: string) => createHash("sha256").update(s).digest();

/** The lane a request draws from: "judge" with the right x-judge-code, null with a wrong one. */
export function laneOf(code: string | null): Lane | null {
  if (!code) return "public";
  const want = process.env.JUDGE_CODE;
  return want && timingSafeEqual(digest(code), digest(want)) ? "judge" : null;
}

export type Handle = { kind: string; taskId: string; lane: Lane; day: string };

export function signHandle(kind: string, taskId: string, lane: Lane = "public", day = today(), ttlS = 600): string {
  const exp = Math.floor(Date.now() / 1000) + ttlS;
  const body = `${kind}.${lane}.${day}.${taskId}.${exp}`;
  const mac = createHmac("sha256", handleSecret()).update(body).digest("base64url").slice(0, 32);
  return Buffer.from(`${body}.${mac}`).toString("base64url");
}

export function readHandle(handle: string): Handle | null {
  let raw: string;
  try { raw = Buffer.from(handle, "base64url").toString("utf8"); } catch { return null; }
  const i = raw.lastIndexOf(".");
  if (i < 0) return null;
  const body = raw.slice(0, i), mac = raw.slice(i + 1);
  const want = createHmac("sha256", handleSecret()).update(body).digest("base64url").slice(0, 32);
  if (mac.length !== want.length || !timingSafeEqual(Buffer.from(mac), Buffer.from(want))) return null;
  const parts = body.split(".");
  const exp = Number(parts.pop());
  const [kind, lane, day] = parts.splice(0, 3);
  const taskId = parts.join(".");
  if (!kind || !taskId || (lane !== "public" && lane !== "judge") || !/^\d{4}-\d{2}-\d{2}$/.test(day) || !(exp > Date.now() / 1000)) return null;
  return { kind, taskId, lane, day };
}

/* Per-visitor hourly budget with synchronous reservation. */
const PER_HOUR = Number(process.env.UNITS_PER_VISITOR_HOUR ?? 60);
const ledger = new Map<string, { at: number; units: number }[]>();

export function reserve(ip: string, units: number, cap = PER_HOUR): (() => void) | null {
  const now = Date.now();
  const rows = (ledger.get(ip) ?? []).filter((r) => now - r.at < 3_600_000);
  if (rows.reduce((s, r) => s + r.units, 0) + units > cap) return null;
  const row = { at: now, units };
  rows.push(row);
  ledger.set(ip, rows);
  return () => { const r = ledger.get(ip); if (r) ledger.set(ip, r.filter((x) => x !== row)); };
}

/* A started task's visitor reservation, so it can be released if YouCam fails the task. */
const started = new Map<string, { at: number; release: () => void }>();
export function track(taskId: string, release: () => void) {
  const now = Date.now();
  started.set(taskId, { at: now, release });
  if (started.size > 2000) for (const [k, v] of started) if (now - v.at > 3_600_000) started.delete(k);
}
export function untrack(taskId: string): (() => void) | undefined {
  const r = started.get(taskId);
  started.delete(taskId);
  return r?.release;
}

/* Units in flight on this instance, subtracted from the live balance before the floor check. */
let pending = 0;
export function hold(units: number) { pending += units; return () => { pending = Math.max(0, pending - units); }; }
export const held = () => pending;

/* Daily caps across instances: a counter object per lane and UTC day, changed by compare-and-swap. */
const CAP: Record<Lane, number> = { public: Number(process.env.GLOBAL_DAILY_UNITS ?? 120), judge: Number(process.env.JUDGE_DAILY_UNITS ?? 300) };
export const dayCap = (lane: Lane) => CAP[lane];
const dayKey = (lane: Lane, day: string) => `budget/${day}${lane === "judge" ? "-judge" : ""}.json`;

let queue: Promise<unknown> = Promise.resolve();
/** Adds `delta` to a counter unless it would pass `cap`. Serialised on this instance; retried on a lost race. */
export function bump(key: string, delta: number, cap: number): Promise<{ ok: boolean; used: number }> {
  const run = async () => {
    for (let i = 0; i < 6; i++) {
      const cur = await store().readGen(key);
      const used = cur ? Number(JSON.parse(cur.text).used) || 0 : 0;
      if (delta > 0 && used + delta > cap) return { ok: false, used };
      const next = Math.max(0, used + delta);
      if (await store().putIf(key, JSON.stringify({ used: next, at: Date.now() }), cur?.gen ?? "0")) return { ok: true, used: next };
      await new Promise((r) => setTimeout(r, 25 + Math.random() * 100));
    }
    throw new Error("counter busy");
  };
  const p = queue.then(run);
  queue = p.catch(() => undefined);
  return p;
}

export async function dailyAllows(units: number, lane: Lane = "public", day = today()): Promise<{ ok: boolean; used: number; cap: number; charged: boolean }> {
  try {
    const r = await bump(dayKey(lane, day), units, CAP[lane]);
    return { ...r, cap: CAP[lane], charged: r.ok };
  } catch (e) {
    console.warn("daily counter unavailable; falling back to the per-visitor and floor checks", (e as Error).message);
    return { ok: true, used: -1, cap: CAP[lane], charged: false };
  }
}

/** Gives units back to a day's counter: YouCam charges only for tasks that succeed. */
export async function refundDay(units: number, lane: Lane, day: string) {
  await bump(dayKey(lane, day), -units, Infinity).catch(() => undefined);
}

/*
 * Unit floors: the live balance a lane may not draw below. The public floor also keeps back what
 * judges may still use today (up to JUDGE_RESERVE_UNITS), so the public lane can't starve the judges.
 */
const FLOOR = Number(process.env.UNIT_FLOOR ?? 120);
const JUDGE_FLOOR = Number(process.env.JUDGE_UNIT_FLOOR ?? 20);
const JUDGE_RESERVE = Number(process.env.JUDGE_RESERVE_UNITS ?? 250);
export async function floorOf(lane: Lane): Promise<number> {
  if (lane === "judge") return JUDGE_FLOOR;
  const judges = await dayLeft("judge");
  return Math.max(FLOOR, JUDGE_FLOOR + Math.min(JUDGE_RESERVE, judges ?? JUDGE_RESERVE));
}

export async function dayLeft(lane: Lane): Promise<number | null> {
  try {
    const text = await store().read(dayKey(lane, today()));
    return Math.max(0, CAP[lane] - (text ? Number(JSON.parse(text).used) || 0 : 0));
  } catch {
    return null;
  }
}

/*
 * Ended tasks. "done": the result was handed over (one DELETE still allowed). "gone": deleted or
 * failed. Either way polls are answered here without calling YouCam. Kept in memory and in storage.
 */
export type End = "done" | "gone";
const ends = new Map<string, End>();
const endKey = (taskId: string) => `ended/${createHash("sha256").update(taskId).digest("base64url").slice(0, 32)}.json`;
const remember = (taskId: string, s: End) => {
  ends.set(taskId, s);
  if (ends.size > 5000) ends.delete(ends.keys().next().value!);
};

export async function endOf(taskId: string): Promise<End | null> {
  const m = ends.get(taskId);
  if (m) return m;
  try {
    const text = await store().read(endKey(taskId));
    const s = text ? JSON.parse(text).s : null;
    if (s === "done" || s === "gone") { remember(taskId, s); return s; }
  } catch {
    /* storage down: rely on memory */
  }
  return null;
}

/** Records that a task ended. True only for the first record of it, so a refund happens once. */
export async function markEnd(taskId: string, s: End): Promise<boolean> {
  const first = !ends.has(taskId);
  remember(taskId, s);
  const text = JSON.stringify({ s, at: Date.now() });
  try {
    await store().write(endKey(taskId), text);
    return first;
  } catch (e) {
    if (!(e instanceof Exists)) return first;
    if (s === "gone") await store().put(endKey(taskId), text).catch(() => undefined);
    return false;
  }
}

/* Throttles: one poll per handle every 1.5 s, one delete per handle every 5 s, 30 calls a minute per visitor. */
const last = new Map<string, number>();
export function pollAllowed(handle: string, gapMs = 1500): boolean {
  const now = Date.now();
  if (now - (last.get(handle) ?? 0) < gapMs) return false;
  last.set(handle, now);
  if (last.size > 5000) for (const [k, t] of last) if (now - t > 600_000) last.delete(k);
  return true;
}

const calls = new Map<string, number[]>();
export function visitorAllowed(ip: string, perMinute = 30): boolean {
  const now = Date.now();
  const rows = (calls.get(ip) ?? []).filter((t) => now - t < 60_000);
  if (rows.length >= perMinute) return false;
  rows.push(now);
  calls.set(ip, rows);
  if (calls.size > 5000) for (const [k, r] of calls) if (!r.some((t) => now - t < 60_000)) calls.delete(k);
  return true;
}
