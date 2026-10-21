import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { store } from "./storage";

/**
 * Spend controls for live YouCam runs.
 * - Signed task handles: a poll or delete is only forwarded to YouCam for a task this server created.
 * - Reservations: units are reserved synchronously, before any await, so parallel requests can't
 *   all pass the same check; they are released if the task never starts.
 * - A global daily cap shared by every server instance, kept in storage.
 */

const SECRET = process.env.HANDLE_SECRET ?? process.env.YOUCAM_API_KEY ?? "dev-only-secret";

export function signHandle(kind: string, taskId: string, ttlS = 3600): string {
  const exp = Math.floor(Date.now() / 1000) + ttlS;
  const body = `${kind}.${taskId}.${exp}`;
  const mac = createHmac("sha256", SECRET).update(body).digest("base64url").slice(0, 32);
  return Buffer.from(`${body}.${mac}`).toString("base64url");
}

export function readHandle(handle: string): { kind: string; taskId: string } | null {
  let raw: string;
  try { raw = Buffer.from(handle, "base64url").toString("utf8"); } catch { return null; }
  const i = raw.lastIndexOf(".");
  if (i < 0) return null;
  const body = raw.slice(0, i), mac = raw.slice(i + 1);
  const want = createHmac("sha256", SECRET).update(body).digest("base64url").slice(0, 32);
  if (mac.length !== want.length || !timingSafeEqual(Buffer.from(mac), Buffer.from(want))) return null;
  const parts = body.split(".");
  const exp = Number(parts.pop());
  const kind = parts.shift()!;
  const taskId = parts.join(".");
  if (!kind || !taskId || !(exp > Date.now() / 1000)) return null;
  return { kind, taskId };
}

/* Per-visitor hourly budget with synchronous reservation. */
const PER_HOUR = Number(process.env.UNITS_PER_VISITOR_HOUR ?? 60);
const ledger = new Map<string, { at: number; units: number }[]>();

export function reserve(ip: string, units: number): (() => void) | null {
  const now = Date.now();
  const rows = (ledger.get(ip) ?? []).filter((r) => now - r.at < 3_600_000);
  if (rows.reduce((s, r) => s + r.units, 0) + units > PER_HOUR) return null;
  const row = { at: now, units };
  rows.push(row);
  ledger.set(ip, rows);
  return () => { const r = ledger.get(ip); if (r) ledger.set(ip, r.filter((x) => x !== row)); };
}

/* Units in flight on this instance, subtracted from the live balance before the floor check. */
let pending = 0;
export function hold(units: number) { pending += units; return () => { pending = Math.max(0, pending - units); }; }
export const held = () => pending;

/* Global daily cap across instances, stored as a tiny counter object (best effort, no lock). */
const DAILY = Number(process.env.GLOBAL_DAILY_UNITS ?? 200);
export async function dailyAllows(units: number): Promise<{ ok: boolean; used: number; cap: number }> {
  const key = `budget/${new Date().toISOString().slice(0, 10)}.json`;
  try {
    const text = await store().read(key);
    const used = text ? Number(JSON.parse(text).used) || 0 : 0;
    if (used + units > DAILY) return { ok: false, used, cap: DAILY };
    await store().put(key, JSON.stringify({ used: used + units, at: Date.now() }));
    return { ok: true, used: used + units, cap: DAILY };
  } catch {
    return { ok: true, used: -1, cap: DAILY }; // storage down: fall back to the per-visitor and floor checks
  }
}

/* Poll throttle: one poll per task handle every 1.5 s. */
const lastPoll = new Map<string, number>();
export function pollAllowed(handle: string): boolean {
  const now = Date.now();
  const last = lastPoll.get(handle) ?? 0;
  if (now - last < 1500) return false;
  lastPoll.set(handle, now);
  if (lastPoll.size > 5000) for (const [k, t] of lastPoll) if (now - t > 600_000) lastPoll.delete(k);
  return true;
}
