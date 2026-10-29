// Checks the unit costs Hairloom assumes (lib/kinds.ts) against YouCam's own feature-cost list.
// GET /s2s/v2.0/credit/feature-cost is a read: it starts no task. The script reads the unit balance
// before and after and refuses to write a result if the balance moved.
//
//   node --env-file=<file with YOUCAM_API_KEY> --import tsx scripts/check-costs.mjs
//
// Writes data/feature-costs.json, which the evidence page shows. Prints no key and no balance.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { KINDS } from "../lib/kinds.ts";

const BASE = "https://yce-api-01.makeupar.com";
const KEY = process.env.YOUCAM_API_KEY;
if (!KEY) { console.error("Set YOUCAM_API_KEY (for example with node --env-file)."); process.exit(1); }
const auth = { Authorization: `Bearer ${KEY}` };

/** Where one path has several SKUs, the one Hairloom's request is billed as. */
const VARIANT = {
  "/s2s/v2.1/task/hair-transfer": /\(Custom\)/,
  "/s2s/v2.1/task/skin-analysis": /SD \(1-4 concerns\)/, // four concerns, standard definition
  "/s2s/v2.0/task/face-attr-analysis": /\(1-5 features\)/, // five features
  "/s2s/v2.0/task/hair-color": /\(Full\)/, // pattern "full"
};

async function get(p) {
  const r = await fetch(BASE + p, { headers: auth });
  if (!r.ok) throw new Error(`${p}: HTTP ${r.status}`);
  return r.json();
}
const balance = async () => (await get("/s2s/v1.0/client/credit")).results.reduce((s, x) => s + (x.amount_dec ?? x.amount ?? 0), 0);

const before = await balance();
const skus = [];
let token = null;
for (let page = 0; page < 30; page++) {
  const q = new URLSearchParams({ page_size: "20", ...(token ? { starting_token: token } : {}) });
  const j = await get(`/s2s/v2.0/credit/feature-cost?${q}`);
  skus.push(...(j.result?.skus ?? []));
  token = j.result?.next_token;
  if (!token) break;
}
const after = await balance();
const spent = Math.round((before - after) * 100) / 100;

const rows = Object.entries(KINDS).map(([kind, k]) => {
  const all = skus.filter((s) => s.run_task_url.replace(BASE, "") === k.path);
  const pick = all.find((s) => (VARIANT[k.path] ?? /./).test(s.description)) ?? (all.length === 1 ? all[0] : null);
  return { kind, api: k.api, path: k.path, ours: k.units, youcam: pick?.amount ?? null, sku: pick?.description ?? null, ok: pick ? pick.amount === k.units : false };
});

const out = { checked: new Date().toISOString(), endpoint: "GET /s2s/v2.0/credit/feature-cost", skus: skus.length, unitsSpentByCheck: spent, rows };
for (const r of rows) console.log(`${r.ok ? "same" : "DIFF"}  ${r.kind.padEnd(10)} ours ${r.ours}  youcam ${r.youcam ?? "?"}  ${r.sku ?? "no matching SKU"}`);
console.log(`${skus.length} SKUs read; units spent by this check: ${spent}`);
if (spent !== 0) { console.error("The balance moved during the check (another task may have run). Not writing a result; run it again."); process.exit(2); }
const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "feature-costs.json");
fs.writeFileSync(file, JSON.stringify(out, null, 1) + "\n");
console.log("wrote", path.relative(process.cwd(), file));
if (rows.some((r) => !r.ok)) process.exit(3);
