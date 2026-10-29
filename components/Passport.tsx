"use client";

import { useEffect, useState } from "react";
import { SHADES } from "@/lib/catalogue";
import { greyBlend, greyWords, nearestShades, type Lab, labToHex } from "@/lib/color";
import { describe, type Cap, type Persona } from "@/lib/demo";
import { capSize } from "@/lib/match";
import { dayLabel, demoDates } from "@/lib/dates";
import s from "./Passport.module.css";

export type PassportSubject = Pick<Persona, "name" | "kept" | "turns" | "readings"> & { cap?: Cap | null; situation?: Persona["situation"] | "other" };

const PARTING: Record<string, string> = { left: "Left", centre: "Centre", right: "Right", none: "No parting" };

/**
 * The kept-hair record: YouCam readings, the fitter's own measurements, and hair colour as a wig shade code.
 * `lab` is a measurement already taken (demo people); without it, colour is measured here in the browser.
 */
export function Passport({ p, lab: given, grey: givenGrey, number, date = dayLabel(demoDates().keptAt) }: { p: PassportSubject; lab?: Lab | null; grey?: { grey: number; base: Lab | null } | null; number?: string; date?: string }) {
  const d = describe(p.readings);
  const [lab, setLab] = useState<Lab | null>(given ?? null);
  const [grey, setGrey] = useState<{ grey: number; base: Lab | null } | null>(givenGrey ?? null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (given) { setLab(given); setGrey(givenGrey ?? null); return; }
    let live = true;
    setLab(null);
    setFailed(false);
    import("@/lib/hairColor").then(({ measureHair }) => measureHair(p.kept)).then((r) => { if (!live) return; if (r) { setLab(r.lab); setGrey({ grey: r.grey, base: r.base }); } else setFailed(true); }).catch(() => live && setFailed(true));
    return () => { live = false; };
  }, [p.kept, given, givenGrey]);
  const greyNote = greyWords(grey?.grey);
  const blend = greyBlend(grey?.grey, grey?.base);

  const near = lab ? nearestShades(lab, 3) : null;
  const no = number ?? passportNo(p.kept);
  const size = capSize(p.cap?.cm);
  const rows: [string, React.ReactNode, string][] = [
    ["Curl pattern", d.curl ? d.curl.label : "Needs three angles", d.curl ? `YouCam type ${d.curl.raw}` : ""],
    ["Frizz", d.frizz?.label ?? "Needs three angles", "YouCam"],
    ["Length", d.length?.label ?? "—", "YouCam"],
    ["Face shape", d.face?.label ?? "Not read", "YouCam"],
    ["Brows", d.brows ? <><i className={s.chip} style={{ background: d.browHex ?? "#555" }} aria-hidden="true" />{d.brows.label}</> : "Not read", "YouCam"],
    ["Cap size", p.cap?.cm ? `${size}, ${p.cap.cm} cm around` : "Measure with a soft tape", "Measured at home"],
    ["Parting", p.cap?.parting ? PARTING[p.cap.parting] : "—", ""],
  ];

  return (
    <article className={s.card} aria-label={`Kept-hair record for ${p.name}`}>
      <header className={s.head}>
        <h3>Kept-hair record</h3>
        <span>No. {no} · kept {date}</span>
      </header>
      <div className={s.body}>
        <div className={s.photos}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={p.kept} alt={`${p.name}, front`} className={s.main} />
          <div className={s.turns}>
            {p.turns.filter(Boolean).map((t, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={t!} alt={`${p.name}, turned ${i === 0 ? "one way" : "the other way"}`} />
            ))}
          </div>
          <p className={s.stamp}>{p.situation === "alopecia" ? "Kept while it covered the patches" : p.situation === "chemo" ? "Kept before treatment" : "Kept before hair loss"}</p>
        </div>
        <div>
          <dl className={s.rows}>
            {rows.map(([k, v, src]) => (
              <div key={k}><dt>{k}</dt><dd>{v}</dd><dd className={s.api}>{src}</dd></div>
            ))}
          </dl>
          <div className={s.colour}>
            <h4>Colour</h4>
            {near ? (
              <>
                <div className={s.ring} role="img" aria-label={`Hair colour; nearest wig shades ${near.map((n) => n.code).join(", ")}`}>
                  <span className={s.mine} style={{ background: labToHex(lab!) }} />
                  {near.map((n, i) => (
                    <span key={n.code} className={s.sw} style={{ background: n.hex }}>
                      <b>{n.code}</b>
                      <small>{i === 0 ? "Nearest" : "Also close"}</small>
                    </span>
                  ))}
                </div>
                <p className={s.note}>Wig shade <b>{near[0].code}</b>, {near[0].name.toLowerCase()}. Measured from the hair in the front photo, on this device.</p>
                {greyNote && (
                  <p className={s.note}>
                    <b>{greyNote[0].toUpperCase() + greyNote.slice(1)}</b>
                    {blend ? <>: ask for a grey blend such as <b>{blend.code}</b> ({blend.name.toLowerCase()}), judged by eye against swatches.</> : ": not enough for a grey blend, so mention it to your fitter."}
                  </p>
                )}
                <details className={s.more}>
                  <summary>How the colour is measured</summary>
                  <p>
                    A hair mask (MediaPipe) finds the hair pixels; Hairloom takes their median colour in CIELAB, leaving out shadow and shine, and compares it with {SHADES.length} common wig shades using CIEDE2000. Grey is the share of hair pixels that are light and nearly colourless (L* above 55, chroma below 8); from 15% up it suggests a grey blend code. Differences: {near.map((n) => `${n.code} ${n.dE.toFixed(1)}`).join(", ")} (under 3 is hard to tell apart). Shade codes vary by brand, so a fitter checks against real swatches.
                  </p>
                </details>
              </>
            ) : failed ? (
              <p className={s.note}>Not enough hair was visible to measure colour.</p>
            ) : (
              <p className={s.note}>Measuring hair colour…</p>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

/** A short stable passport number derived from the photo, so two passports never share one. */
export function passportNo(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += Math.max(1, Math.floor(seed.length / 512))) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return String((h >>> 0) % 9000 + 1000);
}
