"use client";

import { useState } from "react";
import { HEADWEAR } from "@/lib/catalogue";
import { browPattern, describe } from "@/lib/demo";
import type { Ctx } from "./Studio";
import { StepHead } from "./KeepStep";
import s from "./studio.module.css";

const THICK = [
  { v: -20, label: "Fine" },
  { v: 20, label: "As before" },
  { v: 60, label: "Fuller" },
];

export function LookStep({ ctx }: { ctx: Ctx }) {
  const { session, update } = ctx;
  const [sel, setSel] = useState<string | null>(() => Object.keys(session.renders).find((k) => k.startsWith("head:") || k.startsWith("brows:")) ?? null);
  const [busy, setBusy] = useState<string | null>(null);
  const [secs, setSecs] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [thick, setThick] = useState(20);

  const base = session.today ?? session.kept;
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
  const pattern = browPattern(brow?.left_shape);
  const hex = d.browHex ?? "#3a2a22";
  const render = sel ? session.renders[sel] : null;

  async function run(key: string, kind: "brows" | "headwear", opt: Record<string, string | number>) {
    if (session.renders[key]) return setSel(key);
    setBusy(key); setMsg(null); setSecs(0);
    const r = await ctx.live(kind, [base!], opt, key, setSecs);
    setBusy(null);
    if (!r.ok) return setMsg(r.message);
    setSel(key);
  }

  const browKey = `brows:${pattern}:${thick}`;
  const inList = sel ? session.shortlist.includes(sel) : false;

  return (
    <div className={s.step}>
      <StepHead n={3} title="Brows and headwear" lede="Brows and lashes can thin weeks after the hair on your head. Rebuild them in the shape and shade you kept, and try headwear for the days without a wig." />

      <div className={s.tryGrid}>
        <div className={s.mirrorCol}>
          <div className={s.frame}><div className={s.glass}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img key={(render?.src ?? base).slice(-40)} src={render?.src ?? base} alt={render ? "Result" : "Base photo"} />
            {busy && <div className={s.busy}><span>YouCam is working… {secs} s</span></div>}
          </div></div>
          {render && <p className={s.apiLine}>{render.api}{render.units ? ` · ${render.units} unit${render.units > 1 ? "s" : ""} · ${(render.ms / 1000).toFixed(0)} s` : " · precomputed"}</p>}
          {render && (
            <button className="btn btn-ghost btn-sm" onClick={() => update((x) => ({ ...x, shortlist: inList ? x.shortlist.filter((k) => k !== sel) : [...x.shortlist, sel!].slice(-4) }))}>
              {inList ? "Remove from shortlist" : "Add to shortlist"}
            </button>
          )}
        </div>

        <div className={s.detail}>
          <h2 className="h-sub">Your brows, rebuilt</h2>
          <p className="small">
            From your passport: {brow ? `${brow.left_shape?.toLowerCase()} shape, ${brow.left_body_thickness?.toLowerCase()} body` : "shape not read"}, shade
            <i className={s.inlineChip} style={{ background: hex }} /> {hex}. Drawn with YouCam&rsquo;s makeup try-on using the {pattern} brow pattern.
          </p>
          <div className={s.chips} role="radiogroup" aria-label="Brow fullness">
            {THICK.map((t) => (
              <button key={t.v} role="radio" aria-checked={thick === t.v} onClick={() => setThick(t.v)}>{t.label}</button>
            ))}
          </div>
          <button className="btn btn-ivory btn-sm" disabled={!!busy || (!session.renders[browKey] && !ctx.units.live)} onClick={() => run(browKey, "brows", { pattern, hex, thickness: thick })}>
            {session.renders[browKey] ? "Show brows" : "Rebuild my brows · 1 unit"}
          </button>

          <h2 className="h-sub" style={{ marginTop: 28 }}>Headwear</h2>
          <div className={s.headGrid}>
            {HEADWEAR.map((h) => {
              const key = `head:${h.id}`;
              const has = !!session.renders[key];
              return (
                <button key={h.id} className={s.headBtn} aria-pressed={sel === key} disabled={!!busy || (!has && !ctx.units.live)} onClick={() => run(key, "headwear", { headwear: h.id })}>
                  <b>{h.name}</b>
                  <span>{h.note}</span>
                  <small>{has ? (session.renders[key].units ? "Ready" : "Precomputed") : busy === key ? "Working…" : "Try on · 1 unit"}</small>
                </button>
              );
            })}
          </div>
          <p className="small" style={{ marginTop: 10 }}>
            Headwear is drawn with YouCam&rsquo;s image-to-image generator, told to keep your face, clothes and background. We tested YouCam&rsquo;s hat try-on too: it restyles the whole outfit and once added hair under a beanie on a bald head, which would mislead here.
          </p>
          {msg && <p className={s.err} role="alert">{msg}</p>}
        </div>
      </div>

      <div className={s.next}>
        <button className="btn btn-ivory" onClick={() => ctx.go("share")}>Next: share with your fitter</button>
      </div>
    </div>
  );
}
