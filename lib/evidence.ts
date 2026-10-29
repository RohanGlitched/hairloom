import ledger from "@/data/lab-runs.json";
import { KINDS } from "./kinds";

export type Origin = "demo" | "real-photo" | "research";
export type Run = { name: string; api: string; origin: Origin; variant?: string; ok: boolean; error: string | null; ms: number };

/** Built by scripts/export-runs.mjs from the output file of every task we kept. */
export const RUNS = ledger.tasks as unknown as Run[];
export const LEDGER = { source: ledger.source, generated: ledger.generated, origins: ledger.origins as Record<Origin, { runs: number; ok: number }> };

/** The distinct YouCam APIs the studio calls, counted from the server's whitelist (two kinds share hair-transfer). */
export const STUDIO_APIS = [...new Set(Object.values(KINDS).map((k) => k.api))];
export const API_COUNT = STUDIO_APIS.length;
const WORDS = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen"];
export const API_COUNT_WORD = WORDS[API_COUNT] ?? String(API_COUNT);

/** Tried while researching, then left out of the studio. */
export const REJECTED: Record<string, string> = {
  "AI Hat Virtual Try-On": "Restyles the whole person and, on a bald head, added hair under a beanie. Headwear uses image-to-image instead.",
  "AI Scarf Virtual Try-On": "Draws a neck scarf, not a head scarf.",
  "AI Hair Density Detection": "Rejected every photo in the ledger with error_face_angle_invalid: a front photo and a head-down photo (Oct 21); two crown photos tilted about 30° forward, and two front-facing selfies from about 45° below and 45° above (Oct 30). It needs the guided camera in hairdensity mode.",
  "AI Facial Color Tones Analyzer": "Returned the same hair-colour label as Face Attribute, at 20 units a run against 10.",
};
const DEMO_ONLY = "AI Image Generator (text to image)";

const median = (xs: number[]) => { const v = [...xs].sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : 0; };

/** Face and length behave very differently on generated and real photos, so they get a row for each. */
const SPLIT = new Set(["AI Face Attribute & Ratio Analyzer", "AI Hair Length Detection"]);
/** A shop's own product photo as the try-on reference (the shopPhoto kind) gets its own Hairstyle row. */
export const isShopPhotoRun = (r: Run) => /^r4\/shop_/.test(r.name);
const scopeOf = (r: Run) => (isShopPhotoRun(r) ? "a shop's product photo as the reference" : !SPLIT.has(r.api) ? "" : [r.origin === "real-photo" ? "real photos" : "generated people", r.variant].filter(Boolean).join(", "));

export type Row = {
  api: string; scope: string; group: "studio" | "demo" | "rejected";
  runs: number; ok: number; medianS: number; errors: string[]; real: { runs: number; ok: number } | null;
};

/** Per-API success counts and median wall time (create -> result, including our 4 s polling). */
export function byApi(): Row[] {
  const m = new Map<string, Run[]>();
  for (const r of RUNS) { const k = `${r.api}|${scopeOf(r)}`; m.set(k, [...(m.get(k) ?? []), r]); }
  const rows = [...m.entries()].map(([k, rs]) => {
    const [api, scope] = k.split("|");
    const real = rs.filter((r) => r.origin === "real-photo");
    return {
      api, scope, group: STUDIO_APIS.includes(api) ? "studio" as const : api === DEMO_ONLY ? "demo" as const : "rejected" as const,
      runs: rs.length, ok: rs.filter((r) => r.ok).length, medianS: median(rs.filter((r) => r.ok).map((r) => r.ms)) / 1000,
      errors: [...new Set(rs.filter((r) => !r.ok).map((r) => r.error ?? "failed"))],
      real: real.length && !scope ? { runs: real.length, ok: real.filter((r) => r.ok).length } : null,
    };
  });
  // Studio APIs in the order the whitelist lists them, then by scope; the rest by run count.
  const order = (a: string) => { const i = STUDIO_APIS.indexOf(a); return i < 0 ? 99 : i; };
  return rows.sort((a, b) => (order(a.api) - order(b.api)) || a.scope.localeCompare(b.scope) || b.runs - a.runs);
}

export const TOTALS = {
  runs: RUNS.length,
  ok: RUNS.filter((r) => r.ok).length,
  demo: LEDGER.origins.demo,
  real: LEDGER.origins["real-photo"],
  research: LEDGER.origins.research,
};

/** Studio APIs with no successful run in the ledger. Empty when every shipped API has evidence. */
export const missingEvidence = () => STUDIO_APIS.filter((a) => !RUNS.some((r) => r.api === a && r.ok));

/** Hairstyle try-ons on bald photos, counted from the ledger: wigs and own-hair restorations on the demo people's
 * after-hair-loss photos, and wig try-ons on the real shaved heads (with how many heads). */
export function baldCounts(shavedHeads: number) {
  const demoWig = RUNS.filter((r) => /^demo\/[^/]+\/wig_/.test(r.name));
  const demoOwn = RUNS.filter((r) => /^demo\/[^/]+\/own$/.test(r.name));
  const people = new Set(demoWig.map((r) => r.name.split("/")[1])).size;
  return { wigs: demoWig.length, wigsOk: demoWig.filter((r) => r.ok).length, own: demoOwn.length, ownOk: demoOwn.filter((r) => r.ok).length, people, shavedHeads };
}
