"use client";

import { useEffect, useState } from "react";
import { SHADES } from "@/lib/catalogue";
import { nearestShades, type Lab, labToHex } from "@/lib/color";
import { describe, type Persona } from "@/lib/demo";
import s from "./Passport.module.css";

/** The hair passport: YouCam readings plus our on-device colour measurement and nearest wig codes. */
export type PassportSubject = Pick<Persona, "name" | "kept" | "turns" | "readings">;

export function Passport({ p, number = "0042", date = "21 Oct 2026" }: { p: PassportSubject; number?: string; date?: string }) {
  const d = describe(p.readings);
  const [lab, setLab] = useState<Lab | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let live = true;
    setLab(null);
    setFailed(false);
    import("@/lib/hairColor").then(({ measureHair }) => measureHair(p.kept)).then((r) => { if (!live) return; if (r) setLab(r.lab); else setFailed(true); }).catch(() => live && setFailed(true));
    return () => { live = false; };
  }, [p.kept]);

  const near = lab ? nearestShades(lab, 3) : null;
  const rows: [string, React.ReactNode, string][] = [
    ["Curl pattern", d.curl ? `${d.curl.raw} · ${d.curl.label}` : "Needs three angles", "Hair Type Detection"],
    ["Frizz", d.frizz?.label ?? "Needs three angles", "Hair Frizziness Detection"],
    ["Length", d.length?.label ?? "—", "Hair Length Detection"],
    ["Face shape", d.face?.label ?? "—", "Face Attribute Analyzer"],
    ["Brows", d.brows ? <><i className={s.chip} style={{ background: d.browHex ?? "#555" }} />{d.brows.label}</> : "—", "Face Attribute Analyzer"],
  ];

  return (
    <article className={s.card} aria-label={`Hair passport for ${p.name}`}>
      <header className={s.head}>
        <h3>Hair passport</h3>
        <span>No. {number} · kept {date}</span>
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
        </div>
        <div>
          <dl className={s.rows}>
            {rows.map(([k, v, api]) => (
              <div key={k}><dt>{k}</dt><dd>{v}</dd><dd className={s.api}>{api}</dd></div>
            ))}
          </dl>
          <div className={s.colour}>
            <h4>Colour, measured on this device</h4>
            {near ? (
              <>
                <div className={s.ring} role="img" aria-label={`Nearest wig shades: ${near.map((n) => n.code).join(", ")}`}>
                  <span className={s.mine} style={{ background: labToHex(lab!) }} title="Her hair" />
                  {near.map((n, i) => (
                    <span key={n.code} className={s.sw} style={{ background: n.hex }}>
                      <b>{n.code}</b>
                      <small className="num">{i === 0 ? "nearest" : ""} ΔE {n.dE.toFixed(1)}</small>
                    </span>
                  ))}
                </div>
                <p className={s.note}>
                  Wig shade <b>{near[0].code}</b>, {near[0].name.toLowerCase()}. Hair pixels found by a hair mask in your browser; median colour compared with {SHADES.length} common wig shades by CIEDE2000.
                </p>
              </>
            ) : failed ? (
              <p className={s.note}>Not enough hair was visible to measure colour.</p>
            ) : (
              <p className={s.note}>Measuring hair colour in your browser…</p>
            )}
            {d.apiHair && (
              <p className={s.cross}>
                <i className={s.chip} style={{ background: d.apiHair.hex }} />
                YouCam&rsquo;s own hair-colour field said &ldquo;{d.apiHair.name}&rdquo; ({d.apiHair.hex}) for this photo, so Hairloom measures colour itself and shows both.
              </p>
            )}
          </div>
        </div>
      </div>
      <div className={s.stamp} aria-hidden="true">kept<br />before<br />week 1</div>
    </article>
  );
}
