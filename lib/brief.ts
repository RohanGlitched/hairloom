import { PERSONAS, persona, type Persona } from "./demo";
import { greyOf, measured, renderLab } from "./colours";
import { deltaE00, greyBlend, labToHex, nearestShades } from "./color";
import { HEADWEAR, WIGS } from "./catalogue";
import { closeness, lengthFromTerm, orLonger, textureFromType } from "./match";
import { demoDates } from "./dates";
import type { SharePayload } from "./seal";
import { trendOf } from "./skinNote";
import publicListings from "../public/stock.public-listings.json";
import { nearestListings, priceOf, type StockItem } from "./stock";

/** What each demo person writes to their fitter (demo people are generated; so are their notes). */
export const NOTES: Record<string, string> = {
  anjali: "I'd like to look like myself at work. Something light, and my scalp is sensitive.",
  nia: "My patches are spreading. I'd like to see a topper now and a full wig for later, and no glue on my scalp.",
  margaret: "I've worn grey-blonde waves for twenty years and I'd like to keep them. Nothing too dark.",
  ravi: "I teach maths and would rather my class didn't notice. Short and simple, like my own hair.",
};

/** Wigs ranked for a demo person after hair loss, closest to the hair they kept first (as the studio ranks them). */
export function rankedFor(p: Persona) {
  const len = lengthFromTerm(p.readings.length?.term), tex = textureFromType(p.readings.type?.mapping), more = orLonger(p.readings.length?.term);
  const kept = measured(`${p.id}/kept`);
  return WIGS.filter((w) => w.fit === p.fit && p.wigs[w.id])
    .map((w) => {
      const lab = renderLab(p.id, `wig:${w.id}`);
      return { w, score: closeness(w, { length: len, texture: tex, orLonger: more }, kept && lab ? deltaE00(kept, lab) : null) };
    })
    .sort((a, b) => b.score - a.score);
}

/** The demo shortlist: own hair back, the closest wig and one headwear, so Share opens with something to send. */
export function demoShortlist(p: Persona): string[] {
  const top = rankedFor(p)[0];
  const head = HEADWEAR.find((h) => p.headwear[h.id] && h.fit === p.fit) ?? HEADWEAR.find((h) => p.headwear[h.id]);
  return [p.own ? "own" : null, top ? `wig:${top.w.id}` : null, head ? `head:${head.id}` : null].filter((k): k is string => !!k);
}

/** A demo fitting brief: what a fitter receives from a demo person, built from precomputed demo output. */
export function demoBrief(id = "anjali", now = Date.now()): SharePayload {
  const p = PERSONAS.find((x) => x.id === id) ?? persona("anjali");
  const lab = measured(`${p.id}/kept`);
  const n = lab ? nearestShades(lab, 1)[0] : null;
  const { keptAt, appointment } = demoDates(now);
  const g = greyOf(`${p.id}/kept`), blend = greyBlend(g?.grey, g?.base);
  const colour = lab && n ? { hex: labToHex(lab), code: n.code, name: n.name, dE: Math.round(n.dE * 10) / 10, ...(g ? { grey: g.grey } : {}), ...(blend ? { blend: blend.code } : {}), ...(g?.base ? { base: labToHex(g.base) } : {}) } : null;
  const skin = trendOf(p.skin ?? []) ?? undefined;
  const listed = (publicListings as { stock: StockItem[] }).stock;
  const base = { v: 1 as const, name: `${p.name} (demo)`, keptAt, kept: p.kept, readings: p.readings, colour, ...(skin ? { skin } : {}), note: NOTES[p.id] ?? "", appointment, cap: p.cap };
  const near = (ids: string[]) => {
    const out = ids.map((id) => WIGS.find((w) => w.id === id)).filter((w): w is (typeof WIGS)[number] => !!w && w.fit === "Women")
      .flatMap((w) => nearestListings(w, listed, 1).map(({ item }) => ({ name: item.name, retailer: item.retailer ?? "", url: item.url!, price: priceOf(item), like: w.name })));
    return out.filter((x, i, a) => a.findIndex((y) => y.url === x.url) === i);
  };
  if (p.id === "anjali") {
    return {
      ...base, listings: near(["asha", "tara"]),
      looks: [
        { key: "hair:asha", label: "Asha", src: p.withHair.asha ?? p.wigs.asha, detail: "Sleek lob, centre parting · Lace front · Heat-friendly synthetic" },
        { key: "shade:asha:4", label: "Asha in shade 4", src: p.shades["asha:4"] ?? p.wigs.asha, detail: "Recoloured to her own shade" },
        { key: "hair:tara", label: "Tara", src: p.withHair.tara ?? p.wigs.tara, detail: "Long, deep side parting, darker root · Hand-tied · Human hair" },
        { key: "head:turban", label: "Jersey turban", src: p.headwear.turban, detail: "Pre-tied, dusty rose" },
      ],
    };
  }
  const later = p.later.toLowerCase();
  const looks: SharePayload["looks"] = [{ key: "own", label: "Own hair", src: p.own, detail: `The hair ${p.fit === "Men" ? "he" : "she"} kept, on the ${later} photo` }];
  for (const { w } of rankedFor(p).slice(0, 2)) looks.push({ key: `wig:${w.id}`, label: w.name, src: p.wigs[w.id], detail: `${w.style} · ${w.cap} · ${w.fibre}` });
  const shade = Object.keys(p.shades)[0];
  if (shade) {
    const [wid, code] = shade.split(":");
    const w = WIGS.find((x) => x.id === wid);
    looks.push({ key: `shade:${wid}:${code}`, label: `${w?.name ?? wid} in shade ${code}`, src: p.shades[shade], detail: "Recoloured towards the kept shade" });
  }
  const head = HEADWEAR.find((h) => p.headwear[h.id] && h.fit === p.fit) ?? HEADWEAR.find((h) => p.headwear[h.id]);
  if (head) looks.push({ key: `head:${head.id}`, label: head.name, src: p.headwear[head.id], detail: head.note });
  return { ...base, looks: looks.slice(0, 5), listings: near(looks.map((l) => l.key.split(":")[1])) };
}
