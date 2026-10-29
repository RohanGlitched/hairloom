// A boutique's own stock, pasted as CSV or JSON on the fitter desk and ranked in the browser against a
// client's passport with the same closeness score the studio uses. No YouCam units, nothing uploaded.
import { z } from "zod";
import { LENGTH_LABEL, SHADES, type Wig } from "./catalogue";
import { deltaE00, hexToLab, type Lab } from "./color";
import { band, capSize, closeness, lengthFromTerm, lengthStep, orLonger, textureFromType, textureStep } from "./match";

export const CAPS = ["Petite", "Average", "Large"] as const;
export type CapSize = (typeof CAPS)[number];

const https = z.string().trim().max(300).refine((u) => /^https:\/\/[^\s"'<>]+$/.test(u), "must start with https://");
export const StockItem = z.object({
  sku: z.string().trim().min(1).max(80),
  name: z.string().trim().min(1).max(80),
  retailer: z.string().trim().max(60).optional(),
  length: z.enum(["ear", "chin", "shoulder", "chest", "midback"]),
  texture: z.enum(["straight", "wavy", "curly", "coily"]),
  /** A wig shade code ("4", "1B", "1B/44") or a hex colour ("#3b2a20"). */
  shade: z.string().trim().min(1).max(12).refine((s) => /^#[0-9a-fA-F]{6}$/.test(s) || /^[0-9A-Za-z]{1,4}(\/[0-9A-Za-z]{1,4})?$/.test(s), "a shade code like 4 or 1B/44, or a hex like #3b2a20"),
  caps: z.array(z.enum(CAPS)).min(1).max(3),
  price_inr: z.number().nonnegative().max(10_000_000).optional(),
  /** A price in another currency, as listed (price_inr wins when both are given). */
  price: z.number().nonnegative().max(10_000_000).optional(),
  currency: z.enum(["INR", "GBP", "USD", "EUR"]).optional(),
  url: https.optional(),
  fit: z.enum(["Women", "Men"]).optional(),
});
export type StockItem = z.infer<typeof StockItem>;

const MAX = 500;
const capList = (v: unknown) => (Array.isArray(v) ? v : String(v ?? "").split(/[|;/]/)).map((c) => String(c).trim()).filter(Boolean)
  .map((c) => CAPS.find((k) => k.toLowerCase() === c.toLowerCase()) ?? c);

/** Normalises one row from CSV or JSON: numbers from text, caps from "Petite|Average", blanks dropped. */
function normalise(raw: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    const key = k.trim().toLowerCase().replace(/[\s-]+/g, "_");
    if (v === "" || v == null) continue;
    out[key === "curl" ? "texture" : key === "price" ? "price_inr" : key === "product_url" ? "url" : key === "cap_sizes" ? "caps" : key] = v;
  }
  if (out.caps !== undefined) out.caps = capList(out.caps);
  if (typeof out.price_inr === "string") out.price_inr = Number(out.price_inr.replace(/[₹,\s]/g, ""));
  if (typeof out.price === "string") out.price = Number(out.price.replace(/[₹£$€,\s]/g, ""));
  if (typeof out.currency === "string") out.currency = out.currency.trim().toUpperCase();
  // "price" means rupees unless another currency is named.
  if (out.price_inr !== undefined && out.currency && out.currency !== "INR" && out.price === undefined) { out.price = out.price_inr; delete out.price_inr; }
  for (const k of ["length", "texture", "fit"]) if (typeof out[k] === "string") out[k] = (out[k] as string).trim();
  if (typeof out.length === "string") out.length = out.length.toLowerCase().replace("mid-back", "midback");
  if (typeof out.texture === "string") out.texture = out.texture.toLowerCase();
  if (typeof out.fit === "string") out.fit = out.fit.charAt(0).toUpperCase() + out.fit.slice(1).toLowerCase();
  return out;
}

/** Splits one CSV line, honouring double quotes. */
function cells(line: string) {
  const out: string[] = [];
  let cur = "", q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

/** Parses pasted stock: a JSON array (or {"stock": [...]}) or CSV with a header row. Rows that fail are reported, not guessed. */
export function parseStock(text: string): { items: StockItem[]; errors: string[] } {
  const t = text.trim();
  if (!t) return { items: [], errors: ["Paste your stock as CSV or JSON first."] };
  let rows: Record<string, unknown>[];
  if (t.startsWith("[") || t.startsWith("{")) {
    try {
      const j = JSON.parse(t) as unknown;
      const arr = Array.isArray(j) ? j : (j as { stock?: unknown }).stock;
      if (!Array.isArray(arr)) return { items: [], errors: ['JSON must be a list of wigs, or {"stock": [...]}.'] };
      rows = arr.filter((r): r is Record<string, unknown> => !!r && typeof r === "object");
    } catch {
      return { items: [], errors: ["That JSON couldn't be read. Check for a missing comma or quote."] };
    }
  } else {
    const lines = t.split(/\r?\n/).filter((l) => l.trim());
    const head = cells(lines[0]);
    rows = lines.slice(1).map((l) => Object.fromEntries(cells(l).map((v, i) => [head[i] ?? `col${i}`, v])));
  }
  const items: StockItem[] = [], errors: string[] = [];
  rows.slice(0, MAX).forEach((r, i) => {
    const p = StockItem.safeParse(normalise(r));
    if (p.success) items.push(p.data);
    else errors.push(`Row ${i + 1}: ${p.error.issues.slice(0, 2).map((x) => `${x.path.join(".") || "row"} ${x.message.toLowerCase()}`).join("; ")}`);
  });
  if (rows.length > MAX) errors.push(`Only the first ${MAX} rows were read.`);
  return { items, errors };
}

/** The colour a shade code or hex stands for; for a blend ("1B/44"), its first code. */
export function shadeLab(shade: string): Lab | null {
  if (/^#[0-9a-fA-F]{6}$/.test(shade)) return hexToLab(shade);
  const s = SHADES.find((x) => x.code.toLowerCase() === shade.split("/")[0].toLowerCase());
  return s ? hexToLab(s.hex) : null;
}

export type Client = {
  name: string;
  lengthTerm?: string | null;
  typeMapping?: string | null;
  lab?: Lab | null;
  code?: string | null;
  blend?: string | null;
  capCm?: number | null;
  fit?: "Women" | "Men" | null;
  appointment?: string | null;
};

export type Ranked = {
  item: StockItem; score: number; band: string; length: string; texture: string;
  pullShade: string; cap: { size: CapSize | null; ok: boolean; note: string }; hold: string;
};

/** Ranks stock against a client's passport: length, texture and colour, as the studio does. */
export function rankStock(items: StockItem[], c: Client): Ranked[] {
  const len = lengthFromTerm(c.lengthTerm), tex = textureFromType(c.typeMapping), more = orLonger(c.lengthTerm);
  const want = capSize(c.capCm) as CapSize | null;
  const scored = items.filter((it) => !c.fit || !it.fit || it.fit === c.fit).map((item) => {
    const lab = shadeLab(item.shade);
    const score = closeness(item as Pick<Wig, "length" | "texture">, { length: len, texture: tex, orLonger: more }, c.lab && lab ? deltaE00(c.lab, lab) : null);
    return { item, score };
  }).sort((a, b) => b.score - a.score);
  const best = scored[0]?.score;
  return scored.map(({ item, score }) => {
    const pullShade = c.code ? `${c.code}${c.blend ? ` or ${c.blend}` : ""}` : item.shade;
    const ok = !want || item.caps.includes(want);
    const size = want && ok ? want : item.caps.includes("Average") ? "Average" : item.caps[0];
    const note = !want ? item.caps.join(", ") : ok ? want : `${item.caps.join(", ")} only; client measures ${want.toLowerCase()}`;
    const hold = `Please hold ${item.sku} (${item.name}) in shade ${pullShade}, cap ${size}${c.name ? `, for ${c.name}` : ""}${c.appointment ? `, fitting ${c.appointment}` : ""}.`;
    return {
      item, score, band: band(score, best),
      length: lengthStep(len, item.length, more)?.word ?? LENGTH_LABEL[item.length],
      texture: textureStep(tex, item.texture)?.word ?? item.texture,
      pullShade, cap: { size, ok, note }, hold,
    };
  });
}

/** A demo wig's stock-keeping code, as in public/stock.example.json. */
export const demoSku = (w: Pick<Wig, "id" | "code">) => `KC-${w.id.toUpperCase()}-${w.code}`;

/** The listed price in its own currency: "₹14,900", "£437.03", "$273.60". */
export function priceOf(it: Pick<StockItem, "price_inr" | "price" | "currency">) {
  if (it.price_inr != null) return "₹" + it.price_inr.toLocaleString("en-IN");
  if (it.price == null) return null;
  const cur = it.currency ?? "INR";
  return new Intl.NumberFormat(cur === "INR" ? "en-IN" : "en-GB", { style: "currency", currency: cur, minimumFractionDigits: Number.isInteger(it.price) ? 0 : 2 }).format(it.price);
}
