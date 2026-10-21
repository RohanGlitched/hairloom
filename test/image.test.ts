import { test } from "node:test";
import assert from "node:assert/strict";
import { readPhoto } from "../lib/image.ts";
import { dataUrl, jpeg, png } from "./fixtures.ts";

test("photos are checked by their bytes, not the data URL prefix", () => {
  const ok = readPhoto(dataUrl(jpeg(768, 1024)));
  assert.equal(typeof ok, "object");
  assert.deepEqual(ok && typeof ok === "object" ? [ok.type, ok.width, ok.height] : null, ["image/jpeg", 768, 1024]);
  const p = readPhoto(dataUrl(png(1024, 1024), "image/png"));
  assert.equal(typeof p === "object" && p.type, "image/png");

  assert.match(readPhoto("data:image/jpeg;base64,AAAA") as string, /too small/, "the 3-byte junk image from the judge's probe");
  assert.match(readPhoto(dataUrl(new Uint8Array(12_000).fill(7))) as string, /not a JPEG or PNG/);
  assert.match(readPhoto(dataUrl(jpeg(100, 80))) as string, /long side/);
  assert.match(readPhoto(dataUrl(jpeg(4000, 3000))) as string, /long side/);
  assert.match(readPhoto(dataUrl(png(800, 800), "image/png"), true) as string, /JPEG only/, "hair-transfer takes JPEG only");
  assert.match(readPhoto(`data:image/webp;base64,${Buffer.from(jpeg(800, 800)).toString("base64")}`) as string, /not a base64/);
  assert.match(readPhoto(["data:image/jpeg;base64,AAAA"]) as string, /not a data URL/);
  const big = new Uint8Array(2_100_000);
  big.set(jpeg(800, 800));
  assert.match(readPhoto(dataUrl(big)) as string, /too large/);
});

test("a JPEG without a frame header is refused", () => {
  const b = jpeg(800, 800);
  const cut = b.slice(0, b.length - 25); // drop SOF/SOS/EOI
  assert.match(readPhoto(dataUrl(cut)) as string, /unreadable/);
});
