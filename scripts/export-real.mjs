// Copies the real-photograph tests (../lab/real/out) into the site: public/real/<id>/*.jpg and data/real.json.
// Photos are from Unsplash under the Unsplash License; photographers are credited on the evidence page.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { PHOTOS } from "../../lab/realtest.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const LAB = path.resolve(ROOT, "../lab/real/out");
const PUB = path.join(ROOT, "public", "real");
const readJson = (f) => (fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, "utf8")) : null);

function resize(src, dst, max = 640) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  execFileSync("python", ["-c", `from PIL import Image\nim=Image.open(r'${src}').convert('RGB'); im.thumbnail((${max},${max})); im.save(r'${dst}',quality=84,optimize=True,progressive=True)`]);
}

// What a person sees in each photo, written by eye (there is no reference swatch or eyedrop yet).
// "eye" is the hair colour; "labelOk" says whether YouCam's hair_color_name fits it, where one came back.
// "colourNote" is shown under the measured shade when it misses.
const BY_EYE = {
  QXevDflbl8A: { note: "Long straight brown hair, sunset backlight", eye: "brown", colourNote: "Brown to the eye, so the measured off black is a miss in strong backlight." },
  qXzOsNZP7mA: { eye: "dark brown", labelOk: false },
  "7jZiSQ_Jyqg": { eye: "grey" },
  "7YVZYZeITc8": { eye: "black", labelOk: true },
  CGKYNN3uuVo: { eye: "very dark brown", labelOk: true },
};

const out = [];
for (const ph of PHOTOS) {
  const d = path.join(LAB, ph.id);
  if (!fs.existsSync(d)) continue;
  const runs = [];
  const images = {};
  for (const f of fs.readdirSync(d).filter((x) => x.endsWith(".json"))) {
    const name = f.slice(0, -5);
    const j = readJson(path.join(d, f));
    runs.push({ name, ok: j?.data?.task_status === "success", error: j?.data?.error ?? null, ms: j?.ms ?? null });
    if (fs.existsSync(path.join(d, `${name}.jpg`))) {
      resize(path.join(d, `${name}.jpg`), path.join(PUB, ph.id, `${name}.jpg`));
      images[name] = `/real/${ph.id}/${name}.jpg`;
    }
  }
  resize(path.join(d, "src_1024.jpg"), path.join(PUB, ph.id, "src.jpg"));
  const face = readJson(path.join(d, "face_flexible.json"))?.data?.results ?? null;
  out.push({
    ...ph,
    ...BY_EYE[ph.id],
    url: `https://unsplash.com/photos/${ph.id}`,
    src: `/real/${ph.id}/src.jpg`,
    images,
    runs,
    length: readJson(path.join(d, "length.json"))?.data?.results?.hair_length?.term ?? null,
    face: face ? { faceshape: face.faceshape, color: face.color, quality: face.face_quality } : null,
  });
}
fs.writeFileSync(path.join(ROOT, "data", "real.json"), JSON.stringify(out, null, 1));
console.log(out.length, "photos");
