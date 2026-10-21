"use client";

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
};

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
    return JSON.parse(new TextDecoder().decode(plain));
  } catch {
    throw new Error("This link's key doesn't match. Copy the whole link, including everything after #.");
  }
}
