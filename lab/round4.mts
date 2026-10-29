// Oct 30 round 4 (owner allowed up to 5 units; balance must stay >= 513): Margaret's light shades
// asked with the colour lifted by the measured shortfall (lib/kinds.ts compensated), at intensity 100.
// Run from the hackathon folder: npx tsx lab/round4.mts      Outputs in lab/out/r4/. Prints no key.
import fs from "node:fs";
// @ts-expect-error plain JS helper
import { run, save } from "./yc.mjs";
import { compensated, colourIntensity } from "../hairloom/lib/kinds.ts";

const BASE = "https://yce-api-01.makeupar.com";
const KEY = /YOUCAM_API_KEY=(\S+)/.exec(fs.readFileSync(new URL("../keys/youcam.env", import.meta.url), "utf8"))![1];
const credit = async () => Math.floor(((await fetch(`${BASE}/s2s/v1.0/client/credit`, { headers: { Authorization: `Bearer ${KEY}` } }).then((r) => r.json())) as { results: { amount_dec?: number; amount?: number }[] }).results.reduce((s, x) => s + (x.amount_dec ?? x.amount ?? 0), 0));
fs.mkdirSync("lab/out/r4", { recursive: true });
const HEX: Record<string, string> = { "14": "#a08262", "16": "#b99d77", "24": "#cfae7b" };
const c0 = await credit();
console.log("balance", c0);
if (c0 - 3 < 515) { console.log("STOP: leave room for the shopPhoto test and the 513 floor"); process.exit(3); }
for (const code of ["14", "16", "24"]) {
  const hex = HEX[code];
  const res = await run("s2s/v2.0/task/hair-color", { src_file_id: "@file:lab/out/demo/margaret/wig_june_1024.jpg", pattern: { name: "full" }, palettes: [{ color: compensated(hex), color_intensity: colourIntensity(hex), shine_intensity: 40 }] });
  await save(`r4/margaret_shade_june_${code}_lift`, res);
  console.log(code, compensated(hex), res.data?.task_status, res.data?.error ?? "", res.ms);
}
console.log("balance now", await credit());
