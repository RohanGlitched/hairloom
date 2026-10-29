// Oct 30 round-2 lab runs (owner allowed up to 20 units in total; balance must stay >= 520).
// node lab/round2.mjs <step>   steps: regrow-gen, regrow-read, nia-gen, nia-try, density-gen, density
// Outputs in lab/out/r2/. Prints no key.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { run, save, upload } from "./yc.mjs";

const BASE = "https://yce-api-01.makeupar.com";
const KEY = /YOUCAM_API_KEY=(\S+)/.exec(fs.readFileSync(new URL("../keys/youcam.env", import.meta.url), "utf8"))[1];
const auth = { Authorization: `Bearer ${KEY}` };
const OUT = "lab/out/r2/";
fs.mkdirSync(OUT, { recursive: true });
const A = "lab/out/demo/anjali/", N = "lab/out/demo/nia/", M = "lab/out/demo/margaret/";

const credit = async () => Math.floor((await fetch(`${BASE}/s2s/v1.0/client/credit`, { headers: auth }).then((r) => r.json())).results.reduce((s, x) => s + (x.amount_dec ?? x.amount ?? 0), 0));
async function guard(cost) {
  const c = await credit();
  console.log(`balance ${c}, this step up to ${cost}`);
  if (c - cost < 522) { console.log("STOP: would go under the reserve"); process.exit(3); }
}
const keep = (s) => `The exact same person, same face, same expression, same clothes, same background and lighting, ${s}. Keep their identity identical.`;
async function i2i(src, prompt, label) {
  const res = await run("s2s/v2.0/task/image-to-image/youcam", { model: "youcam-image-v2", src_file_ids: [`@file:${src}`], prompt });
  await save(`r2/${label}`, res);
  console.log(label, res.data?.task_status, res.data?.error ?? "", `${res.ms} ms`);
  return res;
}
// Same size as the first photo, as hair-type detection requires.
function eq(files, w, h) {
  return files.map((f) => { const o = f.replace(/\.jpg$/, "_eq.jpg"); execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", f, "-vf", `scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`, "-q:v", "2", o]); return o; });
}
async function create(path, body) {
  const c = await fetch(`${BASE}/${path}`, { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());
  return c.data?.task_id ?? (console.log("create failed", JSON.stringify(c).slice(0, 300)), null);
}
async function poll(path, id, label) {
  const t0 = Date.now();
  for (;;) {
    await new Promise((r) => setTimeout(r, 4000));
    const p = await fetch(`${BASE}/${path}/${encodeURIComponent(id)}`, { headers: auth }).then((r) => r.json());
    const st = p.data?.task_status;
    if (st && st !== "running") { p.ms = Date.now() - t0; fs.writeFileSync(`${OUT}${label}.json`, JSON.stringify(p, null, 2)); console.log(label, st, p.data?.error ?? "", JSON.stringify(p.data?.results ?? {}).slice(0, 300)); return p; }
    if (Date.now() - t0 > 240000) { console.log(label, "timeout"); return null; }
  }
}

const step = process.argv[2];
if (step === "regrow-gen") {
  await guard(3);
  const p = "her hair is now short soft regrowth after chemotherapy, about two to three centimetres long all over the head, noticeably curlier and wavier than before, the same dark brown colour";
  await i2i(`${A}front.jpg`, keep(p), "anjali_regrow_front");
  await i2i(`${A}turn_a.jpg`, keep(p), "anjali_regrow_turn_a");
  await i2i(`${A}turn_b.jpg`, keep(p), "anjali_regrow_turn_b");
}
if (step === "regrow-read") {
  await guard(4);
  const w = +execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=width", "-of", "csv=p=0", `${OUT}anjali_regrow_front.jpg`]).toString().trim();
  const h = +execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=height", "-of", "csv=p=0", `${OUT}anjali_regrow_front.jpg`]).toString().trim();
  const files = eq([`${OUT}anjali_regrow_front.jpg`, `${OUT}anjali_regrow_turn_a.jpg`, `${OUT}anjali_regrow_turn_b.jpg`], w, h);
  // One upload per photo, shared by both readings (as the studio's batching does).
  const ids = [];
  for (const f of files) ids.push(await upload(f));
  const t = await create("s2s/v2.0/task/hair-type-detection", { src_file_ids: ids });
  const l = await create("s2s/v2.0/task/hair-length-detection", { src_file_id: ids[0] });
  if (t) await poll("s2s/v2.0/task/hair-type-detection", t, "anjali_regrow_type");
  if (l) await poll("s2s/v2.0/task/hair-length-detection", l, "anjali_regrow_length");
}
if (step === "nia-gen") {
  await guard(1);
  await i2i(`${N}front.jpg`, keep("now with two small round smooth bald patches of alopecia areata showing through her hair, one at the centre parting near the hairline and one above the left temple; the bare patches are her own natural dark brown scalp skin colour, not pink, with no redness and no marks"), "nia_patchy");
}
if (step === "nia-try") {
  await guard(2);
  const r1 = await run("s2s/v2.1/task/hair-transfer", { src_file_id: `@file:${OUT}nia_patchy.jpg`, ref_file_id: "@file:hairloom/public/catalogue/zuri.jpg", hair_color: "ref" });
  await save("r2/nia_patchy_wig_zuri", r1); console.log("wig", r1.data?.task_status, r1.data?.error ?? "", r1.ms);
  // Volume on a patchy photo already ran on Oct 21 (lab/out/demo/nia/unused/thin_female_medium.jpg), so it isn't repeated.
}
if (step === "density-gen") {
  await guard(2);
  const tilt = "with her head tilted forward and down by about thirty degrees towards the camera so the top of her head and crown are clearly visible, face still towards the camera";
  await i2i(`${N}front.jpg`, keep(tilt), "nia_crown");
  await i2i(`${M}thinning.jpg`, keep(tilt), "margaret_crown");
}
if (step === "density") {
  await guard(2);
  for (const f of ["nia_crown", "margaret_crown"]) {
    const r = await run("s2s/v2.0/task/hair-density-detection", { src_file_id: `@file:${OUT}${f}.jpg` });
    fs.writeFileSync(`${OUT}${f}_density.json`, JSON.stringify(r, null, 2));
    console.log(f, r.data?.task_status, r.data?.error ?? "", JSON.stringify(r.data?.results ?? {}).slice(0, 300));
  }
}
console.log("balance now", await credit());
