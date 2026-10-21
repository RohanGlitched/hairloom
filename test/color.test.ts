import { test } from "node:test";
import assert from "node:assert/strict";
import { deltaE00, hexToLab, labToHex, nearestShades, type Lab } from "../lib/color.ts";

// Reference pairs from Sharma, Wu & Dalal (2005), "The CIEDE2000 color-difference formula".
const SHARMA: [Lab, Lab, number][] = [
  [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425],
  [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
  [[50, 2.8361, -74.02], [50, 0, -82.7485], 3.4412],
  [[50, 0, 0], [50, -1, 2], 2.3669],
  [[50, 2.5, 0], [73, 25, -18], 27.1492],
  [[50, 2.5, 0], [56, -27, -3], 31.903],
  [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644],
  [[90.8027, -2.0831, 1.441], [91.1528, -1.6435, 0.0447], 1.4441],
];

test("CIEDE2000 matches the Sharma reference pairs", () => {
  for (const [a, b, want] of SHARMA) {
    assert.ok(Math.abs(deltaE00(a, b) - want) < 1e-4, `${a} vs ${b}: got ${deltaE00(a, b)}, want ${want}`);
    assert.ok(Math.abs(deltaE00(b, a) - want) < 1e-4, "symmetric");
  }
});

test("hex survives a round trip through CIELAB", () => {
  for (const hex of ["#000000", "#ffffff", "#342820", "#c9a46a", "#0d120f", "#ad9881"]) {
    assert.equal(labToHex(hexToLab(hex)), hex);
  }
});

test("nearest wig shade for measured demo hair", () => {
  assert.equal(nearestShades(hexToLab("#342820"), 1)[0].code, "4"); // Anjali, dark brown
  assert.equal(nearestShades(hexToLab("#0d120f"), 1)[0].code, "1"); // Nia, jet black
  assert.ok(deltaE00(hexToLab("#342820"), hexToLab("#FAF0BE")) > 60, "YouCam's 'Blonde' reading is far from the pixels");
});
