import { test } from "node:test";
import assert from "node:assert/strict";
import { liningNote, trendOf } from "../lib/skinNote.ts";

test("a fall in redness or moisture scores suggests a softer cap lining; otherwise nothing", () => {
  const anjali = trendOf([{ scores: { redness: 100, moisture: 43 } }, { scores: { redness: 91, moisture: 55 } }]);
  assert.match(liningNote(anjali)!, /redness 100 to 91.*soft liner or a monofilament cap/);
  assert.doesNotMatch(liningNote(anjali)!, /moisture/, "moisture rose, so it isn't named");
  assert.equal(liningNote(trendOf([{ scores: { redness: 90 } }, { scores: { redness: 88 } }])), null);
  assert.equal(liningNote(trendOf([{ scores: { redness: 90 } }])), null, "one check-in is not a trend");
});
