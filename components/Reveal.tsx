"use client";

import { useEffect, useId, useState } from "react";
import s from "./Reveal.module.css";

type Props = {
  before: string;
  after: string;
  beforeAlt: string;
  afterAlt: string;
  /** Short names for each side, e.g. "Week 4" and "Her hair". */
  beforeLabel: string;
  afterLabel: string;
  label: string;
  initial?: number;
  size?: "lg" | "fill";
};

/** Drag (or use arrow keys) to wipe between two portraits inside an arch mirror. */
export function Reveal({ before, after, beforeAlt, afterAlt, beforeLabel, afterLabel, label, initial = 50, size = "lg" }: Props) {
  const [v, setV] = useState(initial);
  const id = useId();
  useEffect(() => setV(initial), [after, initial]);
  return (
    <div className={`${s.wrap} ${size === "fill" ? s.fill : ""}`}>
      <div className={s.frame}>
        <div className={s.glass}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={before} src={before} alt={beforeAlt} className={s.img} fetchPriority="high" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={after} src={after} alt={afterAlt} className={s.img} style={{ clipPath: `inset(0 ${100 - v}% 0 0)` }} fetchPriority="high" />
          <span className={s.line} style={{ left: `${v}%` }} aria-hidden="true">
            <span className={s.knob} style={{ transform: `translateX(${v > 88 ? -60 : v < 12 ? 60 : 0}%)` }} />
          </span>
          <span className={`${s.tag} ${s.tagL}`} aria-hidden="true" style={{ opacity: v > 18 ? 1 : 0 }}>{afterLabel}</span>
          <span className={`${s.tag} ${s.tagR}`} aria-hidden="true" style={{ opacity: v < 82 ? 1 : 0 }}>{beforeLabel}</span>
          <input
            id={id}
            type="range"
            min={0}
            max={100}
            value={v}
            onChange={(e) => setV(Number(e.target.value))}
            className={s.range}
            aria-label={label}
            aria-valuetext={`${v}% ${afterLabel}, ${100 - v}% ${beforeLabel}`}
          />
        </div>
      </div>
    </div>
  );
}
