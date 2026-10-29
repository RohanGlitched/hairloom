// Oct 30 round-3 lab runs (owner allowed up to 8 units; balance must stay >= 518).
// node lab/round3.mjs shades | density-gen | density     Outputs in lab/out/r3/. Prints no key.
import fs from "node:fs";
import { run, save } from "./yc.mjs";

const BASE = "https://yce-api-01.makeupar.com";
const KEY = /YOUCAM_API_KEY=(\S+)/.exec(fs.readFileSync(new URL("../keys/youcam.env", import.meta.url), "utf8"))[1];
const auth = { Authorization: `Bearer ${KEY}` };
fs.mkdirSync("lab/out/r3", { recursive: true });
const credit = async () => Math.floor((await fetch(`${BASE}/s2s/v1.0/client/credit`, { headers: auth }).then((r) => r.json())).results.reduce((s, x) => s + (x.amount_dec ?? x.amount ?? 0), 0));
async function guard(cost) {
  const c = await credit();
  console.log(`balance ${c}, this step up to ${cost}`);
  if (c - cost < 518) { console.log("STOP: would go under the reserve"); process.exit(3); }
}
const keep = (s) => `The exact same person, same face, same expression, same clothes, same background and lighting, ${s}. Keep their identity identical.`;
const step = process.argv[2];

if (step === "shades") {
  // Margaret's light shades came back far from the asked colour at intensity 70; try stronger.
  const HEX = { 14: "#a08262", 16: "#b99d77", 24: "#cfae7b" };
  const plan = [[14, 100], [16, 100], [24, 100], [24, 90]];
  await guard(plan.length);
  for (const [code, k] of plan) {
    const res = await run("s2s/v2.0/task/hair-color", { src_file_id: "@file:lab/out/demo/margaret/wig_june_1024.jpg", pattern: { name: "full" }, palettes: [{ color: HEX[code], color_intensity: k, shine_intensity: 40 }] });
    await save(`r3/margaret_shade_june_${code}_i${k}`, res);
    console.log(code, k, res.data?.task_status, res.data?.error ?? "", res.ms);
  }
}
if (step === "density-gen") {
  await guard(2);
  const a = keep("photographed as a front-facing selfie taken from about 45 degrees below her face, the phone held low and pointing up, her face looking straight at the camera and the whole head and hairline in frame");
  const b = keep("photographed as a front-facing selfie with the camera about 45 degrees above, looking down at her, her face turned up towards the camera so the top of her head and parting are visible");
  for (const [label, prompt] of [["nia_below45", a], ["nia_above45", b]]) {
    const res = await run("s2s/v2.0/task/image-to-image/youcam", { model: "youcam-image-v2", src_file_ids: ["@file:lab/out/demo/nia/front.jpg"], prompt });
    await save(`r3/${label}`, res);
    console.log(label, res.data?.task_status, res.data?.error ?? "", res.ms);
  }
}
if (step === "density") {
  await guard(2);
  for (const f of ["nia_below45", "nia_above45"]) {
    const r = await run("s2s/v2.0/task/hair-density-detection", { src_file_id: `@file:lab/out/r3/${f}.jpg` });
    fs.writeFileSync(`lab/out/r3/${f}_density.json`, JSON.stringify(r, null, 2));
    console.log(f, r.data?.task_status, r.data?.error ?? "", JSON.stringify(r.data?.results ?? {}).slice(0, 300));
  }
}
console.log("balance now", await credit());
