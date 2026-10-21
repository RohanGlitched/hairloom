// Generates the fictional demo boutique's wig model photos with YouCam text-to-image.
// Output: lab/out/cat/<id>.jpg (+ .json). Run once; reruns skip existing files.
import fs from "node:fs";
import { run, save } from "./yc.mjs";

export const WIGS = [
  { id: "asha", name: "Asha", desc: "a sleek straight lob that just touches the shoulders, darkest brown, centre parting" },
  { id: "meera", name: "Meera", desc: "long layered straight hair past the chest, off-black, soft side parting" },
  { id: "nora", name: "Nora", desc: "a chin-length blunt bob with no fringe, medium brown, glossy" },
  { id: "ivy", name: "Ivy", desc: "a short textured pixie cut, warm chestnut brown" },
  { id: "zuri", name: "Zuri", desc: "shoulder-length defined curls (type 3B), off-black" },
  { id: "amara", name: "Amara", desc: "a rounded medium-length afro of soft coils (type 4A), natural black" },
  { id: "june", name: "June", desc: "soft loose waves to the shoulder, light ash brown" },
  { id: "silver", name: "Silver", desc: "a short layered cut in bright silver grey" },
  { id: "rosa", name: "Rosa", desc: "long auburn waves to mid-back" },
  { id: "lena", name: "Lena", desc: "a jaw-length salt and pepper grey bob" },
  { id: "tara", name: "Tara", desc: "long straight hair with a deep side parting, mocha brown with darker roots" },
  { id: "kai", name: "Kai", desc: "a short classic men's crop, dark brown", male: true },
  { id: "dev", name: "Dev", desc: "a short textured men's cut, salt and pepper grey", male: true },
  { id: "arjun", name: "Arjun", desc: "a classic men's side-parted cut, black with a little grey at the temples", male: true },
  { id: "sam", name: "Sam", desc: "short men's natural curls (type 3C), dark brown", male: true },
];

const people = [
  "a 40 year old woman", "a 35 year old woman", "a 45 year old woman", "a 30 year old woman",
  "a 32 year old Black woman", "a 36 year old Black woman", "a 42 year old woman", "a 62 year old woman",
  "a 34 year old woman", "a 55 year old woman", "a 38 year old South Asian woman",
  "a 40 year old man", "a 52 year old South Asian man", "a 46 year old South Asian man", "a 35 year old Black man",
];

const OUT = new URL("./out/cat/", import.meta.url);
fs.mkdirSync(OUT, { recursive: true });

await Promise.all(
  WIGS.map(async (w, i) => {
    if (fs.existsSync(new URL(`${w.id}.jpg`, OUT))) return;
    const prompt =
      `Photorealistic wig catalogue photo: head-and-shoulders portrait of ${people[i]} wearing a wig with ${w.desc}. ` +
      `Looking straight at the camera, neutral friendly expression, mouth closed, full face and the whole hairstyle visible, ` +
      `shoulders visible, plain light grey studio background, soft even studio light, simple plain top, sharp focus, 85mm lens.`;
    const res = await run("s2s/v2.0/task/text-to-image/youcam", { model: "youcam-image-v2", prompt, size: "1104*1472" });
    await save(`cat/${w.id}`, res);
    console.log(w.id, res.data?.task_status, res.ms);
  }),
);
