"use client";

import { useState } from "react";
import { WIGS, inr } from "@/lib/catalogue";
import { wigShade } from "@/lib/colours";
import { PERSONAS } from "@/lib/demo";
import s from "./Embed.module.css";

/**
 * The widget a wig shop puts beside a product: the wig on real-looking faces at week 4,
 * and a link into the full studio for the shopper's own photo. Demo renders only: no units.
 */
export function Embed({ wigId }: { wigId: string }) {
  const w = WIGS.find((x) => x.id === wigId)!;
  const people = PERSONAS.filter((p) => p.wigs[w.id]);
  const [pid, setPid] = useState(people.find((p) => p.fit === w.fit)?.id ?? people[0]?.id);
  const p = people.find((x) => x.id === pid) ?? people[0];
  const sh = wigShade(w);
  return (
    <div className={s.box}>
      <div className={s.mirror}><div className={s.glass}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={p.wigs[w.id]} alt={`${w.name} on ${p.name}`} />
      </div></div>
      <div className={s.text}>
        <p className={s.kicker}>See it after hair loss</p>
        <h1>{w.name}</h1>
        <p className={s.meta}><i style={{ background: sh.hex }} aria-hidden="true" />Shade {sh.code} · {w.cap} · <span>{inr(w.price)}</span></p>
        <div className={s.people} role="tablist" aria-label="Shown on">
          {people.map((x) => (
            <button key={x.id} role="tab" aria-selected={x.id === p.id} onClick={() => setPid(x.id)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={x.kept} alt="" /><span>{x.name}</span>
            </button>
          ))}
        </div>
        <a className={s.cta} href={`/studio`} target="_blank" rel="noopener">Try it on your own photo</a>
        <p className={s.small}>Opens Hairloom. Your photos stay on your device. Demo faces are generated with YouCam.</p>
      </div>
    </div>
  );
}
