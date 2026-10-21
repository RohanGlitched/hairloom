"use client";

import { useEffect, useMemo, useState } from "react";
import { HEADWEAR, LENGTH_LABEL, WIGS, inr } from "@/lib/catalogue";
import { keptDelta, wigShade } from "@/lib/colours";
import { deltaE00, matchWord, type Lab } from "@/lib/color";
import type { Persona } from "@/lib/demo";
import { closeness, lengthFromTerm, lengthStep, textureFromType, textureStep } from "@/lib/match";
import s from "./FittingRoom.module.css";

type Look = { kind: "own" } | { kind: "wig"; id: string } | { kind: "head"; id: string } | { kind: "week4" };

/** The demo fitting room: every render here is precomputed YouCam output, so it spends no units. */
export function FittingRoom({ personas, compact = false }: { personas: Persona[]; compact?: boolean }) {
  const [pid, setPid] = useState(personas[0].id);
  const p = personas.find((x) => x.id === pid) ?? personas[0];
  const [look, setLook] = useState<Look>({ kind: "wig", id: firstWig(p) });
  const [kept, setKept] = useState<Lab | null>(null);
  const [now, setNow] = useState<Lab | null>(null);
  const [measuring, setMeasuring] = useState(false);

  const src = look.kind === "own" ? p.own : look.kind === "week4" ? p.week4 : look.kind === "wig" ? p.wigs[look.id] : p.headwear[look.id];
  const wig = look.kind === "wig" ? WIGS.find((w) => w.id === look.id)! : null;
  const keptLen = lengthFromTerm(p.readings.length?.term);
  const keptTex = textureFromType(p.readings.type?.mapping);

  // Measure hair colour on this device: the kept photo once per person, the render on each change.
  useEffect(() => {
    let live = true;
    setKept(null);
    import("@/lib/hairColor").then(({ measureHair }) => measureHair(p.kept)).then((r) => live && setKept(r?.lab ?? null)).catch(() => undefined);
    return () => { live = false; };
  }, [p.kept]);
  useEffect(() => {
    let live = true;
    setNow(null);
    if (look.kind === "head" || look.kind === "week4" || !src) return;
    setMeasuring(true);
    import("@/lib/hairColor").then(({ measureHair }) => measureHair(src)).then((r) => live && setNow(r?.lab ?? null)).catch(() => undefined).finally(() => live && setMeasuring(false));
    return () => { live = false; };
  }, [src, look.kind]);

  const dE = kept && now ? deltaE00(kept, now) : null;
  const ranked = useMemo(
    () => WIGS.filter((w) => p.wigs[w.id] && w.fit === "Women").map((w) => ({ w, score: closeness(w, { length: keptLen, texture: keptTex }, keptDelta(p.id, `wig_${w.id}`)) })).sort((a, b) => b.score - a.score),
    [p, keptLen, keptTex],
  );

  return (
    <div className={s.room}>
      <div className={s.people} role="tablist" aria-label="Demo person">
        {personas.map((x) => (
          <button key={x.id} role="tab" aria-selected={x.id === pid} className={s.person} onClick={() => { setPid(x.id); setLook({ kind: "wig", id: firstWig(x) }); }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={x.kept} alt="" />
            <span><b>{x.name}</b>{x.age}, {x.city}</span>
          </button>
        ))}
      </div>

      <div className={s.stage}>
        <div className={s.mirrorCol}>
          <div className={s.frame}><div className={s.glass}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {src && <img key={src} src={src} alt={`${p.name} ${lookLabel(look)}`} />}
          </div></div>
          <div className={s.quick}>
            <button aria-pressed={look.kind === "week4"} onClick={() => setLook({ kind: "week4" })}>Week 4</button>
            <button aria-pressed={look.kind === "own"} onClick={() => setLook({ kind: "own" })}>Her own hair</button>
          </div>
        </div>

        <div className={s.card} aria-live="polite">
          <p className="kicker">{p.name}, week 4</p>
          {look.kind === "wig" && wig && (
            <>
              <h3>{wig.name}</h3>
              <p className={s.style}>{wig.style}</p>
              <dl className={s.facts}>
                <dt>Shade</dt><dd><i style={{ background: wigShade(wig).hex }} />{wigShade(wig).code}, {wigShade(wig).name.toLowerCase()}</dd>
                <dt>Length</dt><dd>{LENGTH_LABEL[wig.length]}</dd>
                <dt>Cap</dt><dd>{wig.cap}</dd>
                <dt>Fibre</dt><dd>{wig.fibre}</dd>
                <dt>Care</dt><dd>{wig.care}</dd>
                <dt>Price</dt><dd className="num">{inr(wig.price)}</dd>
              </dl>
              <div className={s.vs}>
                <h4>Against the hair she kept</h4>
                <ul>
                  <li><span>Length</span>{lengthStep(keptLen, wig.length)?.word ?? "Not measured"}</li>
                  <li><span>Texture</span>{textureStep(keptTex, wig.texture)?.word ?? "Not measured"}</li>
                  <li><span>Colour</span>{dE != null ? <>{matchWord(dE)} <em className="num">ΔE {dE.toFixed(1)}</em></> : measuring ? "Measuring on this device…" : "Measuring…"}</li>
                </ul>
              </div>
            </>
          )}
          {look.kind === "own" && (
            <>
              <h3>Her own hair</h3>
              <p className={s.style}>Hairstyle try-on with her kept photo as the reference, placed on her week-4 photo.</p>
              <div className={s.vs}><ul><li><span>Colour</span>{dE != null ? <>{matchWord(dE)} to the kept photo <em className="num">ΔE {dE.toFixed(1)}</em></> : "Measuring…"}</li></ul></div>
            </>
          )}
          {look.kind === "week4" && (
            <>
              <h3>Week 4</h3>
              <p className={s.style}>Hair usually starts to fall out two to three weeks after the first chemotherapy cycle. Every try-on here starts from this photo.</p>
            </>
          )}
          {look.kind === "head" && (
            <>
              <h3>{HEADWEAR.find((h) => h.id === look.id)?.name}</h3>
              <p className={s.style}>{HEADWEAR.find((h) => h.id === look.id)?.note}</p>
            </>
          )}
          <p className={s.api}>
            {look.kind === "head" ? "YouCam AI Image Generator, image to image, 1 unit" : look.kind === "week4" ? "YouCam AI Image Generator, image to image" : "YouCam AI Hairstyle Virtual Try-On v2.1, 2 units"}
          </p>
        </div>
      </div>

      <div className={s.rail} aria-label="Wigs, closest to her own hair first">
        {ranked.map(({ w, score }) => (
          <button key={w.id} className={s.tile} aria-pressed={look.kind === "wig" && look.id === w.id} onClick={() => setLook({ kind: "wig", id: w.id })}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/catalogue/thumb/${w.id}.jpg`} alt="" loading="lazy" />
            <span><b>{w.name}</b><small className="num">{score}% like hers</small></span>
          </button>
        ))}
      </div>
      {!compact && (
        <div className={s.headRail} aria-label="Headwear">
          {HEADWEAR.filter((h) => p.headwear[h.id]).map((h) => (
            <button key={h.id} aria-pressed={look.kind === "head" && look.id === h.id} onClick={() => setLook({ kind: "head", id: h.id })}>{h.name}</button>
          ))}
        </div>
      )}
    </div>
  );
}

function firstWig(p: Persona) {
  const len = lengthFromTerm(p.readings.length?.term);
  const tex = textureFromType(p.readings.type?.mapping);
  return WIGS.filter((w) => p.wigs[w.id] && w.fit === "Women").map((w) => ({ w, s: closeness(w, { length: len, texture: tex }, keptDelta(p.id, `wig_${w.id}`)) })).sort((a, b) => b.s - a.s)[0]?.w.id ?? "asha";
}

function lookLabel(l: Look) {
  return l.kind === "own" ? "with her own hair restored" : l.kind === "week4" ? "at week 4" : l.kind === "wig" ? `wearing the ${l.id} wig` : `wearing ${l.id}`;
}
