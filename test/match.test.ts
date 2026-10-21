import { test } from "node:test";
import assert from "node:assert/strict";
import { closeness, lengthFromTerm, lengthStep, orLonger, textureFromType } from "../lib/match.ts";
import { PayloadSchema } from "../lib/seal.ts";

test("YouCam's eight documented length terms map onto our five lengths", () => {
  // research/docs/reference_ai_hair_length_detection.md, the `term` result strings.
  const table: [string, string, boolean][] = [
    ["above the ears", "ear", false],
    ["ear length", "ear", false],
    ["ear length or longer", "ear", true],
    ["short hair", "chin", false],
    ["short hair or longer", "chin", true],
    ["above chest", "shoulder", false],
    ["above chest or longer", "shoulder", true],
    ["long hair", "chest", false],
  ];
  for (const [term, length, atLeast] of table) {
    assert.equal(lengthFromTerm(term), length, term);
    assert.equal(orLonger(term), atLeast, term);
  }
  assert.equal(lengthFromTerm(undefined), null);
  assert.equal(lengthFromTerm("Ear Length Or Longer"), "ear", "case");
});

test('"or longer" is a lower bound: longer wigs are not penalised, shorter ones are', () => {
  const kept = { length: lengthFromTerm("ear length or longer"), texture: "straight" as const, orLonger: true };
  const exact = { ...kept, orLonger: false };
  const at = closeness({ length: "ear", texture: "straight" }, kept, 0);
  assert.equal(closeness({ length: "chest", texture: "straight" }, kept, 0), at, "a chest wig is within ear length or longer");
  assert.ok(closeness({ length: "chest", texture: "straight" }, exact, 0) < at, "an exact length still counts the gap");
  const mid = { length: lengthFromTerm("above chest or longer"), texture: "wavy" as const, orLonger: true };
  assert.ok(closeness({ length: "chin", texture: "wavy" }, mid, 0) < closeness({ length: "midback", texture: "wavy" }, mid, 0), "shorter is a change");
  assert.match(lengthStep("ear", "chest", true)!.word, /or longer/);
  assert.match(lengthStep("ear", "chest")!.word, /3 steps longer/);
});

test("YouCam hair type mappings map onto textures", () => {
  assert.equal(textureFromType("1 to 2A"), "straight");
  assert.equal(textureFromType("2B to 2C"), "wavy");
  assert.equal(textureFromType("3a to 3b"), "curly");
  assert.equal(textureFromType("4A to 4B"), "coily");
});

test("decrypted shares are validated before rendering", () => {
  const ok = {
    v: 1, name: "Anjali", keptAt: 1, kept: "data:image/jpeg;base64,AAAA", note: "", colour: { hex: "#342820", code: "4", name: "Dark brown", dE: 3 },
    readings: { type: null, frizz: null, length: { term: "above chest" }, face: null },
    looks: [{ key: "wig:asha", label: "Asha", src: "data:image/jpeg;base64,AAAA", detail: "" }],
  };
  assert.equal(PayloadSchema.safeParse(ok).success, true);
  assert.equal(PayloadSchema.safeParse({ ...ok, colour: { ...ok.colour, hex: "url(https://evil.example/x)" } }).success, false, "CSS injection in a colour");
  assert.equal(PayloadSchema.safeParse({ ...ok, kept: "https://evil.example/track.jpg" }).success, false, "remote image");
  assert.equal(PayloadSchema.safeParse({ ...ok, looks: Array(7).fill(ok.looks[0]) }).success, false, "too many looks");
});
