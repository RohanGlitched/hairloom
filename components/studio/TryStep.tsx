"use client";

import { useEffect, useMemo, useState } from "react";
import { LENGTH_LABEL, WIGS, inr } from "@/lib/catalogue";
import { deltaE00, matchWord, nearestShades, type Lab } from "@/lib/color";
import { keptDelta, wigShade } from "@/lib/colours";
import { prepare } from "@/lib/client";
import { closeness, lengthFromTerm, lengthStep, textureFromType, textureStep } from "@/lib/match";
import type { Ctx } from "./Studio";
import { StepHead } from "./KeepStep";
import s from "./studio.module.css";

export function TryStep({ ctx }: { ctx: Ctx }) {
  const { session, update } = ctx;
  const [sel, setSel] = useState<string>(() => Object.keys(session.renders).find((k) => k.startsWith("wig:")) ?? "own");
  const [busy, setBusy] = useState<string | null>(null);
  const [secs, setSecs] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [keptLab, setKeptLab] = useState<Lab | null>(null);
  const [nowLab, setNowLab] = useState<Lab | null>(null);
  const [fit, setFit] = useState<"All" | "Women" | "Men">("All");

  const keptLen = lengthFromTerm(session.readings?.length?.term);
  const keptTex = textureFromType(session.readings?.type?.mapping);
  const render = session.renders[sel];
  const wigId = sel.startsWith("wig:") ? sel.slice(4) : sel.startsWith("shade:") ? sel.split(":")[1] : null;
  const wig = wigId ? WIGS.find((w) => w.id === wigId) ?? null : null;
  const today = session.today ?? session.kept;

  useEffect(() => {
    if (!session.kept) return;
    import("@/lib/hairColor").then(({ measureHair }) => measureHair(session.kept!)).then((r) => setKeptLab(r?.lab ?? null)).catch(() => undefined);
  }, [session.kept]);
  useEffect(() => {
    setNowLab(null);
    if (!render) return;
    import("@/lib/hairColor").then(({ measureHair }) => measureHair(render.src)).then((r) => setNowLab(r?.lab ?? null)).catch(() => undefined);
  }, [render]);

  const ranked = useMemo(
    () => WIGS.map((w) => ({ w, score: closeness(w, { length: keptLen, texture: keptTex }, session.personaId ? keptDelta(session.personaId, `wig_${w.id}`) : null) })).sort((a, b) => b.score - a.score),
    [keptLen, keptTex, session.personaId],
  );

  async function tryOn(key: string, kind: "wig" | "ownHair" | "hairColor", opt: Record<string, string | number>, images: string[]) {
    if (session.renders[key]) return setSel(key);
    setBusy(key); setMsg(null); setSecs(0);
    const r = await ctx.live(kind, images, opt, key, setSecs);
    setBusy(null);
    if (!r.ok) return setMsg(r.message);
    setSel(key);
  }

  async function newToday(file?: File) {
    if (!file) return;
    const url = await prepare(file, 1024);
    update((x) => ({ ...x, today: url, renders: Object.fromEntries(Object.entries(x.renders).filter(([k]) => !k.startsWith("wig:") && k !== "own" && !k.startsWith("shade:"))) }));
  }

  if (!session.kept || !today) {
    return (
      <div className={s.step}>
        <StepHead n={2} title="Try wigs on your own face" lede="Make your hair passport first, so every try-on can be compared with the hair you kept." />
        <button className="btn btn-ivory" onClick={() => ctx.go("keep")}>Go to step 1</button>
      </div>
    );
  }

  const dE = keptLab && nowLab ? deltaE00(keptLab, nowLab) : null;
  const inList = session.shortlist.includes(sel);
  const cost = (k: string) => (session.renders[k] ? "Ready" : session.mode === "demo" && (k.startsWith("wig:") || k === "own") ? "Ready" : k.startsWith("shade:") ? "1 unit" : "2 units");

  return (
    <div className={s.step}>
      <StepHead
        n={2}
        title={session.mode === "demo" ? `Wigs on ${session.name}'s week-4 photo` : "Try wigs on your own face"}
        lede={session.mode === "demo" ? "Every wig is already rendered, so these are free. Shade changes run live." : "Each wig is placed on your photo by YouCam's hairstyle try-on. Results stay in this browser."}
      />

      <div className={s.tryGrid}>
        <div className={s.mirrorCol}>
          <div className={s.frame}><div className={s.glass}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {render ? <img key={render.src.slice(-40)} src={render.src} alt="Try-on result" /> : <img src={today} alt="Today's photo" />}
            {busy && <div className={s.busy}><span>YouCam is fitting it… {secs} s</span></div>}
          </div></div>
          <div className={s.todayRow}>
            <span className="small">{session.mode === "demo" ? "Base: week-4 photo" : today === session.kept ? "Base: your kept photo" : "Base: today's photo"}</span>
            {session.mode === "live" && (
              <label className="btn btn-ghost btn-sm">
                Use a new photo of today
                <input type="file" accept="image/*" className={s.file} onChange={(e) => newToday(e.target.files?.[0])} />
              </label>
            )}
          </div>
        </div>

        <div className={s.detail}>
          {wig ? (
            <>
              <h2 className="h-sub">{wig.name}{sel.startsWith("shade:") ? `, shade ${sel.split(":")[2]}` : ""}</h2>
              <p className="small">{wig.style} · {wig.cap} · {wig.fibre} · <span className="num">{inr(wig.price)}</span></p>
              <ul className={s.vsList}>
                <li><span>Length</span>{lengthStep(keptLen, wig.length)?.word ?? LENGTH_LABEL[wig.length]}</li>
                <li><span>Texture</span>{textureStep(keptTex, wig.texture)?.word ?? wig.texture}</li>
                <li><span>Colour</span>{dE != null ? <>{matchWord(dE)} <em className="num">ΔE {dE.toFixed(1)}</em></> : render ? "Measuring…" : "Try it on to compare"}</li>
                <li><span>Stock shade</span><i style={{ background: wigShade(wig).hex }} />{wigShade(wig).code}, {wigShade(wig).name.toLowerCase()}</li>
              </ul>
              {render && keptLab && (
                <div className={s.shades}>
                  <p className="small">Order it in a shade closer to your own hair:</p>
                  <div>
                    {nearestShades(keptLab, 3).map((n) => {
                      const key = `shade:${wig.id}:${n.code}`;
                      return (
                        <button key={key} className={s.shadeBtn} disabled={!!busy || (!session.renders[key] && !ctx.units.live)} aria-pressed={sel === key}
                          onClick={() => tryOn(key, "hairColor", { hex: n.hex }, [session.renders[`wig:${wig.id}`]?.src ?? render.src])}>
                          <i style={{ background: n.hex }} />{n.code}<small>{cost(key)}</small>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          ) : sel === "own" ? (
            <>
              <h2 className="h-sub">Your own hair</h2>
              <p className="small">Hairstyle try-on with your kept photo as the reference. Useful after hair loss, and for showing a fitter exactly what you want back.</p>
              {dE != null && <p>{matchWord(dE)} to the kept photo <em className="num small">ΔE {dE.toFixed(1)}</em></p>}
            </>
          ) : (
            <p className="small">Choose a wig below.</p>
          )}
          {render && (
            <p className={s.apiLine}>{render.api}{render.units ? ` · ${render.units} unit${render.units > 1 ? "s" : ""} · ${(render.ms / 1000).toFixed(0)} s` : " · precomputed"}</p>
          )}
          {msg && <p className={s.err} role="alert">{msg}</p>}
          <div className={s.next}>
            {render && (
              <button className="btn btn-ivory btn-sm" onClick={() => update((x) => ({ ...x, shortlist: inList ? x.shortlist.filter((k) => k !== sel) : [...x.shortlist, sel].slice(-4) }))}>
                {inList ? "Remove from shortlist" : "Add to shortlist"}
              </button>
            )}
            <button className="btn btn-ghost btn-sm" disabled={!!busy || (!session.renders.own && !ctx.units.live)} onClick={() => tryOn("own", "ownHair", {}, [today, session.kept!])}>
              My own hair · {cost("own")}
            </button>
          </div>
        </div>
      </div>

      <div className={s.chips} role="radiogroup" aria-label="Show wigs">
        {(["All", "Women", "Men"] as const).map((f) => (
          <button key={f} role="radio" aria-checked={fit === f} onClick={() => setFit(f)}>{f === "All" ? "All wigs" : `${f}'s`}</button>
        ))}
        <span className="small" style={{ alignSelf: "center" }}>Closest to the hair you kept first</span>
      </div>
      <div className={s.rail}>
        {ranked.filter(({ w }) => fit === "All" || w.fit === fit).map(({ w, score }) => {
          const key = `wig:${w.id}`;
          const has = !!session.renders[key];
          return (
            <button key={w.id} className={s.tile} aria-pressed={sel === key} disabled={!!busy || (!has && !ctx.units.live)}
              onClick={() => tryOn(key, "wig", { wig: w.id }, [today])}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={has ? session.renders[key].src : `/catalogue/thumb/${w.id}.jpg`} alt="" loading="lazy" />
              <span><b>{w.name}</b><small>{has ? `${score}% like yours` : busy === key ? "Fitting…" : `Try on · 2 units`}</small></span>
            </button>
          );
        })}
      </div>

      <div className={s.next}>
        <span className="small">{session.shortlist.length} on your shortlist</span>
        <button className="btn btn-ivory" onClick={() => ctx.go("look")}>Next: brows and headwear</button>
      </div>
    </div>
  );
}
