// Fifth precompute pass, from judge round 3 (about 15 units):
// - Wren, a grey-blonde wavy wig, so Margaret has a close match in stock; tried on every demo person.
// - Nia's alopecia patches: a generated photo with two small patches, and a topper and clip-ins on it.
// - Two men's headwear looks for Ravi (flat cap, cotton bandana).
// Run from hairloom/: npx tsx ../lab/precompute5.mts
import fs from "node:fs";
import { execFileSync } from "node:child_process";
// @ts-expect-error plain JS helper
import { run, save } from "./yc.mjs";

const OUT = new URL("./out/", import.meta.url);
const p = (rel: string) => decodeURIComponent(new URL(rel, OUT).pathname).replace(/^\/(\w:)/, "$1");
const has = (rel: string) => fs.existsSync(p(rel));
const fit = (src: string, dst: string) => {
  if (has(dst) || !has(src)) return;
  execFileSync("python", ["-c", `from PIL import Image\nim=Image.open(r'${p(src)}').convert('RGB'); im.thumbnail((1024,1024)); im.save(r'${p(dst)}',quality=92)`]);
};

async function step(rel: string, feature: string, body: unknown) {
  if (has(`${rel}.json`)) return JSON.parse(fs.readFileSync(p(`${rel}.json`), "utf8"));
  const res = await run(feature, body);
  await save(rel, res);
  console.log(rel, res.data?.task_status, res.data?.error ?? "", res.ms);
  return res;
}

const I2I = "s2s/v2.0/task/image-to-image/youcam";

// Wren: the catalogue photo, then the wig on each demo person's week-4 photo.
await step("cat/wren", "s2s/v2.0/task/text-to-image/youcam", {
  model: "youcam-image-v2", size: "1104*1472",
  prompt: "Photorealistic wig catalogue photo: head-and-shoulders portrait of a 60 year old woman wearing a wig with soft shoulder-length waves in grey blonde, a natural blend of silver grey and ash blonde. Looking straight at the camera, neutral friendly expression, mouth closed, full face and the whole hairstyle visible, shoulders visible, plain light grey studio background, soft even studio light, simple plain top, sharp focus, 85mm lens.",
});
fit("cat/wren.jpg", "cat/wren_1024.jpg");
await Promise.all(["anjali", "nia", "margaret", "ravi"].map((id) =>
  step(`demo/${id}/wig_wren`, "s2s/v2.1/task/hair-transfer", { src_file_id: `@file:${p(`demo/${id}/bald_1024.jpg`)}`, ref_file_id: `@file:${p("cat/wren_1024.jpg")}`, hair_color: "ref" })));

// Nia: small patches of alopecia areata, then a topper's volume and clip-in length on that photo.
await step("demo/nia/thinning", I2I, {
  model: "youcam-image-v2", src_file_ids: [`@file:${p("demo/nia/front.jpg")}`],
  prompt: "The exact same woman, same face, same expression, same grey sweater, same plain beige wall and lighting, same curly black hair, but with two small round smooth bald patches of alopecia areata visible on the top of her head beside the parting, about the size of a coin. Keep her identity and the rest of her hair identical.",
});
if (has("demo/nia/thinning.jpg")) {
  const src = `@file:${p("demo/nia/thinning.jpg")}`;
  await step("demo/nia/thin_female_medium", "s2s/v2.0/task/hair-vol", { src_file_id: src, template_id: "female_medium" });
  await step("demo/nia/thin_all_length_2_", "s2s/v2.0/task/hair-ext", { src_file_id: src, template_id: "all_length_2_" });
}

// Ravi: men's headwear on his week-4 photo.
const keep = "The exact same man, same face, same expression, same olive green polo shirt, same plain light grey wall and lighting";
for (const [id, text] of [["flatcap", "a grey herringbone wool flat cap that covers the top of his head"], ["bandana", "a navy cotton bandana tied neatly over his head, fully covering it"]]) {
  await step(`demo/ravi/head_${id}`, I2I, { model: "youcam-image-v2", src_file_ids: [`@file:${p("demo/ravi/bald_1024.jpg")}`], prompt: `${keep}, now wearing ${text}. Keep his identity identical.` });
}
console.log("done");
