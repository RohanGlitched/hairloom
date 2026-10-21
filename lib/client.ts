"use client";

import type { KindName } from "./kinds";

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
    start = await fetch("/api/try", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, images, opt }) });
  } catch {
    return { ok: false, code: "offline", message: "We couldn't reach the server. Check your connection and try again." };
  }
  const s = await start.json().catch(() => ({ ok: false, code: "bad_response", message: "The server sent an unreadable answer." }));
  if (!s.ok) return { ok: false, code: s.code, message: s.message };

  const h = encodeURIComponent(s.handle);
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, i === 0 ? 4000 : 3000));
    onTick?.(Math.round((Date.now() - t0) / 1000));
    const p = await fetch(`/api/try?h=${h}`).then((r) => r.json()).catch(() => null);
    if (!p) continue;
    if (!p.ok) return { ok: false, code: p.code, message: p.message };
    if (p.status === "running") continue;
    if (p.status === "error") return { ok: false, code: p.code, message: p.message };
    // We hold the result now: ask the server to delete the task and its photos at YouCam.
    void fetch(`/api/try?h=${h}`, { method: "DELETE", keepalive: true }).catch(() => undefined);
    return { ok: true, image: p.image, results: p.results ?? {}, units: s.units, api: s.api, ms: Date.now() - t0 };
  }
  void fetch(`/api/try?h=${h}`, { method: "DELETE", keepalive: true }).catch(() => undefined);
  return { ok: false, code: "timeout", message: "YouCam took longer than three minutes. Try again in a moment." };
}
