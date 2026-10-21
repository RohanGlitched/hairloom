// Builds data/lab-runs.json, the ledger behind /evidence "Tasks by API", from every YouCam task
// output we kept on disk:
//   ../lab/out/**.json       the demo pipeline (precompute*, catalogue) and early research runs
//   ../lab/real/out/**.json  the real-photograph tests (realtest.mjs)
// Each file is one finished task: { data: { task_status, error }, ms }. Nothing is invented: a task
// with no output file is not in the ledger. Run: node scripts/export-runs.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const LAB = path.resolve(ROOT, "../lab");
const readJson = (f) => JSON.parse(fs.readFileSync(f, "utf8"));

// Product names exactly as lib/kinds.ts spells them, so the site can tell which APIs the studio calls.
const API = {
  type: "AI Hair Type Detection",
  frizz: "AI Hair Frizziness Detection",
  length: "AI Hair Length Detection",
  face: "AI Face Attribute & Ratio Analyzer",
  transfer: "AI Hairstyle Virtual Try-On",
  colour: "AI Hair Color Virtual Try-On",
  i2i: "AI Image Generator (image to image)",
  makeup: "AI Makeup Virtual Try-On",
  vol: "AI Hair Volume Virtual Try-On",
  ext: "AI Hair Extension Virtual Try-On",
  skin: "AI Skin Analysis",
  t2i: "AI Image Generator (text to image)",
  hat: "AI Hat Virtual Try-On",
  scarf: "AI Scarf Virtual Try-On",
  density: "AI Hair Density Detection",
  tone: "AI Facial Color Tones Analyzer",
};

// Units YouCam charges per successful task, from research/costs.jsonl and the pricing page (failed tasks cost 0).
const UNITS = {
  [API.type]: 2, [API.frizz]: 2, [API.length]: 2, [API.face]: 10, [API.transfer]: 2, [API.colour]: 1,
  [API.i2i]: 1, [API.makeup]: 1, [API.vol]: 2, [API.ext]: 1, [API.skin]: 9, [API.t2i]: 1,
  [API.hat]: 2, [API.scarf]: 2, [API.density]: 1, [API.tone]: 20,
};

/** @returns {{ api: string, origin: "demo"|"real-photo"|"research", variant?: string } | null} */
function classify(rel) {
  // Real photographs: lab/real/out/<photo id>/<task>
  let m = /^real\/[^/]+\/(.+)$/.exec(rel);
  if (m) {
    const n = m[1];
    const o = "real-photo";
    if (n === "face") return { api: API.face, origin: o, variant: "default strictness" };
    if (n === "face_flexible") return { api: API.face, origin: o, variant: "flexible strictness" };
    if (n === "length") return { api: API.length, origin: o };
    if (n.startsWith("wig_")) return { api: API.transfer, origin: o };
    if (n === "head_turban") return { api: API.i2i, origin: o };
    if (n === "brows") return { api: API.makeup, origin: o };
    return null;
  }
  // The four demo people: lab/out/demo/<id>/<task>
  m = /^demo\/[^/]+\/(.+)$/.exec(rel);
  if (m) {
    // Runs set aside in demo/<id>/unused/ (results we chose not to show) still count; v1 and kept are earlier attempts.
    const n = m[1].replace(/^unused\//, "").replace(/_(v1|kept)$/, "").replace(/^thin_kept_/, "thin_");
    const o = "demo";
    if (n === "face") return { api: API.face, origin: o, variant: "default strictness" };
    if (n === "hair_type") return { api: API.type, origin: o };
    if (n === "hair_frizz") return { api: API.frizz, origin: o };
    if (n === "hair_length") return { api: API.length, origin: o };
    if (/^(wig_|withhair_)/.test(n) || n === "own") return { api: API.transfer, origin: o };
    if (/^(turn_[ab]|bald|thinning|head_\w+)$/.test(n)) return { api: API.i2i, origin: o };
    if (n === "brows") return { api: API.makeup, origin: o };
    if (n.startsWith("shade_")) return { api: API.colour, origin: o };
    if (n === "thin_vol" || n.startsWith("thin_female_")) return { api: API.vol, origin: o };
    if (n === "thin_ext" || n.startsWith("thin_all_length_")) return { api: API.ext, origin: o };
    if (/^skin_wk\d$/.test(n)) return { api: API.skin, origin: o };
    return null;
  }
  if (rel.startsWith("cat/")) return { api: API.t2i, origin: "demo" }; // the boutique's stock
  // Early research and the demo people's source photos: lab/out/<task>
  if (/^persona\d$/.test(rel)) return { api: API.t2i, origin: "demo" };
  const o = "research";
  if (/^prod_/.test(rel)) return { api: API.t2i, origin: o };
  if (/^(ang_|bald1$|p1_bald$|p1_turban$|i2i_turban$)/.test(rel)) return { api: API.i2i, origin: o };
  if (/^d_dens/.test(rel)) return { api: API.density, origin: o };
  if (rel === "d_face_p1") return { api: API.face, origin: o, variant: "default strictness" };
  if (/^d_frizz/.test(rel)) return { api: API.frizz, origin: o };
  if (rel === "d_len_p1") return { api: API.length, origin: o };
  if (rel === "d_tone_p1") return { api: API.tone, origin: o };
  if (rel === "d_type_p2") return { api: API.type, origin: o };
  if (rel === "m_brow_bald") return { api: API.makeup, origin: o };
  if (rel === "p1_restored" || /^t_hair_/.test(rel)) return { api: API.transfer, origin: o };
  if (rel === "skin_test") return { api: API.skin, origin: o };
  if (rel === "t_hat_bald" || rel === "t_turban_bald") return { api: API.hat, origin: o };
  if (rel === "t_scarf_bald") return { api: API.scarf, origin: o };
  return null;
}

const SKIP = new Set(["hair_templates"]); // a template listing, not a task
const runs = [];
const unclassified = [];
const walk = (dir, root, prefix = "") => {
  for (const f of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) { walk(full, root, prefix); continue; }
    if (!f.endsWith(".json")) continue;
    const rel = path.relative(root, full).split(path.sep).join("/").replace(/\.json$/, "");
    if (SKIP.has(rel)) continue;
    const j = readJson(full);
    const c = classify(prefix + rel);
    if (!c || typeof j?.ms !== "number" || !j?.data) { unclassified.push(rel); continue; }
    const name = prefix + rel;
    runs.push({
      name, api: c.api, origin: c.origin, ...(c.variant ? { variant: c.variant } : {}),
      ok: j.data.task_status === "success", error: j.data.error ?? null, ms: j.ms,
    });
  }
};
walk(path.join(LAB, "out"), path.join(LAB, "out"));
walk(path.join(LAB, "real/out"), path.join(LAB, "real/out"), "real/");

const count = (f) => runs.filter(f).length;
const origins = Object.fromEntries(["demo", "real-photo", "research"].map((o) => [o, { runs: count((r) => r.origin === o), ok: count((r) => r.origin === o && r.ok) }]));
const units = runs.filter((r) => r.ok).reduce((n, r) => n + (UNITS[r.api] ?? 0), 0);
const out = {
  generated: new Date().toISOString().slice(0, 10),
  source: "lab/out and lab/real/out: one saved output file per finished YouCam task. Tasks whose output was not kept (early exploration, one-unit end-to-end checks) are not counted.",
  runs: runs.length,
  ok: count((r) => r.ok),
  origins,
  unitsEstimate: units, // successful runs x the price list; not read from the account
  tasks: runs,
};
fs.writeFileSync(path.join(ROOT, "data", "lab-runs.json"), JSON.stringify(out, null, 1));
console.log(out.runs, "runs,", out.ok, "succeeded;", JSON.stringify(origins), "estimated units on successes", units);
if (unclassified.length) console.log("not in the ledger (no recognised feature or no timing):", unclassified.join(", "));
