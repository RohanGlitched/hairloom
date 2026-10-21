"use client";

import type { KindName } from "./kinds";

export type UnitsInfo = { units: number | null; floor: number; live: boolean; dayLeft?: number | null; dayCap?: number; lane?: string };

/* An optional judge code (from the Devpost testing notes) draws on the judges' own daily allowance. */
const JUDGE = "hairloom:judge";
export function judgeCode(): string {
  try { return sessionStorage.getItem(JUDGE) ?? ""; } catch { return ""; }
}
export function setJudgeCode(code: string) {
  try { if (code.trim()) sessionStorage.setItem(JUDGE, code.trim()); else sessionStorage.removeItem(JUDGE); } catch { /* not stored */ }
}
const judged = (h: Record<string, string> = {}): Record<string, string> => {
  const c = judgeCode();
  return c ? { ...h, "x-judge-code": c } : h;
};

export async function fetchUnits(): Promise<UnitsInfo | null> {
  return fetch("/api/units", { headers: judged(), cache: "no-store" })
    .then((r) => r.json())
    .then((u) => ({ units: u.units, floor: u.floor ?? 120, live: !!u.live, dayLeft: u.dayLeft, dayCap: u.dayCap, lane: u.lane }))
    .catch(() => null);
}

/* Tasks still running. If the tab closes, a beacon asks the server to delete them at YouCam. */
const inflight = new Set<string>();
let hooked = false;
function watch(h: string) {
  inflight.add(h);
  if (hooked || typeof window === "undefined") return;
  hooked = true;
  window.addEventListener("pagehide", () => {
    for (const x of inflight) {
      const url = `/api/try?h=${x}&_method=DELETE`;
      if (!navigator.sendBeacon?.(url)) void fetch(url, { method: "POST", keepalive: true }).catch(() => undefined);
    }
    inflight.clear();
  });
}
/** Done with a task: delete it, its photos and outputs at YouCam. */
function drop(h: string) {
  inflight.delete(h);
  void fetch(`/api/try?h=${h}`, { method: "DELETE", keepalive: true }).catch(() => undefined);
}
// Worth another poll after a pause: YouCam's rate limit, a cold start, a network blip.
const transient = (status: number, code?: string) => status === 429 || status >= 500 || !code || code === "rate_limited" || code === "unknown" || /^http_5/.test(code);

export type RunResult =
  | { ok: true; image?: string; results: Record<string, unknown>; units: number; api: string; ms: number }
  | { ok: false; code: string; message: string };

/** Loads an image (file, blob, URL) and returns a JPEG data URL whose long side is at most `max`. */
export async function prepare(src: Blob | string, max = 1024, size?: [number, number]): Promise<string> {
  const url = typeof src === "string" ? src : URL.createObjectURL(src);
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;
    await img.decode();
    const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const [w, h] = size ?? [Math.round(img.naturalWidth * s), Math.round(img.naturalHeight * s)];
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    // With a target size, crop to its aspect ratio (centred) rather than stretch the photo.
    const r = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const sw = w / r, sh = h / r;
    c.getContext("2d")!.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, 0, 0, w, h);
    return c.toDataURL("image/jpeg", 0.9);
  } finally {
    if (typeof src !== "string") URL.revokeObjectURL(url);
  }
}

/** Runs one whitelisted YouCam task through our server and waits for the result. */
export async function runTask(
  kind: KindName,
  images: string[],
  opt: Record<string, string | number> = {},
  onTick?: (secs: number) => void,
): Promise<RunResult> {
  const t0 = Date.now();
  let start: Response;
  try {
    start = await fetch("/api/try", { method: "POST", headers: judged({ "content-type": "application/json" }), body: JSON.stringify({ kind, images, opt }) });
  } catch {
    return { ok: false, code: "offline", message: "We couldn't reach the server. Check your connection and try again." };
  }
  const s = await start.json().catch(() => ({ ok: false, code: "bad_response", message: "The server sent an unreadable answer." }));
  if (!s.ok) return { ok: false, code: s.code, message: s.message };

  const h = encodeURIComponent(s.handle);
  watch(h);
  // Polls every 3 s; transient failures back off (6, 12 s). Three minutes in all, as before.
  const deadline = t0 + 180_000;
  let wait = 4000, fails = 0;
  while (Date.now() + wait < deadline) {
    await new Promise((r) => setTimeout(r, wait));
    onTick?.(Math.round((Date.now() - t0) / 1000));
    let status = 0;
    const p = await fetch(`/api/try?h=${h}`).then((r) => { status = r.status; return r.json(); }).catch(() => null);
    if (!p || (!p.ok && transient(status, p.code))) { fails++; wait = Math.min(12_000, 3000 * 2 ** fails); continue; }
    fails = 0; wait = 3000;
    if (!p.ok) { drop(h); return { ok: false, code: p.code, message: p.message }; }
    if (p.status === "running") continue;
    if (p.status === "error") { inflight.delete(h); return { ok: false, code: p.code, message: p.message }; } // the server already deleted it
    // We hold the result now: ask the server to delete the task and its photos at YouCam.
    drop(h);
    return { ok: true, image: p.image, results: p.results ?? {}, units: s.units, api: s.api, ms: Date.now() - t0 };
  }
  drop(h);
  return { ok: false, code: "timeout", message: "YouCam took longer than three minutes. Try again in a moment." };
}
