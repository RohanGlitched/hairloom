"use client";

import { useMemo, useState } from "react";
import { HEADWEAR, LENGTH_LABEL, WIGS, inr } from "@/lib/catalogue";
import { deltaE00, matchWord } from "@/lib/color";
import { measured, renderLab, wigShade } from "@/lib/colours";
import type { Persona } from "@/lib/demo";
import { band, closeness, lengthFromTerm, lengthStep, textureFromType, textureStep } from "@/lib/match";
import s from "./FittingRoom.module.css";

type Look = { kind: "own" } | { kind: "wig"; id: string } | { kind: "head"; id: string } | { kind: "later" };

function rank(p: Persona) {
  const len = lengthFromTerm(p.readings.length?.term), tex = textureFromType(p.readings.type?.mapping), k = measured(`${p.id}/kept`);
  return WIGS.filter((w) => p.wigs[w.id] && w.fit === p.fit)
    .map((w) => { const lab = renderLab(p.id, `wig:${w.id}`); return { w, score: closeness(w, { length: len, texture: tex }, k && lab ? deltaE00(k, lab) : null) }; })
    .sort((a, b) => b.score - a.score);
}

/**
 * The demo fitting room: every render is precomputed YouCam output and every colour was measured
 * at build time, so this spends no units and downloads no models.
 */
export function FittingRoom({ personas }: { personas: Persona[] }) {
  const [pid, setPid] = useState(personas[0].id);
  const p = personas.find((x) => x.id === pid) ?? personas[0];
  const ranked = useMemo(() => rank(p), [p]);
  const [look, setLook] = useState<Look>({ kind: "wig", id: rank(personas[0])[0]?.w.id ?? "asha" });
  const choose = (x: Persona) => { setPid(x.id); setLook({ kind: "wig", id: rank(x)[0]?.w.id ?? "asha" }); };

  const keptLen = lengthFromTerm(p.readings.length?.term);
  const keptTex = textureFromType(p.readings.type?.mapping);
  const kept = measured(`${p.id}/kept`);
  const src = look.kind === "own" ? p.own : look.kind === "later" ? p.week4 : look.kind === "wig" ? p.wigs[look.id] : p.headwear[look.id];
  const wig = look.kind === "wig" ? WIGS.find((w) => w.id === look.id) ?? null : null;
  const nowLab = look.kind === "wig" ? renderLab(p.id, `wig:${look.id}`) : look.kind === "own" ? renderLab(p.id, "own") : null;
  const dE = kept && nowLab ? deltaE00(kept, nowLab) : null;
  const he = p.fit === "Men";
  const their = he ? "his" : "her";

  return (
    <div className={s.room}>
      <div className={s.people} role="tablist" aria-label="Demo person">
        {personas.map((x) => (
          <button key={x.id} role="tab" aria-selected={x.id === pid} className={s.person} onClick={() => choose(x)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={x.kept} alt="" />
            <span><b>{x.name}</b>{x.situation === "alopecia" ? "Alopecia" : "Chemotherapy"}, {x.city}</span>
          </button>
        ))}
      </div>

      <div className={s.stage}>
        <div className={s.mirrorCol}>
          <div className={s.frame}><div className={s.glass}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {src && <img key={src} src={src} alt={`${p.name}: ${lookLabel(look, p.later)}`} />}
          </div></div>
          <div className={s.quick}>
            <button aria-pressed={look.kind === "later"} onClick={() => setLook({ kind: "later" })}>{p.later}, no wig</button>
            <button aria-pressed={look.kind === "own"} onClick={() => setLook({ kind: "own" })}>{he ? "His" : "Her"} own hair</button>
          </div>
        </div>

        <div className={s.rail} aria-label={`Wigs, closest to ${their} own hair first`}>
          {ranked.map(({ w, score }) => (
            <button key={w.id} className={s.tile} aria-pressed={look.kind === "wig" && look.id === w.id} onClick={() => setLook({ kind: "wig", id: w.id })}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.wigs[w.id]} alt="" loading="lazy" />
              <span><b>{w.name}</b><small>{band(score)}</small></span>
            </button>
          ))}
        </div>

        <div className={s.card} aria-live="polite">
          <p className="kicker">{p.name}, {p.later.toLowerCase()}</p>
          {look.kind === "wig" && wig && (
            <>
              <h3>{wig.name}</h3>
              <p className={s.style}>{wig.style}</p>
              <dl className={s.facts}>
                <dt>Shade</dt><dd><i style={{ background: wigShade(wig).hex }} aria-hidden="true" />{wigShade(wig).code}, {wigShade(wig).name.toLowerCase()}</dd>
                <dt>Length</dt><dd>{LENGTH_LABEL[wig.length]}</dd>
                <dt>Cap</dt><dd>{wig.cap}</dd>
                <dt>Fibre</dt><dd>{wig.fibre}</dd>
                <dt>Price</dt><dd className="num">{inr(wig.price)}</dd>
              </dl>
              <div className={s.vs}>
                <h4>Against the hair {he ? "he" : "she"} kept</h4>
                <ul>
                  <li><span>Length</span>{lengthStep(keptLen, wig.length)?.word ?? "Not measured"}</li>
                  <li><span>Texture</span>{textureStep(keptTex, wig.texture)?.word ?? "Not measured"}</li>
                  <li><span>Colour</span>{dE != null ? matchWord(dE) : "Not measured"}</li>
                </ul>
              </div>
            </>
          )}
          {look.kind === "own" && (
            <>
              <h3>{he ? "His" : "Her"} own hair</h3>
              <p className={s.style}>YouCam&rsquo;s hairstyle try-on with {their} kept photo as the reference, placed on {their} {p.later.toLowerCase()} photo. A fitter sees exactly what {he ? "he" : "she"} would like back.</p>
            </>
          )}
          {look.kind === "later" && (
            <>
              <h3>{p.later}</h3>
              <p className={s.style}>
                {p.situation === "alopecia"
                  ? "Patches can spread over months. Every try-on here starts from this photo."
                  : "Hair usually starts to fall out two to three weeks after the first chemotherapy cycle. Every try-on here starts from this photo."}
              </p>
            </>
          )}
          {look.kind === "head" && (
            <>
              <h3>{HEADWEAR.find((h) => h.id === look.id)?.name}</h3>
              <p className={s.style}>{HEADWEAR.find((h) => h.id === look.id)?.note}</p>
            </>
          )}
          <div className={s.headRail} aria-label="Headwear">
            {HEADWEAR.filter((h) => p.headwear[h.id]).map((h) => (
              <button key={h.id} aria-pressed={look.kind === "head" && look.id === h.id} onClick={() => setLook({ kind: "head", id: h.id })}>{h.name}</button>
            ))}
          </div>
          <p className={s.api}>
            {look.kind === "head" ? "YouCam AI Image Generator, image to image" : look.kind === "later" ? "Demo photo made with YouCam's image-to-image generator" : "YouCam AI Hairstyle Virtual Try-On v2.1"}
          </p>
        </div>
      </div>
    </div>
  );
}

function lookLabel(l: Look, later: string) {
  return l.kind === "own" ? "own hair restored" : l.kind === "later" ? later : l.kind === "wig" ? `wearing the ${l.id} wig` : `wearing ${l.id}`;
}
