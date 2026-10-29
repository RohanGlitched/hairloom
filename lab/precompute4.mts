// Fourth precompute pass: a thinning demo that shows thinning. Margaret gets a generated photo with
// thinning hair, and every hair-volume and hair-extension template runs on it; Nia (alopecia) gets a
// topper and clip-in preview on her kept photo. About 14 units. Run from hairloom/: npx tsx ../lab/precompute4.mts
import fs from "node:fs";
// @ts-expect-error plain JS helper
import { run, save } from "./yc.mjs";

const OUT = new URL("./out/", import.meta.url);
const p = (rel: string) => decodeURIComponent(new URL(rel, OUT).pathname).replace(/^\/(\w:)/, "$1");
const has = (rel: string) => fs.existsSync(p(rel));

async function step(rel: string, feature: string, body: unknown) {
  if (has(`${rel}.json`)) return JSON.parse(fs.readFileSync(p(`${rel}.json`), "utf8"));
  const res = await run(feature, body);
  await save(rel, res);
  console.log(rel, res.data?.task_status, res.data?.error ?? "", res.ms);
  return res;
}

const VOLUME = ["female_subtle", "female_natural", "female_medium", "female_high"];
const EXTENSION = ["all_length_1", "all_length_2_", "all_length_3"];

const m = "demo/margaret";
await step(`${m}/thinning`, "s2s/v2.0/task/image-to-image/youcam", {
  model: "youcam-image-v2", src_file_ids: [`@file:${p(`${m}/front.jpg`)}`],
  prompt: "The exact same woman, same face, same expression, same navy cardigan, same plain pale blue wall and lighting, same wavy grey-blonde hair colour and length, but her hair is now visibly thinning: a widening centre parting with scalp showing through on top, and finer, flatter hair overall. Keep her identity identical.",
});
if (has(`${m}/thinning.jpg`)) {
  const src = `@file:${p(`${m}/thinning.jpg`)}`;
  for (const t of VOLUME) await step(`${m}/thin_${t}`, "s2s/v2.0/task/hair-vol", { src_file_id: src, template_id: t });
  for (const t of EXTENSION) await step(`${m}/thin_${t}`, "s2s/v2.0/task/hair-ext", { src_file_id: src, template_id: t });
}

const n = "demo/nia";
await step(`${n}/thin_female_medium`, "s2s/v2.0/task/hair-vol", { src_file_id: `@file:${p(`${n}/front.jpg`)}`, template_id: "female_medium" });
await step(`${n}/thin_all_length_2_`, "s2s/v2.0/task/hair-ext", { src_file_id: `@file:${p(`${n}/front.jpg`)}`, template_id: "all_length_2_" });
console.log("done");
