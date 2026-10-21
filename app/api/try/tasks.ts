import "server-only";
import { createHash } from "node:crypto";
import { KINDS, isKind, type KindName } from "@/lib/kinds";
import { YouCamError, deleteTask, pollTask, type Call, type TaskState } from "@/lib/youcam";
import { endOf, markEnd, refundDay, untrack, type Handle } from "@/lib/guard";
import { store } from "@/lib/storage";

/*
 * A task's life on the server, whether or not the browser comes back for it.
 * A handle names one YouCam task, or several that read the same uploaded photos ("hairType+hairFrizz",
 * ids joined by "~"). Shared photos are deleted with the task, so a batch is deleted only once every
 * part has finished.
 */

export type Part = { kind: KindName; id: string };
export type Seen = { part: Part; st: TaskState };

export function partsOf(h: Handle): Part[] | null {
  const kinds = h.kind.split("+"), ids = h.taskId.split("~");
  if (kinds.length !== ids.length || kinds.length > 4 || !kinds.every(isKind) || ids.some((x) => !x)) return null;
  return kinds.map((k, i) => ({ kind: k as KindName, id: ids[i] }));
}

/* Records of started tasks, so a sweep can settle the ones nobody came back for. */
const pendingKey = (taskId: string) => `pending/${createHash("sha256").update(taskId).digest("base64url").slice(0, 32)}.json`;
export const addPending = (h: Handle) => store().put(pendingKey(h.taskId), JSON.stringify({ ...h, at: Date.now() })).catch(() => undefined);
export const dropPending = (taskId: string) => store().remove(pendingKey(taskId)).catch(() => undefined);

/* Finished parts of a batch, so a part isn't polled again while its siblings run. Memory only. */
const done = new Map<string, { at: number; st: TaskState }>();
/* When the browser last polled a handle on this instance: the background settle then stays quiet. */
const polled = new Map<string, number>();
export function touch(taskId: string) {
  const now = Date.now();
  polled.set(taskId, now);
  if (polled.size > 2000) for (const [k, t] of polled) if (now - t > 600_000) polled.delete(k);
}

/** YouCam failed a part and charged nothing: the day's units and the visitor's share come back. */
async function refund(p: Part, h: Handle) {
  untrack(p.id)?.();
  await refundDay(KINDS[p.kind].units, h.lane, h.day);
}

/**
 * One look at a task: polls each part that hasn't finished and refunds a failed part exactly once
 * (the first "ended" record wins). Null while a part is still running, unless `all` asks for every state.
 */
export async function look(h: Handle, parts: Part[], call: Call, all = false): Promise<Seen[] | null> {
  const out: Seen[] = [];
  for (const p of parts) {
    let st = done.get(p.id)?.st;
    if (!st && (await endOf(p.id))) st = { status: "error", error: "ended" };
    if (!st) {
      try {
        st = await pollTask(KINDS[p.kind].path, p.id, { ...call, lane: h.lane });
      } catch (e) {
        // The task no longer exists at YouCam, so it can't be charged: refund it like a failure.
        if (!(e instanceof YouCamError && (e.code === "InvalidTaskId" || e.message.includes("InvalidTaskId")))) throw e;
        st = { status: "error", error: "InvalidTaskId" };
      }
      if (st.status === "error" && (await markEnd(p.id, "gone"))) await refund(p, h);
      if (st.status !== "running" && parts.length > 1) {
        done.set(p.id, { at: Date.now(), st });
        if (done.size > 500) for (const [k, v] of done) if (Date.now() - v.at > 600_000) done.delete(k);
      }
    }
    if (st.status === "running" && !all) return null;
    out.push({ part: p, st });
  }
  return out;
}

/** Deletes every part at YouCam with its photos and outputs, and forgets the task. True if all deletes went through. */
export async function finish(h: Handle, parts: Part[]): Promise<boolean> {
  const oks = await Promise.all(parts.map((p) => deleteTask(p.id, { lane: h.lane, wait: 20_000 })));
  await Promise.all(parts.map((p, i) => (oks[i] ? markEnd(p.id, "gone") : undefined)));
  const ok = oks.every(Boolean);
  if (ok) await dropPending(h.taskId);
  return ok;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Runs after POST answers (Next's `after`, which is Vercel's waitUntil): watches the task until it ends
 * or `until`, so a task nobody polls is still refunded and deleted if YouCam fails it. A success is left
 * for the browser to collect; the sweep deletes it if nobody does.
 */
export async function settle(h: Handle, until = Date.now() + 50_000, gap = 5000): Promise<"ended" | "error" | "success" | "running"> {
  const parts = partsOf(h);
  if (!parts) return "ended";
  while (Date.now() + gap < until) {
    await sleep(gap);
    if ((await Promise.all(parts.map((p) => endOf(p.id)))).every(Boolean)) return "ended"; // the browser finished it
    if (Date.now() - (polled.get(h.taskId) ?? 0) < 8000) continue; // the browser is polling: no extra YouCam calls
    const seen = await look(h, parts, { wait: 0 }).catch(() => null);
    if (!seen) continue;
    if (seen.every((s) => s.st.status === "error")) { await finish(h, parts); return "error"; }
    return "success";
  }
  return "running";
}

const TTL = 660_000; // a handle lives 10 minutes; a minute's grace
const QUIET = 120_000; // younger tasks are left to the browser and the background settle

/** Settles started tasks from storage: refunds failures, deletes anything whose handle has expired. */
export async function sweep(now = Date.now(), budget = 45_000): Promise<{ pending: number; settled: number; left: number }> {
  const t0 = Date.now();
  const keys = await store().list("pending/");
  let settled = 0, left = 0;
  for (const key of keys) {
    if (Date.now() - t0 > budget) { left++; continue; }
    const rec = JSON.parse((await store().read(key).catch(() => null)) ?? "null") as (Handle & { at: number }) | null;
    const parts = rec && partsOf(rec);
    if (!rec || !parts) { await store().remove(key).catch(() => undefined); continue; }
    const age = now - rec.at;
    if (age < QUIET) { left++; continue; }
    const ends = await Promise.all(parts.map((p) => endOf(p.id)));
    if (ends.every((e) => e === "gone")) { await dropPending(rec.taskId); settled++; continue; }
    const seen = await look(rec, parts, { wait: 3000 }, true).catch(() => null);
    const failed = !!seen && seen.every((s) => s.st.status === "error");
    if ((failed || age > TTL) && (await finish(rec, parts))) settled++;
    else if (age > 86_400_000) { await dropPending(rec.taskId); settled++; } // a day on, stop trying
    else left++;
  }
  return { pending: keys.length, settled, left };
}
