import data from "@/data/colours.json";
import { type Wig, shade } from "./catalogue";
import { type Lab, deltaE00, greyBlend, hexToLab, nearestShades } from "./color";

type Measured = { hex: string; lab: number[]; pixels: number; grey?: number; base?: number[] | null } | null;
const C = data as Record<string, Measured>;

/** Build-time hair colour measurement for a demo image key, e.g. "anjali/kept" or "catalogue/asha". */
export const measured = (key: string): Lab | null => (C[key]?.lab as Lab | undefined) ?? null;

const greys = new Map<string, { grey: number; base: Lab | null } | null>();
/** Grey share of the hair pixels (0-1) and the colour of the rest, for a demo image key. Same object each call. */
export function greyOf(key: string): { grey: number; base: Lab | null } | null {
  if (!greys.has(key)) {
    const m = C[key];
    greys.set(key, m && m.grey != null ? { grey: m.grey, base: (m.base as Lab | null | undefined) ?? null } : null);
  }
  return greys.get(key)!;
}

/**
 * A wig's stock shade is the code the shop lists. Measuring it from a product photo reads darker and
 * less red than the listed code (see /evidence), so the measurement only ranks closeness.
 */
export function wigShade(w: Wig) {
  return shade(w.code);
}

/** Listed code against the shade measured from the product photo, for the evidence page. */
export function shadeCheck(w: Wig) {
  const lab = measured(`catalogue/${w.id}`);
  if (!lab) return null;
  const listed = shade(w.code), got = nearestShades(lab, 1)[0];
  const g = greyOf(`catalogue/${w.id}`);
  const blend = greyBlend(g?.grey, g?.base);
  return { listed, got, dL: lab[0] - hexToLab(listed.hex)[0], dE: deltaE00(lab, hexToLab(listed.hex)), grey: g?.grey ?? null, blend, withGrey: blend?.code ?? got.code };
}

/** ΔE00 between a persona's kept hair and a render, from build-time measurements. */
export function keptDelta(personaId: string, renderKey: string) {
  const a = measured(`${personaId}/kept`), b = measured(`${personaId}/${renderKey}`);
  return a && b ? deltaE00(a, b) : null;
}

/** Build-time measurement for a studio render key ("wig:asha", "hair:asha", "shade:asha:4", "own", "thin:volume"). */
export function renderLab(personaId: string, key: string): Lab | null {
  const k = key === "own" ? "own" : key.replace(/:/g, "_");
  return measured(`${personaId}/${k}`);
}
