import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { parseStock, rankStock } from "../lib/stock.ts";
import { hexToLab } from "../lib/color.ts";

test("the example stock file parses with no errors, one row per demo wig", () => {
  const { items, errors } = parseStock(fs.readFileSync("public/stock.example.json", "utf8"));
  assert.deepEqual(errors, []);
  assert.equal(items.length, 16);
  assert.ok(items.every((i) => i.url?.startsWith("https://") && i.caps.length > 0));
});

test("CSV with quotes, caps split on |, prices with symbols; bad rows are reported, not guessed", () => {
  const csv = [
    "SKU,Name,Length,Curl,Shade,Cap sizes,Price,Product URL",
    'AB-1,"Lob, sleek",shoulder,straight,4,Petite|Average,"₹15,900",https://shop.example/ab-1',
    "AB-2,Pixie,ear,straight,30,Large,9900,http://insecure.example/ab-2",
    "AB-3,Waves,knee,wavy,6,Average,,",
  ].join("\n");
  const { items, errors } = parseStock(csv);
  assert.equal(items.length, 1);
  assert.equal(items[0].name, "Lob, sleek");
  assert.deepEqual(items[0].caps, ["Petite", "Average"]);
  assert.equal(items[0].price_inr, 15900);
  assert.equal(errors.length, 2, "an http link and an unknown length are both refused");
});

test("stock is ranked against the passport, with a hold note in the client's shade and cap", () => {
  const { items } = parseStock(JSON.stringify([
    { sku: "A", name: "Close", length: "shoulder", texture: "straight", shade: "4", caps: ["Average"] },
    { sku: "B", name: "Far", length: "ear", texture: "coily", shade: "613", caps: ["Petite"] },
  ]));
  const r = rankStock(items, { name: "Anjali", lengthTerm: "above chest", typeMapping: "1 to 2A", lab: hexToLab("#3b2a20"), code: "4", capCm: 55.5, appointment: "Sat 31 Oct, 11:00" });
  assert.equal(r[0].item.sku, "A");
  assert.equal(r[0].band, "Closest to yours");
  assert.match(r[0].hold, /hold A \(Close\) in shade 4, cap Average, for Anjali, fitting Sat 31 Oct/);
  assert.equal(r[1].cap.ok, false, "a petite-only wig is flagged for an average head");
});

test("the public-listings example parses: real product pages, metadata only, priced in their own currency", async () => {
  const { priceOf } = await import("../lib/stock.ts");
  const { items, errors } = parseStock(fs.readFileSync("public/stock.public-listings.json", "utf8"));
  assert.deepEqual(errors, []);
  assert.ok(items.length >= 12);
  assert.ok(items.every((i) => i.url?.startsWith("https://") && i.retailer && i.currency && i.price != null && i.price_inr == null));
  assert.equal(priceOf({ price: 437.03, currency: "GBP" }), "£437.03");
  assert.equal(priceOf({ price_inr: 14900 }), "₹14,900");
});
