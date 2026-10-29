"use client";

import { useState } from "react";
import { HEADWEAR } from "@/lib/catalogue";
import { browPattern, describe } from "@/lib/demo";
import { Reveal } from "@/components/Reveal";
import type { Ctx } from "./Studio";
import { StepHead } from "./KeepStep";
import s from "./studio.module.css";

const FULLNESS = [
  { v: -20, label: "Finer" },
  { v: 20, label: "As before" },
  { v: 60, label: "Fuller" },
];

export function LookStep({ ctx }: { ctx: Ctx }) {
  const { session, update } = ctx;
  const [sel, setSel] = useState<string | null>(() => (session.renders["brows:demo"] ? "brows:demo" : Object.keys(session.renders).find((k) => k.startsWith("head:")) ?? null));
  const [busy, setBusy] = useState<string | null>(null);
  const [secs, setSecs] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [thick, setThick] = useState(20);

  const base = session.today ?? session.kept;
  const baseLabel = session.today ? session.later ?? "Today" : "Kept photo";
  if (!base || !session.readings) {
    return (
      <div className={s.step}>
        <StepHead n={3} title="Brows and headwear" lede="Make your hair passport first. Your brows are rebuilt from the shape and colour it records." />
        <button className="btn btn-ivory" onClick={() => ctx.go("keep")}>Go to step 1</button>
      </div>
    );
  }

  const d = describe(session.readings);
  const brow = session.readings.face?.eyebrow;
  const browKey = session.mode === "demo" && session.renders["brows:demo"] ? "brows:demo" : `brows:${browPattern(brow?.left_shape)}:${thick}`;
  const render = sel ? session.renders[sel] : null;
  const inList = sel ? session.shortlist.includes(sel) : false;

  async function run(key: string, kind: "brows" | "headwear", opt: Record<string, string | number>) {
    if (session.renders[key]) return setSel(key);
    if (session.mode === "demo" && !window.confirm("This one isn't prepared for the demo person, so it runs live on YouCam (about 15 seconds). Go ahead?")) return;
    setBusy(key); setMsg(null); setSecs(0);
    const r = await ctx.live(kind, [base!], opt, key, setSecs);
    setBusy(null);
    if (!r.ok) return setMsg(r.message);
    setSel(key);
  }

  return (
    <div className={s.step}>
      <StepHead n={3} title="Brows and headwear" lede="Brows and lashes can thin weeks after the hair on your head. Rebuild them in the shape and shade you kept, and try headwear for the days without a wig." />

      <div className={s.tryGrid}>
        <div className={s.mirrorCol} id="look-mirror">
          {render ? (
            <Reveal before={base} after={render.src} beforeAlt={baseLabel} afterAlt="Result" beforeLabel={baseLabel} afterLabel={sel?.startsWith("brows") ? "Brows" : HEADWEAR.find((h) => `head:${h.id}` === sel)?.name ?? "Look"} label="Compare with the photo underneath" initial={sel?.startsWith("brows") ? 50 : 100} size="fill" />
          ) : (
            <div className={s.frame}><div className={s.glass}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={base} alt={baseLabel} />
            </div></div>
          )}
          {busy && <p className={s.busyLine}>YouCam is working… {secs} s</p>}
          {render && (
            <button className="btn btn-ghost btn-sm" onClick={() => update((x) => ({ ...x, shortlist: inList ? x.shortlist.filter((k) => k !== sel) : [...x.shortlist, sel!].slice(-4) }))}>
              {inList ? "Remove from shortlist" : "Add to shortlist"}
            </button>
          )}
        </div>

        <div className={s.detail}>
          <h2 className="h-sub">{session.mode === "demo" ? `${session.name}'s brows, rebuilt` : "Your brows, rebuilt"}</h2>
          <p className="small">
            Drawn in the shape and shade your passport kept ({brow ? `${brow.left_shape?.toLowerCase()}, ${brow.left_body_thickness?.toLowerCase()}` : "shape not read"}
            {d.browHex && <i className={s.inlineChip} style={{ background: d.browHex }} aria-hidden="true" />}), with YouCam&rsquo;s makeup try-on. A brow pencil in that shade is a good thing to buy early.
          </p>
          {browKey !== "brows:demo" && (
            <div className={s.chips} role="radiogroup" aria-label="Brow fullness">
              {FULLNESS.map((t) => (
                <button key={t.v} role="radio" aria-checked={thick === t.v} onClick={() => setThick(t.v)}>{t.label}</button>
              ))}
            </div>
          )}
          {session.renders[browKey] ? (
            // A two-state toggle: the mirror shows the rebuilt brows, or the photo underneath.
            <button className={s.toggle} aria-pressed={sel === browKey} onClick={() => setSel(sel === browKey ? null : browKey)}>
              <span className={s.toggleBox} aria-hidden="true">{sel === browKey ? "✓" : ""}</span>
              {sel === browKey ? "Rebuilt brows shown" : "Show rebuilt brows"}
              <small>{sel === browKey ? `Tap to see the ${baseLabel.toLowerCase()} photo` : `On the ${baseLabel.toLowerCase()} photo`}</small>
            </button>
          ) : (
            <button className="btn btn-ivory btn-sm" disabled={!!busy || !ctx.units.live} onClick={() => run(browKey, "brows", { pattern: browPattern(brow?.left_shape), hex: d.browHex ?? "#3a2a22", thickness: thick })}>
              {session.mode === "demo" ? "Rebuild brows (runs live)" : "Rebuild my brows · 1 unit"}
            </button>
          )}

          <h2 className="h-sub" style={{ marginTop: 28 }}>Headwear</h2>
          <div className={s.headGrid}>
            {HEADWEAR.filter((h) => h.fit === "All" || h.fit === (session.fit === "Men" ? "Men" : "Women")).map((h) => {
              const key = `head:${h.id}`;
              const has = !!session.renders[key];
              return (
                <button key={h.id} className={`${s.headBtn} ${has ? s.headWith : ""}`} aria-pressed={sel === key} disabled={!!busy || (!has && !ctx.units.live)} onClick={() => { if (window.innerWidth < 900) document.getElementById("look-mirror")?.scrollIntoView({ behavior: "smooth", block: "start" }); void run(key, "headwear", { headwear: h.id }); }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {has && <img className={s.headThumb} src={session.renders[key].src} alt="" loading="lazy" />}
                  <span className={s.headText}>
                    <b>{h.name}</b>
                    <span>{h.note}</span>
                    {!has && <small>{busy === key ? "Working…" : session.mode === "demo" ? "Runs live" : "Try on · 1 unit"}</small>}
                  </span>
                </button>
              );
            })}
          </div>
          {msg && <p className={s.err} role="alert">{msg}</p>}
        </div>
      </div>

      <div className={s.next}>
        <button className="btn btn-ivory" onClick={() => ctx.go("share")}>Next: share with your fitter</button>
      </div>
    </div>
  );
}
