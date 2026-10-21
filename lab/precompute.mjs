// Precomputes the demo personas so the site's demo spends zero units.
// Every step caches to lab/out/demo/<persona>/<step>.{json,jpg}; reruns skip finished steps.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { run, save } from "./yc.mjs";
import { WIGS } from "./catalogue.mjs";

const OUT = new URL("./out/", import.meta.url);
const p = (rel) => new URL(rel, OUT).pathname.replace(/^\/(\w:)/, "$1");
const has = (rel) => fs.existsSync(p(rel));

// Resize to the try-on limits (long side 1024, jpg). Optional exact size for the 3-angle sets.
function fit(src, dst, w = 0, h = 0) {
  if (has(dst)) return;
  execFileSync("python", ["-c", `
from PIL import Image
im=Image.open(r'${p(src)}').convert('RGB')
${w ? `im=im.resize((${w},${h}))` : "im.thumbnail((1024,1024))"}
im.save(r'${p(dst)}',quality=92)`]);
}

async function step(rel, feature, body) {
  if (has(`${rel}.json`)) return JSON.parse(fs.readFileSync(p(`${rel}.json`), "utf8"));
  const res = await run(feature, body);
  await save(rel, res);
  console.log(rel, res.data?.task_status, res.data?.error ?? "", res.ms);
  return res;
}

const I2I = "s2s/v2.0/task/image-to-image/youcam";
const keep = (who, clothes, wall) =>
  `The exact same ${who}, same face, same expression, same ${clothes}, same ${wall} and lighting`;
const pr = (s) => (s.who === "man" ? "his" : "her");

const PERSONAS = [
  { id: "anjali", src: "p1_1024.jpg", who: "woman", hair: "straight dark brown hair worn loose", clothes: "blue t-shirt", wall: "plain grey wall" },
  { id: "nia", src: "p2_1024.jpg", who: "woman", hair: "curly black hair", clothes: "grey sweater", wall: "plain beige wall" },
  { id: "margaret", src: "p3_1024.jpg", who: "woman", hair: "wavy grey-blonde hair", clothes: "navy cardigan", wall: "plain pale blue wall" },
  { id: "ravi", src: "p4_1024.jpg", who: "man", hair: "thick wavy black hair with some grey", clothes: "olive green polo shirt", wall: "plain light grey wall" },
];

const HEADWEAR = [
  { id: "turban", text: "a soft dusty rose jersey cotton turban head wrap that fully covers her head" },
  { id: "silk", text: "a printed silk headscarf with a green and gold botanical pattern, tied at the nape and fully covering her head" },
  { id: "beanie", text: "a soft oatmeal knitted wool beanie that fully covers her head, with no hair showing underneath" },
  { id: "cap", text: "a fitted charcoal cotton sleep cap that fully covers her head" },
];

for (const w of WIGS) fit(`cat/${w.id}.jpg`, `cat/${w.id}_1024.jpg`);

for (const s of PERSONAS) {
  const d = `demo/${s.id}`;
  fs.mkdirSync(p(d), { recursive: true });
  fit(s.src, `${d}/front.jpg`);

  // Three-angle set for hair type and frizz: [front, facing image-right, facing image-left].
  await step(`${d}/turn_a`, I2I, { model: "youcam-image-v2", src_file_ids: [`@file:${p(`${d}/front.jpg`)}`],
    prompt: `${keep(s.who, s.clothes, s.wall)}, same ${s.hair}, photographed with ${pr(s)} head turned 45 degrees so ${pr(s)} face points toward the right side of the image (three-quarter view). Keep ${pr(s)} identity and hair identical.` });
  await step(`${d}/turn_b`, I2I, { model: "youcam-image-v2", src_file_ids: [`@file:${p(`${d}/front.jpg`)}`],
    prompt: `${keep(s.who, s.clothes, s.wall)}, same ${s.hair}, photographed with ${pr(s)} head turned 45 degrees so ${pr(s)} face points toward the left side of the image (three-quarter view). Keep ${pr(s)} identity and hair identical.` });
  for (const n of ["front", "turn_a", "turn_b"]) fit(n === "front" ? `${d}/front.jpg` : `${d}/${n}.jpg`, `${d}/${n}_eq.jpg`, 768, 1024);
  const trio = ["front_eq", "turn_a_eq", "turn_b_eq"].map((n) => `@file:${p(`${d}/${n}.jpg`)}`);

  // Passport readings.
  await Promise.all([
    step(`${d}/hair_type`, "s2s/v2.0/task/hair-type-detection", { src_file_ids: trio }),
    step(`${d}/hair_frizz`, "s2s/v2.0/task/hair-frizziness-detection", { src_file_ids: trio }),
    step(`${d}/hair_length`, "s2s/v2.0/task/hair-length-detection", { src_file_id: `@file:${p(`${d}/front.jpg`)}` }),
    step(`${d}/face`, "s2s/v2.0/task/face-attr-analysis", { src_file_id: `@file:${p(`${d}/front.jpg`)}`,
      features: ["faceShape", "eyebrowShape", "eyebrowThickness", "eyebrowColor", "hairColor"] }),
  ]);

  // Week 4: the same person after hair loss.
  await step(`${d}/bald`, I2I, { model: "youcam-image-v2", src_file_ids: [`@file:${p(`${d}/front.jpg`)}`],
    prompt: `${keep(s.who, s.clothes, s.wall)}, but ${pr(s)} head is now completely bald with no hair at all after chemotherapy, smooth scalp, eyebrows slightly thinner. Keep ${pr(s)} identity identical.` });
  fit(`${d}/bald.jpg`, `${d}/bald_1024.jpg`);
  const bald = `@file:${p(`${d}/bald_1024.jpg`)}`;

  // Her own hair back, using her kept photo as the reference.
  await step(`${d}/own`, "s2s/v2.1/task/hair-transfer", { src_file_id: bald, ref_file_id: `@file:${p(`${d}/front.jpg`)}`, hair_color: "ref" });

  // Every wig in the boutique on her week-4 photo (2 at a time to stay polite on rate limits).
  for (let i = 0; i < WIGS.length; i += 3) {
    await Promise.all(WIGS.slice(i, i + 3).map((w) =>
      step(`${d}/wig_${w.id}`, "s2s/v2.1/task/hair-transfer", { src_file_id: bald, ref_file_id: `@file:${p(`cat/${w.id}_1024.jpg`)}`, hair_color: "ref" })));
  }

  // Headwear that keeps her identity.
  await Promise.all(HEADWEAR.map((h) => step(`${d}/head_${h.id}`, I2I, { model: "youcam-image-v2", src_file_ids: [bald],
    prompt: `${keep(s.who, s.clothes, s.wall)}, now wearing ${h.text.replace(/her head/g, pr(s) + " head")}. Keep ${pr(s)} identity identical.` })));
}
console.log("done");
