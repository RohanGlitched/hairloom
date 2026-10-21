// Walks the studio with a demo person and screenshots each step: node scripts/studio-shots.cjs [base] [persona] [width]
const { chromium } = require("I:/Programs/ListofHackathon/hackathons/01-arbitrum-open-house/submission/video/node_modules/playwright");
const path = require("path");
(async () => {
  const [base = "http://localhost:3141", who = "anjali", w = "1440"] = process.argv.slice(2);
  const out = path.join(__dirname, "..", "..", "shots");
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: Number(w), height: 900 } });
  const errs = [];
  page.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  page.on("pageerror", (e) => errs.push(String(e)));
  await page.goto(`${base}/studio?p=${who}`, { waitUntil: "load", timeout: 90000 });
  await page.waitForTimeout(2500);
  const shot = async (n) => { await page.waitForTimeout(1500); await page.screenshot({ path: path.join(out, `studio-${n}-${w}.png`), fullPage: true }); console.log(n); };
  await shot("1keep");
  await page.getByRole("button", { name: /Next: try wigs/ }).click();
  await shot("2try");
  await page.getByRole("button", { name: /Add to shortlist/ }).first().click();
  await page.locator("button", { hasText: "Nora" }).first().click();
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: /Add to shortlist/ }).first().click();
  await page.getByRole("button", { name: /Next: brows/ }).click();
  await page.locator("button", { hasText: "Jersey turban" }).first().click();
  await shot("3look");
  await page.getByRole("button", { name: /Next: share/ }).click();
  await shot("4share");
  console.log(errs.length ? "ERRORS " + errs.join(" | ").slice(0, 500) : "no errors");
  await b.close();
})();
