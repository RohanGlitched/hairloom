// Full-page screenshots for design review: node scripts/shots.cjs [base] [paths...]
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");

(async () => {
  const [base = "http://localhost:3141", ...paths] = process.argv.slice(2);
  const pages = paths.length ? paths : ["/"];
  const out = path.join(__dirname, "..", "..", "shots");
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  for (const [w, h, tag] of [[1440, 900, "d"], [390, 844, "m"]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    for (const p of pages) {
      const page = await ctx.newPage();
      const errs = [];
      page.on("console", (m) => m.type() === "error" && errs.push(m.text()));
      await page.goto(base + p, { waitUntil: "load", timeout: 90000 });
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } window.scrollTo(0, 0); });
      await page.waitForTimeout(1500);
      const sw = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
      const name = (p === "/" ? "home" : p.replace(/[\/#?]/g, "_").replace(/^_/, "")) + "-" + tag + ".png";
      await page.screenshot({ path: path.join(out, name), fullPage: true });
      console.log(name, "scrollWidth", sw.join("/"), errs.length ? "ERRORS: " + errs.join(" | ").slice(0, 300) : "");
      await page.close();
    }
    await ctx.close();
  }
  await b.close();
})();
