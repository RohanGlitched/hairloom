// Writes data/identity.json: face keypoint shift between each headwear render and its source photo.
// Needs the dev server: node scripts/measure-identity.cjs http://localhost:3141
const { chromium } = require("I:/Programs/ListofHackathon/hackathons/01-arbitrum-open-house/submission/video/node_modules/playwright");
const fs = require("fs");
const path = require("path");
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto((process.argv[2] ?? "http://localhost:3141") + "/lab/identity", { waitUntil: "load", timeout: 120000 });
  await p.waitForSelector('#out[data-done="1"]', { state: "attached", timeout: 600000 });
  const json = await p.textContent("#out");
  fs.writeFileSync(path.join(__dirname, "..", "data", "identity.json"), json);
  const rows = JSON.parse(json).rows;
  console.log(rows.map((r) => `${r.key} ${r.ok ? r.shift + " " + r.widthRatio : "no single face"}`).join("\n"));
  await b.close();
})();
