// Tests on real photographs (Unsplash License, credited): does the passport read real hair, and do
// wig, headwear and brow try-ons work on people who are really bald? Outputs to lab/real/out/<id>/.
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { run } from "./yc.mjs";

export const PHOTOS = [
  { id: "QXevDflbl8A", img: "1544005313-94ddf0286df2", by: "Štefan Štefančík", kind: "hair", fit: "Women", note: "Long straight brown hair, outdoor light" },
  { id: "qXzOsNZP7mA", img: "1569430548104-6ca1cda3ec41", by: "Jude Infantini", kind: "hair", fit: "Women", note: "Long curly hair" },
  { id: "7jZiSQ_Jyqg", img: "1642243947382-524cecf14085", by: "Soroush Sedghi", kind: "hair", fit: "Women", note: "Long grey hair, smiling" },
  { id: "7YVZYZeITc8", img: "1500648767791-00dcc994a43e", by: "Jurica Koletić", kind: "hair", fit: "Men", note: "Short dark hair" },
  { id: "CGKYNN3uuVo", img: "1614204424926-196a80bf0be8", by: "Filipp Romanovski", kind: "hair", fit: "Women", note: "Curly bob, warm light" },
  { id: "f5xiGmFwXIU", img: "1589279715734-6631a314dfa2", by: "Zoran Borojevic", kind: "bald", fit: "Men", note: "Shaved head, beard" },
  { id: "XvnVGXhNV94", img: "1646457411135-37fa10a51c3d", by: "Ben Masora", kind: "bald", fit: "Women", note: "Shaved head, smiling" },
  { id: "raCWeevBPWs", img: "1759771716199-1194c6efe0c7", by: "Lisa Marie Theck", kind: "bald", fit: "Women", note: "Shaved head, black and white" },
  { id: "tFA_OQ-9NDU", img: "1698365039593-5180c517bb96", by: "Tekeyah Whit", kind: "bald", fit: "Men", note: "Shaved head, full beard, outdoors" },
];

const WIGS = { Women: ["nora", "zuri"], Men: ["kai", "arjun"] };
const OUT = new URL("./real/out/", import.meta.url);
const p = (rel) => decodeURIComponent(new URL(rel, OUT).pathname).replace(/^\/(\w:)/, "$1");
const cat = (w) => decodeURIComponent(new URL(`./out/cat/${w}_1024.jpg`, import.meta.url).pathname).replace(/^\/(\w:)/, "$1");

if (process.argv[1]?.endsWith("realtest.mjs")) {
  for (const ph of PHOTOS) {
    const d = ph.id;
    fs.mkdirSync(p(d), { recursive: true });
    const src = p(`${d}/src.jpg`);
    if (!fs.existsSync(src)) {
      const r = await fetch(`https://images.unsplash.com/photo-${ph.img}?w=1400&q=88&fm=jpg`);
      fs.writeFileSync(src, Buffer.from(await r.arrayBuffer()));
      execFileSync("python", ["-c", `from PIL import Image\nim=Image.open(r'${src}').convert('RGB'); im.thumbnail((1024,1024)); im.save(r'${p(`${d}/src_1024.jpg`)}',quality=92)`]);
    }
    const f = `@file:${p(`${d}/src_1024.jpg`)}`;
    const jobs = [];
    if (ph.kind === "hair") {
      jobs.push(["length", "s2s/v2.0/task/hair-length-detection", { src_file_id: f }]);
      jobs.push(["face", "s2s/v2.0/task/face-attr-analysis", { src_file_id: f, features: ["faceShape", "eyebrowShape", "eyebrowThickness", "eyebrowColor", "hairColor"] }]);
    } else {
      jobs.push(["head_turban", "s2s/v2.0/task/image-to-image/youcam", { model: "youcam-image-v2", src_file_ids: [f], prompt: "The exact same person, same face, same expression, same clothes, same background and lighting, now wearing a soft dusty rose jersey cotton turban head wrap that fully covers the head. Keep their identity identical." }]);
      jobs.push(["brows", "s2s/v2.0/task/makeup-vto", { src_file_id: f, effects: [{ category: "eyebrows", pattern: { type: "shape", name: "SoftArch20", curvature: 0, thickness: 20, definition: 60 }, palettes: [{ color: "#3a2a22", colorIntensity: 70, texture: "matte" }] }] }]);
    }
    for (const w of WIGS[ph.fit]) jobs.push([`wig_${w}`, "s2s/v2.1/task/hair-transfer", { src_file_id: f, ref_file_id: `@file:${cat(w)}`, hair_color: "ref" }]);
    const results = await Promise.all(jobs.map(async ([name, feat, body]) => {
      const rel = `${d}/${name}`;
      if (fs.existsSync(p(`${rel}.json`))) return [name, JSON.parse(fs.readFileSync(p(`${rel}.json`), "utf8"))];
      const res = await run(feat, body);
      fs.writeFileSync(p(`${rel}.json`), JSON.stringify(res, null, 2));
      const url = res.data?.results?.url;
      if (url) { const r = await fetch(url); if (r.ok) fs.writeFileSync(p(`${rel}.jpg`), Buffer.from(await r.arrayBuffer())); }
      return [name, res];
    }));
    for (const [name, res] of results) console.log(d, name, res.data?.task_status, res.data?.error ?? "", res.ms);
  }
}
