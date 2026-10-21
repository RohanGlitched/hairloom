"use client";

import { z } from "zod";

// End-to-end sealing for fitter links: AES-GCM-256 in the browser, key carried in the URL fragment.

const b64u = (b: ArrayBuffer | Uint8Array) => {
  const bytes = b instanceof Uint8Array ? b : new Uint8Array(b);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

export type SharePayload = {
  v: 1;
  name: string;
  keptAt: number;
  kept: string; // small JPEG data URL
  readings: unknown;
  colour: { hex: string; code: string; name: string; dE: number } | null;
  looks: { key: string; label: string; src: string; detail: string }[];
  note: string;
  appointment?: string;
  cap?: { cm: number | null; parting: "left" | "centre" | "right" | "none" | null };
};

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const jpeg = z.string().regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/).max(1_500_000);
const short = (n: number) => z.string().max(n);
/** A decrypted share is still untrusted input: anyone can seal anything. */
export const PayloadSchema = z.object({
  v: z.literal(1),
  name: short(80),
  keptAt: z.number().finite(),
  kept: jpeg,
  readings: z.object({
    type: z.object({ mapping: short(20), term: short(60) }).nullable(),
    frizz: z.object({ mapping: z.number(), term: short(60) }).nullable(),
    length: z.object({ term: short(60) }).nullable(),
    face: z.object({
      faceshape: short(30).optional(),
      eyebrow: z.record(z.string(), short(40)).optional(),
      color: z.object({ eyebrow_color: hex.optional(), hair_color: hex.optional(), hair_color_name: short(30).optional() }).partial().optional(),
    }).passthrough().nullable(),
  }),
  colour: z.object({ hex, code: short(8), name: short(40), dE: z.number().finite() }).nullable(),
  looks: z.array(z.object({ key: short(60), label: short(80), src: jpeg, detail: short(200) })).max(6),
  note: short(1200),
  appointment: short(40).optional(),
  cap: z.object({ cm: z.number().min(40).max(70).nullable(), parting: z.enum(["left", "centre", "right", "none"]).nullable() }).optional(),
});

export async function seal(payload: SharePayload): Promise<{ id: string; key: string }> {
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(payload)));
  const r = await fetch("/api/share", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ v: 1, iv: b64u(iv), data: b64u(data) }) });
  const j = await r.json().catch(() => ({ ok: false, message: "The server sent an unreadable answer." }));
  if (!j.ok) throw new Error(j.message);
  return { id: j.id, key: b64u(await crypto.subtle.exportKey("raw", key)) };
}

export async function unseal(id: string, keyB64: string): Promise<SharePayload> {
  const r = await fetch(`/api/share?id=${encodeURIComponent(id)}`);
  const j = await r.json();
  if (!r.ok || !j.data) throw new Error(j.message ?? "This link couldn't be opened.");
  const key = await crypto.subtle.importKey("raw", unb64u(keyB64), "AES-GCM", false, ["decrypt"]);
  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64u(j.iv) }, key, unb64u(j.data));
    var raw: unknown = JSON.parse(new TextDecoder().decode(plain));
  } catch {
    throw new Error("This link's key doesn't match. Copy the whole link, including everything after #.");
  }
  const parsed = PayloadSchema.safeParse(raw);
  if (!parsed.success) throw new Error("This link opened, but its contents aren't a Hairloom passport.");
  return parsed.data as SharePayload;
}
