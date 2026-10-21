// Small YouCam API v2 client for experiments: upload, run a task, poll, save.
// Usage: node lab/yc.mjs <feature-path> '<json body>' [label]
//   feature-path like "s2s/v2.0/task/text-to-image/youcam"
//   body values "@file:path.jpg" are uploaded first and replaced by a file_id.
import fs from "node:fs";
import path from "node:path";

const BASE = "https://yce-api-01.makeupar.com";
const env = fs.readFileSync(new URL("../keys/youcam.env", import.meta.url), "utf8");
const KEY = /YOUCAM_API_KEY=(\S+)/.exec(env)[1];
const OUT = new URL("./out/", import.meta.url);
fs.mkdirSync(OUT, { recursive: true });

const auth = { Authorization: `Bearer ${KEY}` };

export async function upload(file) {
  const buf = fs.readFileSync(file);
  const type = file.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
  const r = await fetch(`${BASE}/s2s/v2.0/file`, {
    method: "POST",
    headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify({ files: [{ content_type: type, file_name: path.basename(file), file_size: buf.length }] }),
  }).then((x) => x.json());
  const f = r.data?.files?.[0];
  if (!f) throw new Error("file register failed: " + JSON.stringify(r));
  const req = f.requests[0];
  const put = await fetch(req.url, { method: "PUT", headers: req.headers, body: buf });
  if (!put.ok) throw new Error("upload PUT failed " + put.status);
  return f.file_id;
}

async function resolve(v) {
  if (typeof v === "string" && v.startsWith("@file:")) return upload(v.slice(6));
  if (Array.isArray(v)) return Promise.all(v.map(resolve));
  if (v && typeof v === "object") {
    const o = {};
    for (const [k, x] of Object.entries(v)) o[k] = await resolve(x);
    return o;
  }
  return v;
}

export async function run(feature, body, { pollMs = 4000, timeoutMs = 240000 } = {}) {
  const t0 = Date.now();
  const resolved = await resolve(body);
  const c = await fetch(`${BASE}/${feature}`, {
    method: "POST",
    headers: { ...auth, "content-type": "application/json" },
    body: JSON.stringify(resolved),
  }).then((x) => x.json());
  const id = c.data?.task_id;
  if (!id) return { created: c, ms: Date.now() - t0 };
  for (;;) {
    await new Promise((r) => setTimeout(r, pollMs));
    const p = await fetch(`${BASE}/${feature}/${encodeURIComponent(id)}`, { headers: auth }).then((x) => x.json());
    const st = p.data?.task_status;
    if (st && st !== "running") return { ...p, ms: Date.now() - t0 };
    if (Date.now() - t0 > timeoutMs) return { timeout: true, last: p, ms: Date.now() - t0 };
  }
}

export async function save(label, res) {
  fs.writeFileSync(new URL(`${label}.json`, OUT), JSON.stringify(res, null, 2));
  const urls = [];
  const walk = (o) => {
    if (!o || typeof o !== "object") return;
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === "string" && /^https?:\/\//.test(v) && /url/i.test(k)) urls.push(v);
      else walk(v);
    }
  };
  walk(res.data?.results ?? res.data);
  let i = 0;
  for (const u of urls) {
    const r = await fetch(u);
    if (!r.ok) continue;
    const ct = r.headers.get("content-type") || "";
    const ext = ct.includes("png") ? "png" : ct.includes("zip") ? "zip" : "jpg";
    fs.writeFileSync(new URL(`${label}${urls.length > 1 ? "_" + i : ""}.${ext}`, OUT), Buffer.from(await r.arrayBuffer()));
    i++;
  }
  return urls;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/(\w:)/, "$1"))) {
  const [feature, json, label = "out-" + Date.now()] = process.argv.slice(2);
  const res = await run(feature, JSON.parse(json));
  const urls = await save(label, res);
  const brief = { status: res.data?.task_status ?? res.created?.status, ms: res.ms, error: res.data?.error ?? res.created?.error, urls: urls.length };
  console.log(JSON.stringify(brief));
  if (res.data?.results && !urls.length) console.log(JSON.stringify(res.data.results).slice(0, 1500));
}
