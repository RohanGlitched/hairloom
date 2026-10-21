import { LENGTH_LABEL, LENGTH_ORDER, TEXTURE_ORDER, type Length, type Texture, type Wig } from "./catalogue";

/** YouCam hair-length terms -> our five lengths. */
export function lengthFromTerm(term?: string | null): Length | null {
  if (!term) return null;
  const t = term.toLowerCase();
  if (t.includes("ear")) return "ear";
  if (t.includes("chin") || t.includes("neck") || t.includes("short")) return "chin";
  if (t.includes("above chest") || t.includes("shoulder")) return "shoulder";
  if (t.includes("chest")) return "chest";
  if (t.includes("back") || t.includes("waist")) return "midback";
  return null;
}

/** YouCam hair-type mapping ("1 to 2A", "4A to 4B") -> our four textures. */
export function textureFromType(mapping?: string | null): Texture | null {
  if (!mapping) return null;
  const n = Number(mapping.trim()[0]);
  return n === 1 ? "straight" : n === 2 ? "wavy" : n === 3 ? "curly" : n === 4 ? "coily" : null;
}

export function lengthStep(from: Length | null, to: Length) {
  if (!from) return null;
  const d = LENGTH_ORDER.indexOf(to) - LENGTH_ORDER.indexOf(from);
  if (d === 0) return { word: "Same length", d };
  return { word: `${Math.abs(d)} step${Math.abs(d) > 1 ? "s" : ""} ${d < 0 ? "shorter" : "longer"} (${LENGTH_LABEL[to].toLowerCase()})`, d };
}

export function textureStep(from: Texture | null, to: Texture) {
  if (!from) return null;
  const d = TEXTURE_ORDER.indexOf(to) - TEXTURE_ORDER.indexOf(from);
  if (d === 0) return { word: `Same texture (${to})`, d };
  return { word: `${d < 0 ? "Straighter" : "More texture"}: ${to}`, d };
}

/** 0-100 closeness to the kept hair, from length, texture and measured colour difference. */
export function closeness(wig: Wig, kept: { length: Length | null; texture: Texture | null }, dE?: number | null) {
  const l = kept.length ? Math.abs(LENGTH_ORDER.indexOf(wig.length) - LENGTH_ORDER.indexOf(kept.length)) : 1;
  const t = kept.texture ? Math.abs(TEXTURE_ORDER.indexOf(wig.texture) - TEXTURE_ORDER.indexOf(kept.texture)) : 1;
  const c = dE == null ? 6 : dE;
  const score = 100 - l * 14 - t * 16 - Math.min(40, c * 2.2);
  return Math.max(0, Math.round(score));
}
