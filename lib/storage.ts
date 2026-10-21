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
};

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
  const up = async (key: string, text: string, createOnly: boolean) => {
    const q = new URLSearchParams({ uploadType: "media", name: key });
    if (createOnly) q.set("ifGenerationMatch", "0");
    const r = await fetch(`https://storage.googleapis.com/upload/storage/v1/b/${b}/o?${q}`, {
      method: "POST", headers: { authorization: `Bearer ${await accessToken()}`, "content-type": "text/plain" }, body: text, signal: AbortSignal.timeout(20_000),
    });
    if (!r.ok) throw new Error(`GCS write: HTTP ${r.status}`);
  };
  return {
    async read(key) {
      const r = await fetch(`https://storage.googleapis.com/storage/v1/b/${b}/o/${encodeURIComponent(key)}?alt=media`, {
        headers: { authorization: `Bearer ${await accessToken()}` }, cache: "no-store", signal: AbortSignal.timeout(15_000),
      });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(`GCS read: HTTP ${r.status}`);
      return r.text();
    },
    async write(key, text) {
      await up(key, text, true);
    },
    async put(key, text) {
      await up(key, text, false);
    },
  };
}

function files(): Store {
  const dir = path.join(process.cwd(), ".data");
  return {
    async read(key) {
      return fs.readFile(path.join(dir, key.replace(/[^\w.-]/g, "_")), "utf8").catch(() => null);
    },
    async write(key, text) {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, key.replace(/[^\w.-]/g, "_")), text, { flag: "wx" });
    },
    async put(key, text) {
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(path.join(dir, key.replace(/[^\w.-]/g, "_")), text);
    },
  };
}

let chosen: Store | null = null;
export function store(): Store {
  chosen ??= process.env.GCS_BUCKET && process.env.GCS_WIF_AUDIENCE ? gcs(process.env.GCS_BUCKET) : files();
  return chosen;
}
