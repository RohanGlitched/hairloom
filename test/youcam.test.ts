import { test } from "node:test";
import assert from "node:assert/strict";
import { limiter } from "../lib/youcam.ts";

test("YouCam calls share one rate limit, with a judges' share the public can't take", () => {
  let t = 0;
  const take = limiter(40, 10, () => t);
  let pub = 0;
  while (take("public")) pub++;
  assert.equal(pub, 30, "the public gets 30 of 40 a minute");
  let judge = 0;
  while (take("judge")) judge++;
  assert.equal(judge, 10, "the judges' 10 are still there");
  t += 2000;
  assert.equal(take("public"), true, "30 a minute: one back every 2 s");
  assert.equal(take("public"), false);
  t += 6000;
  assert.equal(take("judge"), true, "10 a minute for judges, and they may borrow the public's");
  assert.equal(take("judge"), true);
  assert.equal(take("judge"), true);
  assert.equal(take("judge"), true);
  assert.equal(take("judge"), false);
  t += 600_000;
  let all = 0;
  while (take("judge")) all++;
  assert.equal(all, 40, "full again, and never above 40");
});
