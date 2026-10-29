// Sixth pass: Nia's patches again, skin-toned rather than pink (about 4 units). The first attempt is kept
// as thinning_v1. Run from hairloom/: npx tsx ../lab/precompute6.mts
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

const n = "demo/nia";
for (const f of ["thinning", "thin_female_medium", "thin_all_length_2_"]) {
  for (const e of ["jpg", "json"]) if (has(`${n}/${f}.${e}`) && !has(`${n}/${f}_v1.${e}`)) fs.renameSync(p(`${n}/${f}.${e}`), p(`${n}/${f}_v1.${e}`));
}
await step(`${n}/thinning`, "s2s/v2.0/task/image-to-image/youcam", {
  model: "youcam-image-v2", src_file_ids: [`@file:${p(`${n}/front.jpg`)}`],
  prompt: "The exact same woman, same face, same expression, same grey sweater, same plain beige wall and lighting, same curly black hair, but her parting is wider and two small smooth round patches of bare scalp show through the curls near the crown, the scalp exactly her own deep brown skin tone, natural and subtle, as in alopecia areata. Keep her identity and the rest of her hair identical.",
});
if (has(`${n}/thinning.jpg`)) {
  const src = `@file:${p(`${n}/thinning.jpg`)}`;
  await step(`${n}/thin_female_medium`, "s2s/v2.0/task/hair-vol", { src_file_id: src, template_id: "female_medium" });
  await step(`${n}/thin_all_length_2_`, "s2s/v2.0/task/hair-ext", { src_file_id: src, template_id: "all_length_2_" });
}
console.log("done");
