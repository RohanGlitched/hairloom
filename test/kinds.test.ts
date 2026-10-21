import { test } from "node:test";
import assert from "node:assert/strict";
import { KINDS, isKind, validate } from "../lib/kinds.ts";

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
