import { test } from "node:test";
import assert from "node:assert/strict";
import { KINDS } from "../lib/kinds.ts";
import { API_COUNT, RUNS, TOTALS, byApi, missingEvidence } from "../lib/evidence.ts";

test("every YouCam API the studio calls has a successful run in the ledger", () => {
  assert.deepEqual(missingEvidence(), []);
  for (const k of Object.values(KINDS)) assert.ok(RUNS.some((r) => r.api === k.api && r.ok), k.api);
});

test("the API count is the number of distinct APIs in the whitelist", () => {
  assert.equal(API_COUNT, new Set(Object.values(KINDS).map((k) => k.api)).size);
});

test("ledger totals add up", () => {
  const rows = byApi();
  assert.equal(rows.reduce((n, r) => n + r.runs, 0), TOTALS.runs);
  assert.equal(rows.reduce((n, r) => n + r.ok, 0), TOTALS.ok);
  assert.equal(TOTALS.demo.runs + TOTALS.real.runs + TOTALS.research.runs, TOTALS.runs);
});

test("shop-photo try-ons have their own Hairstyle row", () => {
  const hs = byApi().filter((r) => r.api === "AI Hairstyle Virtual Try-On");
  const shop = hs.find((r) => r.scope.includes("shop"));
  assert.ok(shop && shop.runs === RUNS.filter((r) => /^r4\/shop_/.test(r.name)).length);
  assert.ok(hs.some((r) => r.scope === "" && r.real && r.real.runs > 0));
});

test("real-photo failures are not hidden by the table", () => {
  const rows = byApi();
  const face = rows.filter((r) => r.api.startsWith("AI Face Attribute"));
  assert.ok(face.some((r) => r.scope.includes("real photos") && r.scope.includes("default") && r.ok === 0 && r.runs > 0));
  assert.ok(face.some((r) => r.scope.includes("flexible") && r.ok === r.runs));
  const len = rows.find((r) => r.api.startsWith("AI Hair Length") && r.scope.includes("real photos"));
  assert.ok(len && len.ok < len.runs);
});
