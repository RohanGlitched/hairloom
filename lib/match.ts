import { LENGTH_LABEL, LENGTH_ORDER, TEXTURE_ORDER, type Length, type Texture, type Wig } from "./catalogue";

/**
 * YouCam's eight hair-length terms -> our five lengths: "above the ears", "ear length", "short hair",
 * "above chest", "long hair", and three "… or longer". Those are lower bounds: they map to the stated
 * length, and `orLonger` tells `closeness` not to count a longer wig against it.
 */
export const orLonger = (term?: string | null) => !!term && /\bor longer\s*$/i.test(term);
export function lengthFromTerm(term?: string | null): Length | null {
  if (!term) return null;
  const t = term.toLowerCase().replace(/\s*or longer\s*$/, "");
  if (t.includes("ear")) return "ear";
  if (t.includes("chin") || t.includes("neck") || t.includes("short")) return "chin";
  if (t.includes("above chest") || t.includes("shoulder")) return "shoulder";
  if (t.includes("chest") || t.includes("long")) return "chest";
  if (t.includes("back") || t.includes("waist")) return "midback";
  return null;
}

/** YouCam hair-type mapping ("1 to 2A", "4A to 4B") -> our four textures. */
export function textureFromType(mapping?: string | null): Texture | null {
  if (!mapping) return null;
  const n = Number(mapping.trim()[0]);
  return n === 1 ? "straight" : n === 2 ? "wavy" : n === 3 ? "curly" : n === 4 ? "coily" : null;
}

export function lengthStep(from: Length | null, to: Length, atLeast = false) {
  if (!from) return null;
  const d = LENGTH_ORDER.indexOf(to) - LENGTH_ORDER.indexOf(from);
  if (d === 0) return { word: "Same length", d };
  if (atLeast && d > 0) return { word: `Within "${LENGTH_LABEL[from].toLowerCase()} or longer" (${LENGTH_LABEL[to].toLowerCase()})`, d };
  return { word: `${Math.abs(d)} step${Math.abs(d) > 1 ? "s" : ""} ${d < 0 ? "shorter" : "longer"} (${LENGTH_LABEL[to].toLowerCase()})`, d };
}

export function textureStep(from: Texture | null, to: Texture) {
  if (!from) return null;
  const d = TEXTURE_ORDER.indexOf(to) - TEXTURE_ORDER.indexOf(from);
  if (d === 0) return { word: `Same texture (${to})`, d };
  return { word: `${d < 0 ? "Straighter" : "More texture"}: ${to}`, d };
}

/** 0-100 closeness to the kept hair, from length, texture and measured colour difference. "Or longer": a longer wig costs nothing. */
export function closeness(wig: Pick<Wig, "length" | "texture">, kept: { length: Length | null; texture: Texture | null; orLonger?: boolean }, dE?: number | null) {
  const dl = kept.length ? LENGTH_ORDER.indexOf(wig.length) - LENGTH_ORDER.indexOf(kept.length) : 1;
  const l = kept.orLonger && dl > 0 ? 0 : Math.abs(dl);
  const t = kept.texture ? Math.abs(TEXTURE_ORDER.indexOf(wig.texture) - TEXTURE_ORDER.indexOf(kept.texture)) : 1;
  const c = dE == null ? 6 : dE;
  const score = 100 - l * 14 - t * 16 - Math.min(40, c * 2.2);
  return Math.max(0, Math.round(score));
}

/** The closeness score with its parts: length and texture steps away, and the colour difference used. */
export function closenessParts(wig: Pick<Wig, "length" | "texture">, kept: { length: Length | null; texture: Texture | null; orLonger?: boolean }, dE?: number | null) {
  const dl = kept.length ? LENGTH_ORDER.indexOf(wig.length) - LENGTH_ORDER.indexOf(kept.length) : null;
  const dt = kept.texture ? TEXTURE_ORDER.indexOf(wig.texture) - TEXTURE_ORDER.indexOf(kept.texture) : null;
  return { score: closeness(wig, kept, dE), length: dl == null ? null : kept.orLonger && dl > 0 ? 0 : dl, texture: dt, dE: dE ?? null };
}

/** "82/100: length same, texture +1, colour ΔE00 1.6" */
export function partsWords(p: ReturnType<typeof closenessParts>) {
  const step = (n: number | null, name: string) => (n == null ? `${name} not read` : n === 0 ? `${name} same` : `${name} ${n > 0 ? "+" : ""}${n}`);
  return `${p.score}/100: ${step(p.length, "length")}, ${step(p.texture, "texture")}, colour ${p.dE == null ? "not measured" : `ΔE00 ${p.dE.toFixed(1)}`}`;
}

/**
 * Plain words for the closeness score, instead of a percentage. With `best`, the top of a weak list says
 * so: when nothing in stock is close, the few nearest are "Nearest in this shop", not "A new look".
 */
export function band(score: number, best?: number) {
  if (score >= 75) return "Closest to yours";
  if (best != null && best < 50 && score >= best - 6) return "Nearest in this shop";
  if (best != null && score === best) return "Closest in stock";
  if (score >= 50) return "A small change";
  return "A new look";
}

/** Approximate industry cap sizing from head circumference (brands vary). */
export function capSize(cm: number | null | undefined) {
  if (!cm) return null;
  if (cm < 54.5) return "Petite";
  if (cm <= 57.2) return "Average";
  return "Large";
}
