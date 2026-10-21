// Saves on-device hair colour measurements of all demo images to data/colours.json.
// Needs the dev server: node scripts/measure.cjs http://localhost:3141
const { chromium } = require("I:/Programs/ListofHackathon/hackathons/01-arbitrum-open-house/submission/video/node_modules/playwright");
const fs = require("fs");
const path = require("path");
(async () => {
  const base = process.argv[2] ?? "http://localhost:3141";
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto(base + "/lab/measure", { waitUntil: "load", timeout: 120000 });
  await p.waitForSelector('#out[data-done="1"]', { timeout: 300000 });
  const file = path.join(__dirname, "..", "data", "colours.json");
  // Merge: entries this run can't re-measure (the unpublished real photographs) are kept.
  const old = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  const json = JSON.stringify({ ...old, ...JSON.parse(await p.textContent("#out")) }, null, 1);
  fs.writeFileSync(file, json);
  console.log("measured", Object.keys(JSON.parse(json)).length);
  await b.close();
})();
