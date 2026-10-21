// Third precompute pass, so demo mode never leads with a paid button:
// rebuilt brows, three closer shades on each person's best wig, thinning previews, and
// two skin check-ins for Anjali's journal. Run from hairloom/: npx tsx ../lab/precompute3.ts
import fs from "node:fs";
import { execFileSync } from "node:child_process";
// @ts-expect-error plain JS helper
import { run, save } from "./yc.mjs";
import colours from "../hairloom/data/colours.json" with { type: "json" };
import demo from "../hairloom/data/demo.json" with { type: "json" };
import { nearestShades, type Lab } from "../hairloom/lib/color.ts";
import { browPattern } from "../hairloom/lib/demo.ts";

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

const BEST: Record<string, string> = { anjali: "asha", nia: "zuri", margaret: "june", ravi: "arjun" };
const C = colours as Record<string, { lab: number[] } | null>;

for (const per of (demo as { personas: { id: string; readings: { face?: { eyebrow?: { left_shape?: string; left_body_thickness?: string }; color?: { eyebrow_color?: string } } } }[] }).personas) {
  const d = `demo/${per.id}`;
  if (!has(`${d}/bald_1024.jpg`)) continue;
  const bald = `@file:${p(`${d}/bald_1024.jpg`)}`;
  const brow = per.readings.face?.eyebrow;
  const hex = per.readings.face?.color?.eyebrow_color ?? "#3a2a22";
  const thick = /dense|thick/i.test(brow?.left_body_thickness ?? "") ? 60 : /sparse|thin/i.test(brow?.left_body_thickness ?? "") ? -20 : 20;
  await step(`${d}/brows`, "s2s/v2.0/task/makeup-vto", {
    src_file_id: bald,
    effects: [{ category: "eyebrows", pattern: { type: "shape", name: browPattern(brow?.left_shape), curvature: 0, thickness: thick, definition: 60 }, palettes: [{ color: hex, colorIntensity: 70, texture: "matte" }] }],
  });

  const kept = C[`${per.id}/kept`]?.lab as Lab | undefined;
  const wig = BEST[per.id];
  if (kept && has(`${d}/wig_${wig}.jpg`)) {
    execFileSync("python", ["-c", `from PIL import Image\nim=Image.open(r'${p(`${d}/wig_${wig}.jpg`)}').convert('RGB'); im.thumbnail((1024,1024)); im.save(r'${p(`${d}/wig_${wig}_1024.jpg`)}',quality=92)`]);
    for (const n of nearestShades(kept, 3)) {
      await step(`${d}/shade_${wig}_${n.code}`, "s2s/v2.0/task/hair-color", {
        src_file_id: `@file:${p(`${d}/wig_${wig}_1024.jpg`)}`, pattern: { name: "full" }, palettes: [{ color: n.hex, color_intensity: 70, shine_intensity: 40 }],
      });
    }
  }
  if (per.id === "anjali" || per.id === "margaret") {
    await step(`${d}/thin_vol`, "s2s/v2.0/task/hair-vol", { src_file_id: `@file:${p(`${d}/front.jpg`)}`, template_id: "female_medium" });
    await step(`${d}/thin_ext`, "s2s/v2.0/task/hair-ext", { src_file_id: `@file:${p(`${d}/front.jpg`)}`, template_id: "all_length_2_" });
  }
}

// Trying wigs before hair loss: five wigs on Anjali's kept photo, the main pitch.
for (const w of ["asha", "nora", "june", "tara", "ivy"]) {
  await step(`demo/anjali/withhair_${w}`, "s2s/v2.1/task/hair-transfer", {
    src_file_id: `@file:${p("demo/anjali/front.jpg")}`, ref_file_id: `@file:${p(`cat/${w}_1024.jpg`)}`, hair_color: "ref",
  });
}

// Anjali's journal: two weekly skin check-ins (kept week, week 4), cropped to the face as the journal does.
for (const [name, src] of [["skin_wk0", "front.jpg"], ["skin_wk4", "bald.jpg"]] as const) {
  const crop = `demo/anjali/${name}_crop.jpg`;
  if (!has(crop)) {
    execFileSync("python", ["-c", `from PIL import Image\nim=Image.open(r'${p(`demo/anjali/${src}`)}').convert('RGB'); w,h=im.size\nc=im.crop((int(w*0.24),int(h*0.10),int(w*0.76),int(h*0.62))); c=c.resize((900,int(900*c.height/c.width))); c.save(r'${p(crop)}',quality=92)`]);
  }
  const res = await step(`demo/anjali/${name}`, "s2s/v2.1/task/skin-analysis", {
    src_file_id: `@file:${p(crop)}`, dst_actions: ["moisture", "redness", "texture", "radiance"], format: "json", miniserver_args: { enable_mask_overlay: true },
  });
  // Concern maps come back as 2-hour signed URLs: keep them as files.
  for (const o of (res.data?.results?.output ?? []) as { type: string; mask_urls?: string[] }[]) {
    const f = `demo/anjali/${name}_${o.type}.jpg`;
    if (has(f) || !o.mask_urls?.[0]) continue;
    const r = await fetch(o.mask_urls[0]);
    if (r.ok) fs.writeFileSync(p(f), Buffer.from(await r.arrayBuffer()));
  }
}
console.log("done");
