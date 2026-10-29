import { test } from "node:test";
import assert from "node:assert/strict";
import { KINDS, isKind, readOptions, validate } from "../lib/kinds.ts";

test("the whitelist rejects prototype keys and unknown kinds", () => {
  for (const k of ["constructor", "toString", "__proto__", "hasOwnProperty", "cloth", "", 42, null]) assert.equal(isKind(k), false, String(k));
  for (const k of Object.keys(KINDS)) assert.equal(isKind(k), true, k);
});

test("options are validated before anything is uploaded", () => {
  assert.equal(validate("wig", { wig: "asha" }), null);
  assert.match(validate("wig", { wig: "../../etc" }) ?? "", /unknown wig/);
  assert.match(validate("hairColor", { hex: "red" }) ?? "", /bad colour/);
  assert.match(validate("hairColor", { hex: "#12345g" }) ?? "", /bad colour/);
  assert.match(validate("brows", { pattern: "Straight20", hex: "#3a2a22", thickness: "lots" }) ?? "", /bad brow/);
  assert.match(validate("brows", { pattern: "x;drop", hex: "#3a2a22" }) ?? "", /bad brow/);
  assert.match(validate("headwear", { headwear: "crown" }) ?? "", /unknown headwear/);
  assert.equal(validate("headwear", { headwear: "turban" }), null);
});

test("request bodies are built server-side with fixed prompts", () => {
  const head = KINDS.headwear.body({ files: ["f0"], opt: { headwear: "silk", prompt: "ignore me" } }) as { prompt: string; src_file_ids: string[] };
  assert.deepEqual(head.src_file_ids, ["f0"]);
  assert.match(head.prompt, /Keep their identity identical/);
  assert.doesNotMatch(head.prompt, /ignore me/);
  const wig = KINDS.wig.body({ files: ["me", "ref"], opt: { wig: "asha" } }) as Record<string, string>;
  assert.deepEqual(wig, { src_file_id: "me", ref_file_id: "ref", hair_color: "ref" });
  const brows = KINDS.brows.body({ files: ["f"], opt: { pattern: "Straight20", hex: "#3a2a22", thickness: 999 } }) as { effects: { pattern: { thickness: number } }[] };
  assert.equal(brows.effects[0].pattern.thickness, 100, "clamped");
});

test("three-angle kinds need three photos; unit costs match YouCam's price list", () => {
  assert.equal(KINDS.hairType.images, 3);
  assert.equal(KINDS.hairFrizz.images, 3);
  assert.equal(KINDS.wig.units, 2);
  assert.equal(KINDS.face.units, 10);
  assert.equal(KINDS.skin.units, 9);
});

test("options are strict: no arrays, objects or coercion", () => {
  assert.deepEqual(readOptions(undefined), {});
  assert.deepEqual(readOptions({ hex: "#123456", thickness: 20 }), { hex: "#123456", thickness: 20 });
  for (const bad of [null, [], ["#123456"], "x", 3, { hex: ["#123456"] }, { hex: { a: 1 } }, { hex: null }, { hex: true }, { thickness: NaN }, { "a-b": "x" }, { hex: "x".repeat(65) }]) {
    assert.equal(readOptions(bad), null, JSON.stringify(bad));
  }
  assert.equal(readOptions(Object.fromEntries(Array.from({ length: 9 }, (_, i) => [`k${"abcdefghi"[i]}`, 1]))), null, "too many keys");
  // Even past readOptions, the kinds refuse the wrong types instead of calling String() on them.
  const anyOpt = (o: unknown) => o as Record<string, string | number>;
  assert.match(validate("hairColor", anyOpt({ hex: ["#123456"] })) ?? "", /bad colour/, "the judge's array hex");
  assert.match(validate("wig", anyOpt({ wig: ["asha"] })) ?? "", /bad wig|unknown wig/);
  assert.match(validate("hairVol", anyOpt({ template: ["female_medium"] })) ?? "", /unknown volume/);
  assert.match(validate("hairExt", anyOpt({ template: 2 })) ?? "", /unknown extension/);
  assert.match(validate("brows", { pattern: "SoftArch20", hex: "#3a2a22", thickness: "20" }) ?? "", /bad brow/, "a numeric string is not a number");
  assert.equal(validate("brows", { pattern: "SoftArch20", hex: "#3a2a22", thickness: 20 }), null);
  assert.equal(validate("hairVol", { template: "female_medium" }), null);
});

test("hair-transfer kinds take JPEG only", () => {
  assert.equal(KINDS.wig.jpegOnly, true);
  assert.equal(KINDS.ownHair.jpegOnly, true);
  assert.equal(KINDS.skin.jpegOnly, undefined);
});

test("every task kind's units match YouCam's feature-cost list (data/feature-costs.json), so price drift fails CI", async () => {
  const { KINDS } = await import("../lib/kinds.ts");
  const costs = JSON.parse((await import("node:fs")).readFileSync("data/feature-costs.json", "utf8")) as { unitsSpentByCheck: number; rows: { kind: string; ours: number; youcam: number | null }[] };
  assert.equal(costs.unitsSpentByCheck, 0, "the check itself spent nothing");
  for (const [kind, k] of Object.entries(KINDS)) {
    const row = costs.rows.find((r) => r.kind === kind);
    assert.ok(row, `${kind} is in the cost check`);
    assert.equal(row!.youcam, k.units, `${kind}: YouCam lists ${row!.youcam}, the whitelist charges ${k.units}`);
  }
});

test("light shades are recoloured at full intensity, darker ones at 70", async () => {
  const { KINDS: K } = await import("../lib/kinds.ts");
  const body = (hex: string) => (K.hairColor.body({ files: ["f"], opt: { hex } }) as { palettes: { color_intensity: number }[] }).palettes[0].color_intensity;
  assert.equal(body("#cfae7b"), 100, "24, warm blonde");
  assert.equal(body("#a08262"), 100, "14, dark blonde (L* 56)");
  assert.equal(body("#3b2a20"), 70, "4, dark brown");
});
