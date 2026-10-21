"use client";

// The visitor's own passport and try-ons live only in this browser (IndexedDB).
// Every call is wrapped: private windows and blocked storage fall back to memory.

import type { Cap, Readings } from "./demo";

export type Render = { src: string; api: string; units: number; ms: number; at: number; dE?: number | null };

export type Session = {
  mode: "demo" | "live";
  personaId?: string;
  name: string;
  kept?: string; // front photo (data URL or demo URL)
  turns?: string[]; // [facing image-right, facing image-left]
  readings?: Readings;
  colour?: { lab: [number, number, number]; hex: string } | null;
  keptAt?: number;
  today?: string; // photo after hair loss, if the person has one
  base?: "kept" | "today"; // which photo try-ons are placed on
  later?: string; // label for the later photo ("Week 4", "Today")
  situation?: "chemo" | "alopecia" | "other";
  fit?: "Women" | "Men";
  cap?: Cap;
  consent?: number;
  /** When a fitter link was last made, so the Share step shows as done. */
  sharedAt?: number;
  renders: Record<string, Render>;
  shortlist: string[];
  note: string;
  unitsSpent: number;
};

const DB = "hairloom";
const STORE = "kv";
let mem: Record<string, unknown> = {};

function open(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export async function get<T>(key: string): Promise<T | undefined> {
  try {
    const db = await open();
    return await new Promise<T | undefined>((res, rej) => {
      const q = db.transaction(STORE).objectStore(STORE).get(key);
      q.onsuccess = () => res(q.result as T | undefined);
      q.onerror = () => rej(q.error);
    });
  } catch {
    return mem[key] as T | undefined;
  }
}

export async function set(key: string, value: unknown): Promise<void> {
  mem[key] = value;
  try {
    const db = await open();
    await new Promise<void>((res, rej) => {
      const t = db.transaction(STORE, "readwrite");
      t.objectStore(STORE).put(value, key);
      t.oncomplete = () => res();
      t.onerror = () => rej(t.error);
    });
  } catch {
    /* memory only */
  }
}

export async function erase(): Promise<void> {
  mem = {};
  try {
    const db = await open();
    await new Promise<void>((res) => {
      const t = db.transaction(STORE, "readwrite");
      t.objectStore(STORE).clear();
      t.oncomplete = () => res();
      t.onerror = () => res();
    });
  } catch {
    /* nothing stored */
  }
}

export const emptySession = (mode: Session["mode"], name = "You"): Session => ({ mode, name, renders: {}, shortlist: [], note: "", unitsSpent: 0 });
