import "server-only";
import fs from "node:fs/promises";
import path from "node:path";

/**
 * Where sealed fitter links live. Only ciphertext ever reaches this module: the browser encrypts
 * with AES-GCM and keeps the key in the link's #fragment, which browsers never send to a server.
 *
 * Production: a Google Cloud Storage bucket reached keylessly — the function's Vercel OIDC token is
 * exchanged at Google's STS (workload identity federation), so no key exists anywhere.
 * Local development: files under .data/.
 */

type Store = {
  read(key: string): Promise<string | null>;
  /** Creates a new object; fails if the key exists. */
  write(key: string, text: string): Promise<void>;
  /** Creates or overwrites. */
  put(key: string, text: string): Promise<void>;
  /** Reads with the object's generation, for a later compare-and-swap. */
  readGen(key: string): Promise<{ text: string; gen: string } | null>;
  /** Writes only if the object is still at `gen` ("0": doesn't exist yet). False if it changed. */
  putIf(key: string, text: string, gen: string): Promise<boolean>;
  /** Keys under a prefix, at most 1000. */
  list(prefix: string): Promise<string[]>;
  /** Deletes a key; no error if it is already gone. */
  remove(key: string): Promise<void>;
};

/** Thrown by `write` when the key already exists. */
export class Exists extends Error {}

let token: { value: string; exp: number } | null = null;

async function oidc(): Promise<string> {
  try {
    const mod = (await import("@vercel/oidc").catch(() => null)) as { getVercelOidcToken?: () => Promise<string> } | null;
    if (mod?.getVercelOidcToken) return await mod.getVercelOidcToken();
  } catch {
    /* fall back to the env var */
  }
  const t = process.env.VERCEL_OIDC_TOKEN;
  if (!t) throw new Error("VERCEL_OIDC_TOKEN is not set");
  return t;
}

async function accessToken(): Promise<string> {
  if (token && token.exp - 300 > Date.now() / 1000) return token.value;
  const r = await fetch("https://sts.googleapis.com/v1/token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      grantType: "urn:ietf:params:oauth:grant-type:token-exchange",
      audience: process.env.GCS_WIF_AUDIENCE,
      scope: "https://www.googleapis.com/auth/devstorage.read_write",
      requestedTokenType: "urn:ietf:params:oauth:token-type:access_token",
      subjectTokenType: "urn:ietf:params:oauth:token-type:jwt",
      subjectToken: await oidc(),
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!r.ok) throw new Error(`GCS federation: HTTP ${r.status}`);
  const j = (await r.json()) as { access_token: string; expires_in: number };
  token = { value: j.access_token, exp: Math.floor(Date.now() / 1000) + j.expires_in };
  return token.value;
}

function gcs(bucket: string): Store {
  const b = encodeURIComponent(bucket);
  // ifGenerationMatch: "0" = create only, a generation = compare-and-swap. False on 412.
  const up = async (key: string, text: string, gen?: string) => {
    const q = new URLSearchParams({ uploadType: "media", name: key });
    if (gen !== undefined) q.set("ifGenerationMatch", gen);
    const r = await fetch(`https://storage.googleapis.com/upload/storage/v1/b/${b}/o?${q}`, {
      method: "POST", headers: { authorization: `Bearer ${await accessToken()}`, "content-type": "text/plain" }, body: text, signal: AbortSignal.timeout(20_000),
    });
    if (r.status === 412) return false;
    if (!r.ok) throw new Error(`GCS write: HTTP ${r.status}`);
    return true;
  };
  const get = async (key: string) => {
    const r = await fetch(`https://storage.googleapis.com/storage/v1/b/${b}/o/${encodeURIComponent(key)}?alt=media`, {
      headers: { authorization: `Bearer ${await accessToken()}` }, cache: "no-store", signal: AbortSignal.timeout(15_000),
    });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`GCS read: HTTP ${r.status}`);
    return { text: await r.text(), gen: r.headers.get("x-goog-generation") ?? "" };
  };
  return {
    async read(key) {
      return (await get(key))?.text ?? null;
    },
    async write(key, text) {
      if (!(await up(key, text, "0"))) throw new Exists(key);
    },
    async put(key, text) {
      await up(key, text);
    },
    async readGen(key) {
      const o = await get(key);
      if (o && !o.gen) throw new Error("GCS read: no generation");
      return o;
    },
    putIf: (key, text, gen) => up(key, text, gen),
    async list(prefix) {
      const q = new URLSearchParams({ prefix, maxResults: "1000", fields: "items(name)" });
      const r = await fetch(`https://storage.googleapis.com/storage/v1/b/${b}/o?${q}`, {
        headers: { authorization: `Bearer ${await accessToken()}` }, cache: "no-store", signal: AbortSignal.timeout(15_000),
      });
      if (!r.ok) throw new Error(`GCS list: HTTP ${r.status}`);
      return (((await r.json()) as { items?: { name: string }[] }).items ?? []).map((o) => o.name);
    },
    async remove(key) {
      const r = await fetch(`https://storage.googleapis.com/storage/v1/b/${b}/o/${encodeURIComponent(key)}`, {
        method: "DELETE", headers: { authorization: `Bearer ${await accessToken()}` }, signal: AbortSignal.timeout(15_000),
      });
      if (!r.ok && r.status !== 404) throw new Error(`GCS delete: HTTP ${r.status}`);
    },
  };
}

function files(): Store {
  const dir = path.join(process.cwd(), ".data");
  const file = (key: string) => path.join(dir, key.replace(/[^\w.-]/g, "_"));
  // Local development is one process, so a modification time is a good enough generation.
  const gen = (f: string) => fs.stat(f).then((st) => String(st.mtimeMs), () => "0");
  return {
    async read(key) {
      return fs.readFile(file(key), "utf8").catch(() => null);
    },
    async write(key, text) {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(file(key), text, { flag: "wx" }).catch((e) => { throw e?.code === "EEXIST" ? new Exists(key) : e; });
    },
    async put(key, text) {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(file(key), text);
    },
    async readGen(key) {
      const g = await gen(file(key));
      const text = await fs.readFile(file(key), "utf8").catch(() => null);
      return text == null ? null : { text, gen: g };
    },
    async putIf(key, text, want) {
      if ((await gen(file(key))) !== want) return false;
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(file(key), text);
      return true;
    },
    async list(prefix) {
      const flat = path.basename(file(prefix + "x")).slice(0, -1);
      const names = await fs.readdir(dir).catch(() => [] as string[]);
      return names.filter((n) => n.startsWith(flat)).map((n) => prefix + n.slice(flat.length)).slice(0, 1000);
    },
    async remove(key) {
      await fs.rm(file(key), { force: true });
    },
  };
}

let chosen: Store | null = null;
export function store(): Store {
  chosen ??= process.env.GCS_BUCKET && process.env.GCS_WIF_AUDIENCE ? gcs(process.env.GCS_BUCKET) : files();
  return chosen;
}
