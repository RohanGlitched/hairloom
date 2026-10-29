// Skin AI doing a job for the wig: when cosmetic skin check-ins read more sensitive over treatment,
// the fitter is told to think about the cap lining. Rules only, no units; not a diagnosis.

export type SkinTrend = { redness?: [number, number]; moisture?: [number, number] };

/** YouCam's raw scores, where higher is better: a fall of 5 or more counts as a change. */
export function liningNote(t: SkinTrend | null | undefined): string | null {
  if (!t) return null;
  const fell = (["redness", "moisture"] as const).filter((k) => t[k] && t[k]![0] - t[k]![1] >= 5);
  if (!fell.length) return null;
  const what = fell.map((k) => `${k} ${t[k]![0]} to ${t[k]![1]}`).join(", ");
  return `Skin check-ins read more sensitive over treatment (${what}; YouCam's cosmetic scores, higher is better): consider a soft liner or a monofilament cap. Not a diagnosis.`;
}

/** First and latest check-in scores as a trend. */
export function trendOf(checks: { scores: Record<string, number> }[]): SkinTrend | null {
  if (checks.length < 2) return null;
  const a = checks[0].scores, b = checks[checks.length - 1].scores;
  const pair = (k: string): [number, number] | undefined => (a[k] != null && b[k] != null ? [a[k], b[k]] : undefined);
  return { redness: pair("redness"), moisture: pair("moisture") };
}
