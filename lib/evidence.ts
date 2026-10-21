import runs from "@/data/lab-runs.json";

export type Run = { name: string; api: string; ok: boolean; error: string | null; ms: number };
export const RUNS = runs as Run[];

const median = (xs: number[]) => { const v = [...xs].sort((a, b) => a - b); return v.length ? v[Math.floor(v.length / 2)] : 0; };

/** Per-API success counts and median wall time (create -> result, including our 4 s polling). */
export function byApi() {
  const m = new Map<string, Run[]>();
  for (const r of RUNS) m.set(r.api, [...(m.get(r.api) ?? []), r]);
  return [...m.entries()]
    .map(([api, rs]) => ({ api, runs: rs.length, ok: rs.filter((r) => r.ok).length, medianS: median(rs.filter((r) => r.ok).map((r) => r.ms)) / 1000, errors: [...new Set(rs.filter((r) => !r.ok).map((r) => r.error))] }))
    .sort((a, b) => b.runs - a.runs);
}

export const TOTALS = { runs: RUNS.length, ok: RUNS.filter((r) => r.ok).length };
