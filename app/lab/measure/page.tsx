"use client";

// Build helper: measures hair colour on every demo image in a real browser, so the site can
// rank wigs by colour before any visitor's device has measured anything. Run scripts/measure.cjs.
import { useEffect, useState } from "react";
import { PERSONAS } from "@/lib/demo";
import { WIGS } from "@/lib/catalogue";
import real from "@/data/real.json";

export default function Measure() {
  const [out, setOut] = useState<string>("");
  useEffect(() => {
    (async () => {
      const { measureHair } = await import("@/lib/hairColor");
      const res: Record<string, { hex: string; lab: number[]; pixels: number } | null> = {};
      const jobs: [string, string][] = [];
      for (const w of WIGS) jobs.push([`catalogue/${w.id}`, `/catalogue/${w.id}.jpg`]);
      for (const p of PERSONAS) {
        jobs.push([`${p.id}/kept`, p.kept], [`${p.id}/own`, p.own]);
        for (const [w, src] of Object.entries(p.wigs)) jobs.push([`${p.id}/wig_${w}`, src]);
        for (const [w, src] of Object.entries(p.withHair ?? {})) jobs.push([`${p.id}/hair_${w}`, src]);
        for (const [k, src] of Object.entries(p.shades ?? {})) jobs.push([`${p.id}/shade_${k.replace(":", "_")}`, src]);
        for (const [k, src] of Object.entries(p.thinning ?? {})) jobs.push([`${p.id}/thin_${k}`, src]);
      }
      for (const r of real as { id: string; src: string }[]) jobs.push([`real/${r.id}`, r.src]);
      for (const [k, src] of jobs) {
        const r = await measureHair(src).catch(() => null);
        res[k] = r ? { hex: r.hex, lab: r.lab.map((v) => Math.round(v * 100) / 100), pixels: r.pixels } : null;
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
