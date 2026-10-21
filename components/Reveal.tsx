"use client";

import { useId, useState } from "react";
import s from "./Reveal.module.css";

/** Drag to wipe between two portraits inside an arch mirror (keyboard: arrow keys on the slider). */
export function Reveal({ before, after, beforeAlt, afterAlt, label }: { before: string; after: string; beforeAlt: string; afterAlt: string; label: string }) {
  const [v, setV] = useState(100);
  const id = useId();
  return (
    <div className={s.wrap}>
      <div className={s.frame}>
        <div className={s.glass}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={before} alt={beforeAlt} className={s.img} fetchPriority="high" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={after} alt={afterAlt} className={s.img} style={{ clipPath: `inset(0 ${100 - v}% 0 0)` }} fetchPriority="high" />
          <span className={s.line} style={{ left: `${v}%` }} aria-hidden="true" />
          <input
            id={id}
            type="range"
            min={0}
            max={100}
            value={v}
            onChange={(e) => setV(Number(e.target.value))}
            className={s.range}
            aria-label={label}
            aria-valuetext={v > 50 ? "Showing her own hair" : "Showing week 4"}
          />
        </div>
      </div>
      <p className={s.hint} aria-hidden="true">{v > 92 ? "Drag across the mirror to see week 4" : v < 8 ? "Drag back to return her hair" : "Week 4 on the right, her hair on the left"}</p>
    </div>
  );
}
