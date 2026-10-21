import { test } from "node:test";
import assert from "node:assert/strict";
import { lengthFromTerm, textureFromType } from "../lib/match.ts";
import { PayloadSchema } from "../lib/seal.ts";

test("YouCam length terms map onto our five lengths", () => {
  assert.equal(lengthFromTerm("above chest"), "shoulder");
  assert.equal(lengthFromTerm("short hair"), "chin");
  assert.equal(lengthFromTerm("above the ear"), "ear");
  assert.equal(lengthFromTerm("long hair"), "chest");
  assert.equal(lengthFromTerm("mid-back"), "midback");
  assert.equal(lengthFromTerm(undefined), null);
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
