// Saves on-device hair colour measurements of all demo images to data/colours.json.
// Needs the dev server: node scripts/measure.cjs http://localhost:3141
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
(async () => {
  const base = process.argv[2] ?? "http://localhost:3141";
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto(base + "/lab/measure", { waitUntil: "load", timeout: 120000 });
  await p.waitForSelector('#out[data-done="1"]', { state: "attached", timeout: 900000 });
  const file = path.join(__dirname, "..", "data", "colours.json");
  // Merge: entries this run can't re-measure (the unpublished real photographs) are kept.
  const old = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  // --keep-lab: add the grey share and base colour, but keep earlier colour readings exactly as published.
  const fresh = JSON.parse(await p.textContent("#out"));
  if (process.argv.includes("--keep-lab")) {
    let worst = 0;
    for (const [k, v] of Object.entries(fresh)) {
      const o = old[k];
      if (!v || !o) continue;
      worst = Math.max(worst, ...v.lab.map((x, i) => Math.abs(x - o.lab[i])));
      fresh[k] = { ...v, hex: o.hex, lab: o.lab, pixels: o.pixels };
    }
    console.log("largest change in a kept L*a*b* value:", worst.toFixed(2));
  }
  const json = JSON.stringify({ ...old, ...fresh }, null, 1);
  fs.writeFileSync(file, json);
  console.log("measured", Object.keys(JSON.parse(json)).length);
  await b.close();
})();
