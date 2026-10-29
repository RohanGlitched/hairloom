"use client";

import { useEffect, useRef, useState } from "react";
import { WIGS, inr } from "@/lib/catalogue";
import { wigShade } from "@/lib/colours";
import { PERSONAS } from "@/lib/demo";
import { demoSku } from "@/lib/stock";
import { Reveal } from "@/components/Reveal";
import s from "./Embed.module.css";

/**
 * The widget a wig shop puts beside a product: the wig on demo people after hair loss, wiped
 * against the same photo without it, and a link into the studio with this wig pinned first.
 * Demo renders only: no units. It posts its height so the shop's iframe can fit it on phones.
 */
export function Embed({ wigId, shop }: { wigId: string; shop?: string }) {
  const w = WIGS.find((x) => x.id === wigId)!;
  const people = PERSONAS.filter((p) => p.wigs[w.id]);
  const [pid, setPid] = useState(people.find((p) => p.fit === w.fit)?.id ?? people[0]?.id);
  const p = people.find((x) => x.id === pid) ?? people[0];
  const sh = wigShade(w);
  const box = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el || window.parent === window) return;
    const post = () => window.parent.postMessage({ hairloom: "height", wig: w.id, h: Math.ceil(el.getBoundingClientRect().height) }, "*");
    const ro = new ResizeObserver(post);
    ro.observe(el);
    return () => ro.disconnect();
  }, [w.id]);
  const studio = `/studio?wig=${w.id}`;
  return (
    <main ref={box} className={s.box}>
      <div className={s.mirror}>
        <Reveal before={p.week4} after={p.wigs[w.id]} beforeAlt={`${p.name} at ${p.later.toLowerCase()}, without a wig`} afterAlt={`${w.name} on ${p.name}`}
          beforeLabel={p.later} afterLabel={w.name} label={`Compare ${p.name} with and without ${w.name}`} initial={62} size="fill" />
      </div>
      <div className={s.text}>
        <p className={s.kicker}>See it after hair loss</p>
        <h1>{w.name}</h1>
        <p className={s.meta}><i style={{ background: sh.hex }} aria-hidden="true" />Shade {sh.code}, {w.cap}, <span>{inr(w.price)}</span> · <span>{demoSku(w)}</span></p>
        <div className={s.people} role="tablist" aria-label="Shown on">
          {people.map((x) => (
            <button key={x.id} role="tab" aria-selected={x.id === p.id} onClick={() => setPid(x.id)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={x.kept} alt="" /><span>{x.name}</span>
            </button>
          ))}
        </div>
        <div className={s.ctas}>
          <a className={s.cta} href={studio} target="_blank" rel="noopener">Try {w.name} on your own photo</a>
          {shop && <a className={s.cta2} href={shop} target="_top" rel="noopener">Reserve {w.name} in shade {sh.code} at {new URL(shop).hostname}</a>}
        </div>
        <p className={s.small}><a href="/studio?step=try#shop" target="_blank" rel="noopener" style={{ color: "inherit" }}>Have a photo of another shop&rsquo;s wig? Try that on in the studio too.</a></p>
        <p className={s.small}>Drag the mirror to compare. Opens Hairloom with {w.name} first. Your photos are stored only on your device. Demo people are generated with YouCam.</p>
      </div>
    </main>
  );
}
