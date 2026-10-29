"use client";

// Build helper: measures hair colour on every demo image in a real browser, so the site can
// rank wigs by colour before any visitor's device has measured anything. Run scripts/measure.cjs.
import { useEffect, useState } from "react";
import { PERSONAS } from "@/lib/demo";
import { WIGS } from "@/lib/catalogue";

export default function Measure() {
  const [out, setOut] = useState<string>("");
  useEffect(() => {
    (async () => {
      const { measureHair } = await import("@/lib/hairColor");
      const res: Record<string, { hex: string; lab: number[]; pixels: number; grey: number; base: number[] | null } | null> = {};
      const jobs: [string, string][] = [];
      for (const w of WIGS) jobs.push([`catalogue/${w.id}`, `/catalogue/${w.id}.jpg`]);
      for (const p of PERSONAS) {
        jobs.push([`${p.id}/kept`, p.kept], [`${p.id}/own`, p.own]);
        for (const [w, src] of Object.entries(p.wigs)) jobs.push([`${p.id}/wig_${w}`, src]);
        for (const [w, src] of Object.entries(p.withHair ?? {})) jobs.push([`${p.id}/hair_${w}`, src]);
        for (const [k, src] of Object.entries(p.shades ?? {})) jobs.push([`${p.id}/shade_${k.replace(":", "_")}`, src]);
        for (const [k, src] of Object.entries(p.thinning ?? {})) jobs.push([`${p.id}/thin_${k}`, src]);
      }
      // Oct 30: Margaret's light shades re-run at stronger colour intensity.
      // The demo now shows the lifted renders (round 4); the intensity-70 and -100 ones are kept for the evidence page.
      for (const c of ["14", "16", "24"]) jobs.push([`margaret/shade_june_${c}_i70`, `/demo/margaret/shade_june_${c}.jpg`], [`margaret/shade_june_${c}_i100`, `/demo/margaret/shade_june_${c}_i100.jpg`]);
      jobs.push(["margaret/shade_june_24_i90", "/demo/margaret/shade_june_24_i90.jpg"]);
      for (const c of ["14", "16", "24"]) jobs.push([`margaret/shade_june_${c}_lift`, `/demo/margaret/shade_june_${c}_lift.jpg`]);
      // Real photographs are not published; their measurements are kept from earlier runs (see measure.cjs).
      for (const [k, src] of jobs) {
        const r = await measureHair(src).catch(() => null);
        const round = (l: number[]) => l.map((v) => Math.round(v * 100) / 100);
        res[k] = r ? { hex: r.hex, lab: round(r.lab), pixels: r.pixels, grey: Math.round(r.grey * 1000) / 1000, base: r.base ? round(r.base) : null } : null;
      }
      setOut(JSON.stringify(res, null, 1));
    })();
  }, []);
  return (
    <div className="wrap" style={{ padding: "40px 0" }}>
      <h1 className="h-sub">Colour measurement</h1>
      <pre id="out" data-done={out ? "1" : "0"} style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>{out || "measuring…"}</pre>
    </div>
  );
}
