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
  const json = await p.textContent("#out");
  fs.writeFileSync(path.join(__dirname, "..", "data", "colours.json"), json);
  console.log("measured", Object.keys(JSON.parse(json)).length);
  await b.close();
})();
