import { persona } from "./demo";
import { measured } from "./colours";
import { labToHex, nearestShades } from "./color";
import type { SharePayload } from "./seal";

/** The demo fitting brief: what a fitter receives from Anjali, built from precomputed demo output. */
export function demoBrief(): SharePayload {
  const p = persona("anjali");
  const lab = measured("anjali/kept");
  const n = lab ? nearestShades(lab, 1)[0] : null;
  return {
    v: 1, name: "Anjali (demo)", keptAt: Date.parse("2026-10-21"), kept: p.kept, readings: p.readings,
    colour: lab && n ? { hex: labToHex(lab), code: n.code, name: n.name, dE: Math.round(n.dE * 10) / 10 } : null,
    looks: [
      { key: "hair:asha", label: "Asha", src: p.withHair.asha ?? p.wigs.asha, detail: "Sleek lob, centre parting · Lace front · Heat-friendly synthetic" },
      { key: "shade:asha:4", label: "Asha in shade 4", src: p.shades["asha:4"] ?? p.wigs.asha, detail: "Recoloured to her own shade" },
      { key: "hair:tara", label: "Tara", src: p.withHair.tara ?? p.wigs.tara, detail: "Long, deep side parting, darker root · Hand-tied · Human hair" },
      { key: "head:turban", label: "Jersey turban", src: p.headwear.turban, detail: "Pre-tied, dusty rose" },
    ],
    note: "I'd like to look like myself at work. Something light, and my scalp is sensitive.",
    appointment: "2026-11-04T11:00",
    cap: p.cap,
  };
}
