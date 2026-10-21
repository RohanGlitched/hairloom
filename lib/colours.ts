import data from "@/data/colours.json";
import { type Wig, shade } from "./catalogue";
import { type Lab, deltaE00, nearestShades } from "./color";

type Measured = { hex: string; lab: number[]; pixels: number } | null;
const C = data as Record<string, Measured>;

/** Build-time hair colour measurement for a demo image key, e.g. "anjali/kept" or "catalogue/asha". */
export const measured = (key: string): Lab | null => (C[key]?.lab as Lab | undefined) ?? null;

/** A wig's shade code: nearest standard shade to its measured colour, else the catalogue value. */
export function wigShade(w: Wig) {
  const lab = measured(`catalogue/${w.id}`);
  if (!lab) return { ...shade(w.code), measured: false };
  const n = nearestShades(lab, 1)[0];
  return { code: n.code, name: n.name, hex: n.hex, measured: true };
}

/** ΔE00 between a persona's kept hair and a render, from build-time measurements. */
export function keptDelta(personaId: string, renderKey: string) {
  const a = measured(`${personaId}/kept`), b = measured(`${personaId}/${renderKey}`);
  return a && b ? deltaE00(a, b) : null;
}
