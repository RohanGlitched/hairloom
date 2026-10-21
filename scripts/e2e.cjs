// End-to-end check on a running site: demo studio flow, one live shade change (1 unit),
// a sealed fitter link, and opening that link as the fitter.
// node scripts/e2e.cjs https://hairloom-studio.vercel.app
const { chromium } = require("I:/Programs/ListofHackathon/hackathons/01-arbitrum-open-house/submission/video/node_modules/playwright");
const path = require("path");
(async () => {
  const base = process.argv[2] ?? "http://localhost:3141";
  const out = path.join(__dirname, "..", "..", "shots");
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await ctx.newPage();
  const errs = [];
  page.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  page.on("pageerror", (e) => errs.push(String(e)));
  const step = (m) => console.log(new Date().toISOString().slice(11, 19), m);

  await page.goto(`${base}/studio?p=margaret`, { waitUntil: "load" });
  await page.getByRole("button", { name: /Next: try wigs/ }).click();
  step("try step");
  await page.locator("button", { hasText: "Lena" }).first().click();
  await page.getByRole("button", { name: /Add to shortlist/ }).click();
  // Live: recolour the wig to the nearest shade (1 unit).
  const shade = page.locator("button", { hasText: /1 unit/ }).first();
  await shade.waitFor({ timeout: 30000 });
  const t0 = Date.now();
  await shade.click();
  await page.locator("text=Hair Color").first().waitFor({ timeout: 180000 }).catch(() => undefined);
  await page.waitForFunction(() => !document.body.innerText.includes("YouCam is fitting it"), null, { timeout: 180000 });
  step(`live shade done in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  await page.screenshot({ path: path.join(out, "e2e-shade.png") });
  await page.getByRole("button", { name: /Add to shortlist/ }).click().catch(() => undefined);
  await page.getByRole("button", { name: /Next: brows/ }).click();
  await page.locator("button", { hasText: "Silk headscarf" }).first().click();
  await page.getByRole("button", { name: /Add to shortlist/ }).click();
  await page.getByRole("button", { name: /Next: share/ }).click();
  await page.locator("textarea").fill("Prefers a light cap. Wants to keep her grey.");
  await page.getByRole("button", { name: /Create fitter link/ }).click();
  const code = page.locator("code");
  await code.waitFor({ timeout: 60000 });
  const link = await code.textContent();
  step("link made, length " + link.length);
  const f = await ctx.newPage();
  await f.goto(link, { waitUntil: "load" });
  await f.getByText("Their shortlist, on their own face").waitFor({ timeout: 60000 });
  step("fitter opened brief");
  await f.screenshot({ path: path.join(out, "e2e-fitter.png"), fullPage: true });
  console.log(errs.length ? "ERRORS " + errs.join(" | ").slice(0, 600) : "no console errors");
  await b.close();
})().catch((e) => { console.error("FAILED", e.message); process.exit(1); });
