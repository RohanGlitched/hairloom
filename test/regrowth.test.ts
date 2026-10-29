import { test } from "node:test";
import assert from "node:assert/strict";
import { bridgeFor, regrowthDiff } from "../lib/regrowth.ts";
import regrowth from "../data/regrowth.json" with { type: "json" };

test("regrowth is compared with the hair kept: curlier and shorter after chemotherapy", () => {
  const kept = { type: { mapping: "1 to 2A", term: "Straight to Slight Wavy" }, length: { term: "above chest" } };
  const d = regrowthDiff(kept, regrowth.anjali.readings);
  assert.match(d.curl!.word, /^Curlier: straight to curly$/);
  assert.match(d.length!.word, /^Shorter: shoulder to chin$/);
  assert.equal(d.summary, "New growth reads curlier and shorter than the hair kept.");
  assert.equal(regrowthDiff(kept, kept).summary, "New growth reads like the hair kept.");
  assert.equal(regrowthDiff(kept, { type: null, length: null }).curl!.word, "Not enough to compare");
});

test("the bridge wigs are ranked against the new growth, not the hair kept", () => {
  const top = bridgeFor(regrowth.anjali.readings, "Women");
  assert.equal(top.length, 2);
  assert.ok(top.every(({ w }) => w.length === "chin" || w.length === "shoulder" || w.length === "ear"), "short wigs first");
  assert.ok(top.some(({ w }) => w.texture === "curly" || w.texture === "coily"), "a curly one among them");
});
