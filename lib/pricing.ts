import { KINDS, type KindName } from "./kinds";

/**
 * YouCam API prices in thousandths of a dollar per unit (read Oct 21, 2026): $0.048 on the 500-unit
 * subscription ($0.047 at 5k, $0.046 at 10k a month), $0.055 pay as you go. Integer mills keep
 * rounding honest: 41 units pay as you go is $2.255, shown as $2.26.
 */
export const MILLS = { sub: 48, payg: 55 } as const;
export type Plan = keyof typeof MILLS;

export const usd = (units: number, plan: Plan) => (Math.round((units * MILLS[plan]) / 10) / 100).toFixed(2);

/** A draft pilot price for a fitter brief, before GST. */
export const BRIEF_INR = 399;

export type Step = [KindName, number, string];
export type Fitting = { id: "chemo" | "thinning" | "sponsored"; title: string; who: string; steps: Step[] };

export const FITTINGS: Fitting[] = [
  {
    id: "chemo",
    title: "Wig fitting",
    who: "Chemotherapy or alopecia: a full passport, the shortlist on her face and the extras a fitter brief carries.",
    steps: [
      ["hairType", 1, "Curl pattern"],
      ["hairFrizz", 1, "Frizz"],
      ["hairLength", 1, "Length"],
      ["face", 1, "Face shape and brows (optional)"],
      ["wig", 8, "Wig try-ons"],
      ["ownHair", 1, "Own hair, restored"],
      ["hairColor", 3, "Recolour to closer shades"],
      ["headwear", 3, "Headwear"],
      ["brows", 1, "Rebuilt brows"],
    ],
  },
  {
    id: "thinning",
    title: "Thinning",
    who: "Pattern thinning, about 40% of women by 50 (DermNet): volume and clip-in previews, before a fitter shows toppers or a wig.",
    steps: [
      ["hairType", 1, "Curl pattern"],
      ["hairFrizz", 1, "Frizz"],
      ["hairLength", 1, "Length"],
      ["hairVol", 2, "Volume previews"],
      ["hairExt", 2, "Clip-in length previews"],
    ],
  },
  {
    id: "sponsored",
    title: "Sponsored passport",
    who: "What a hospital, wig bank or CSR sponsor pays per patient at diagnosis: the passport, own hair kept, two wigs tried.",
    steps: [
      ["hairType", 1, "Curl pattern"],
      ["hairFrizz", 1, "Frizz"],
      ["hairLength", 1, "Length"],
      ["face", 1, "Face shape and brows"],
      ["ownHair", 1, "Own hair, restored"],
      ["wig", 2, "Wig try-ons"],
    ],
  },
];

export const unitsOf = (f: Fitting) => f.steps.reduce((n, [k, times]) => n + KINDS[k].units * times, 0);
export const fitting = (id: Fitting["id"]) => FITTINGS.find((f) => f.id === id)!;
