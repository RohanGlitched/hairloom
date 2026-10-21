import "server-only";

// Server-side YouCam API v2 client. The browser never sees the key: it sends images and a
// task kind from a fixed whitelist, and this module builds every request body itself.

const BASE = "https://yce-api-01.makeupar.com";

function key(): string {
  const k = process.env.YOUCAM_API_KEY;
  if (!k) throw new YouCamError("not_configured", "The live studio is not configured on this server.");
  return k;
}

export class YouCamError extends Error {
  constructor(public code: string, message: string, public status = 502) {
    super(message);
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${key()}`, "content-type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const j = (await r.json().catch(() => ({}))) as T & { error?: string; error_code?: string };
  if (!r.ok) {
    if (r.status === 429) throw new YouCamError("rate_limited", "YouCam is busy. Wait a minute and try again.", 429);
    throw new YouCamError(j.error_code ?? `http_${r.status}`, j.error ?? `YouCam answered ${r.status}.`);
  }
  return j;
}

/** Registers a file with YouCam and PUTs the bytes to the pre-signed URL. Returns the file_id. */
export async function upload(bytes: Uint8Array, name = "photo.jpg", type: "image/jpeg" | "image/png" = "image/jpeg"): Promise<string> {
  const reg = await api<{ data: { files: { file_id: string; requests: { url: string; headers: Record<string, string> }[] }[] } }>(
    "/s2s/v2.0/file",
    { method: "POST", body: JSON.stringify({ files: [{ content_type: type, file_name: name, file_size: bytes.length }] }) },
  );
  const f = reg.data.files[0];
  const put = await fetch(f.requests[0].url, { method: "PUT", headers: f.requests[0].headers, body: bytes as BodyInit });
  if (!put.ok) throw new YouCamError("upload_failed", "The photo could not be uploaded to YouCam.");
  return f.file_id;
}

export async function createTask(path: string, body: unknown): Promise<string> {
  const r = await api<{ data: { task_id: string } }>(path, { method: "POST", body: JSON.stringify(body) });
  return r.data.task_id;
}

export type TaskState =
  | { status: "running" }
  | { status: "error"; error: string; message?: string }
  | { status: "success"; results: Record<string, unknown> };

export async function pollTask(path: string, taskId: string): Promise<TaskState> {
  const r = await api<{ data: { task_status: string; error?: string; error_message?: string; results?: Record<string, unknown> } }>(
    `${path}/${encodeURIComponent(taskId)}`,
  );
  const d = r.data;
  if (d.task_status === "success") return { status: "success", results: d.results ?? {} };
  if (d.task_status === "error") return { status: "error", error: d.error ?? "error_inference", message: d.error_message };
  return { status: "running" };
}

/**
 * Deletes a finished task with its input and output files at YouCam. Verified Oct 21: afterwards the
 * result URL returns 404 and the input file can no longer be processed (403).
 */
export async function deleteTask(taskId: string): Promise<boolean> {
  try {
    await api("/s2s/v2.0/task/delete", { method: "POST", body: JSON.stringify({ task_id: taskId }) });
    return true;
  } catch (e) {
    console.warn("youcam task/delete failed", (e as Error).message);
    return false;
  }
}

let creditCache: { at: number; units: number } | null = null;

/** Units left on the account, cached for 20 seconds. */
export async function unitsLeft(): Promise<number> {
  if (creditCache && Date.now() - creditCache.at < 20_000) return creditCache.units;
  const r = await api<{ results: { amount?: number; amount_dec?: number }[] }>("/s2s/v1.0/client/credit");
  const units = Math.floor((r.results ?? []).reduce((s, x) => s + (x.amount_dec ?? x.amount ?? 0), 0));
  creditCache = { at: Date.now(), units };
  return units;
}
