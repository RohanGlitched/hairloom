// Oct 30 round 4: one live shopPhoto try-on through the deployed studio (2 units, public lane), with a
// shop's product photo (the demo boutique's Rosa) as the reference on Anjali's week-4 photo.
// Writes lab/out/r4/shop_rosa.json (ledger format) and shop_rosa.jpg. No key is used here: it is the site's own route.
// node lab/shoptest.cjs  (from the hackathon folder)
const { chromium } = require("../hairloom/node_modules/playwright");
const fs = require("fs");
const path = require("path");
const SITE = "https://hairloom-studio.vercel.app";
const OUT = path.join(__dirname, "out", "r4");
fs.mkdirSync(OUT, { recursive: true });
(async () => {
  const demo = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "hairloom", "data", "demo.json"), "utf8")).personas.find((p) => p.id === "anjali");
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  let posts = 0, t0 = 0, status = null, error = null;
  await ctx.route("**/api/try**", (r) => {
    const q = r.request();
    if (q.method() === "POST" && !q.url().includes("_method=DELETE") && ++posts > 1) return r.abort();
    if (q.method() === "POST" && posts === 1 && !t0) t0 = Date.now();
    return r.continue();
  });
  const page = await ctx.newPage();
  page.on("dialog", (d) => d.dismiss());
  page.on("response", async (res) => {
    if (!res.url().includes("/api/try") || res.request().method() !== "GET") return;
    const j = await res.json().catch(() => null);
    if (j && j.status && j.status !== "running") { status = j.status; error = j.code ?? null; }
  });
  await page.goto(SITE + "/studio", { waitUntil: "load" });
  await page.evaluate(async ([p]) => {
    const jpeg = async (src) => { const i = new Image(); i.src = src; await i.decode(); const k = Math.min(1, 1024 / Math.max(i.naturalWidth, i.naturalHeight)); const c = document.createElement("canvas"); c.width = Math.round(i.naturalWidth * k); c.height = Math.round(i.naturalHeight * k); c.getContext("2d").drawImage(i, 0, 0, c.width, c.height); return c.toDataURL("image/jpeg", 0.9); };
    const session = { mode: "live", name: "Anjali (demo photos)", kept: await jpeg(p.kept), turns: [], readings: p.readings, keptAt: Date.now(), today: await jpeg(p.week4), base: "today", later: "Week 4", situation: "chemo", fit: "Women", cap: p.cap, consent: Date.now(), renders: {}, shortlist: [], note: "", unitsSpent: 0 };
    await new Promise((res, rej) => { const r = indexedDB.open("hairloom", 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => { const t = r.result.transaction("kv", "readwrite"); t.objectStore("kv").put(session, "session"); t.oncomplete = res; t.onerror = rej; }; r.onerror = rej; });
  }, [demo]);
  await page.goto(SITE + "/studio?step=try", { waitUntil: "load" });
  await page.getByText("Try on · 2 units").first().waitFor({ timeout: 30000 });
  await page.locator('label:has-text("Try a wig photo from any shop") input[type=file]').setInputFiles(path.join(__dirname, "..", "hairloom", "public", "catalogue", "rosa.jpg"));
  await page.getByText(/A shop.s wig photo/).first().waitFor({ timeout: 240000 }).catch(() => undefined);
  await page.waitForTimeout(3000);
  const ms = Date.now() - t0;
  const src = await page.evaluate(() => [...document.querySelectorAll("img")].map((i) => i.src).find((s) => s.startsWith("data:image") && s.length > 50000) ?? null);
  // (The first version also saved the largest page image here, which turned out to be the kept photo, not the result; it was deleted.)
  fs.writeFileSync(path.join(OUT, "shop_rosa.json"), JSON.stringify({ via: "deployed /api/try, kind shopPhoto", data: { task_status: status ?? "unknown", error }, ms }, null, 2));
  console.log("posts", posts, "status", status, "error", error, "ms", ms, "image", !!src);
  await b.close();
})();
