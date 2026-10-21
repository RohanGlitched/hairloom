// Copies precomputed YouCam outputs from ../lab/out into the site:
//   public/demo/<persona>/*.jpg, public/catalogue/*.jpg, data/demo.json
// Run: node scripts/export-demo.mjs
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(import.meta.dirname, "..");
const LAB = path.resolve(ROOT, "../lab/out");
const PUB = path.join(ROOT, "public");
const DATA = path.join(ROOT, "data");
fs.mkdirSync(DATA, { recursive: true });

function resize(src, dst, max, q = 84) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  execFileSync("python", ["-c", `
from PIL import Image
im=Image.open(r'${src}').convert('RGB'); im.thumbnail((${max},${max})); im.save(r'${dst}',quality=${q},optimize=True,progressive=True)`]);
}
const readJson = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null);

const PERSONAS = [
  { id: "anjali", name: "Anjali", age: 45, city: "Pune", situation: "chemo", later: "Week 4", fit: "Women", cap: { cm: 55.5, parting: "centre" }, blurb: "Starts chemotherapy for breast cancer in two weeks. Wants to look like herself at work." },
  { id: "nia", name: "Nia", age: 38, city: "London", situation: "alopecia", later: "Month 3", fit: "Women", cap: { cm: 56, parting: "none" }, blurb: "Has alopecia areata. Patches are spreading and she wants a plan before they show." },
  { id: "margaret", name: "Margaret", age: 60, city: "Leeds", situation: "chemo", later: "Week 4", fit: "Women", cap: { cm: 54.5, parting: "left" }, blurb: "Begins a taxane regimen next month. Has worn her grey-blonde waves for twenty years." },
  { id: "ravi", name: "Ravi", age: 52, city: "Bengaluru", situation: "chemo", later: "Week 4", fit: "Men", cap: { cm: 58, parting: "left" }, blurb: "Starts chemotherapy for lymphoma soon. Teaches maths and doesn't want his class to notice." },
];
const WIGS = ["asha", "meera", "nora", "ivy", "zuri", "amara", "june", "silver", "rosa", "lena", "tara", "wren", "kai", "dev", "arjun", "sam"];
const HEAD = ["turban", "silk", "beanie", "cap", "flatcap", "bandana"];

// Catalogue: the full 1024 image is the try-on reference (served publicly); thumbs for the rail.
for (const w of WIGS) {
  resize(path.join(LAB, "cat", `${w}_1024.jpg`), path.join(PUB, "catalogue", `${w}.jpg`), 1024, 90);
  resize(path.join(LAB, "cat", `${w}_1024.jpg`), path.join(PUB, "catalogue", "thumb", `${w}.jpg`), 420, 82);
}

const THIN = ["female_subtle", "female_natural", "female_medium", "female_high", "all_length_1", "all_length_2_", "all_length_3"];
const out = [];
for (const p of PERSONAS) {
  const d = path.join(LAB, "demo", p.id);
  if (!fs.existsSync(path.join(d, "bald.json"))) { console.log("skip", p.id); continue; }
  const pub = (n) => `/demo/${p.id}/${n}.jpg`;
  const copy = (src, n, max = 900) => { if (fs.existsSync(src)) { resize(src, path.join(PUB, "demo", p.id, `${n}.jpg`), max); return pub(n); } return null; };
  const r = (n) => readJson(path.join(d, `${n}.json`))?.data?.results ?? null;
  const persona = {
    ...p,
    kept: copy(path.join(d, "front.jpg"), "kept"),
    turns: [copy(path.join(d, "turn_a.jpg"), "turn_a", 600), copy(path.join(d, "turn_b.jpg"), "turn_b", 600)],
    week4: copy(path.join(d, "bald.jpg"), "week4"),
    own: copy(path.join(d, "own.jpg"), "own"),
    readings: { type: r("hair_type")?.hair_type ?? null, frizz: r("hair_frizz")?.hair_frizziness ?? null, length: r("hair_length")?.hair_length ?? null, face: r("face") },
    wigs: Object.fromEntries(WIGS.map((w) => [w, copy(path.join(d, `wig_${w}.jpg`), `wig_${w}`)]).filter(([, v]) => v)),
    headwear: Object.fromEntries(HEAD.map((h) => [h, copy(path.join(d, `head_${h}.jpg`), `head_${h}`)]).filter(([, v]) => v)),
    brows: copy(path.join(d, "brows.jpg"), "brows"),
    withHair: Object.fromEntries(WIGS.map((w) => [w, copy(path.join(d, `withhair_${w}.jpg`), `withhair_${w}`)]).filter(([, v]) => v)),
    shades: Object.fromEntries(fs.readdirSync(d).filter((f) => /^shade_\w+_\w+\.jpg$/.test(f)).map((f) => [f.slice(6, -4).replace("_", ":"), copy(path.join(d, f), f.slice(0, -4))])),
    // Thinning previews, keyed by YouCam template id; Margaret's run on a generated thinning photo.
    thinPhoto: copy(path.join(d, "thinning.jpg"), "thinning"),
    thinning: Object.fromEntries(THIN.map((t) => [t, copy(path.join(d, `thin_${t}.jpg`), `thin_${t}`)]).filter(([, v]) => v)),
    skin: ["skin_wk0", "skin_wk4"].filter((n) => fs.existsSync(path.join(d, `${n}.json`))).map((n, i) => {
      const out = readJson(path.join(d, `${n}.json`))?.data?.results?.output ?? [];
      return {
        week: i === 0 ? 0 : 4,
        photo: copy(path.join(d, `${n}_crop.jpg`), `${n}_crop`, 500),
        scores: Object.fromEntries(out.filter((o) => ["moisture", "redness", "texture", "radiance"].includes(o.type)).map((o) => [o.type, Math.round(o.raw_score)])),
        masks: Object.fromEntries(out.map((o) => [o.type, copy(path.join(d, `${n}_${o.type}.jpg`), `${n}_${o.type}`, 600)]).filter(([, v]) => v)),
      };
    }),
  };
  out.push(persona);
  console.log(p.id, Object.keys(persona.wigs).length, "wigs");
}
fs.writeFileSync(path.join(DATA, "demo.json"), JSON.stringify({ generated: new Date().toISOString(), personas: out }, null, 2));

// The evidence ledger (data/lab-runs.json) is built by scripts/export-runs.mjs from every output file, not just the demo's.
