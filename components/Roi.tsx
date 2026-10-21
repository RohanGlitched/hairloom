"use client";

import { useState } from "react";
import s from "./Roi.module.css";

const USD_PER_UNIT = 0.048; // YouCam API subscription price per unit (pay as you go: $0.055)

type Field = { key: keyof State; label: string; min: number; max: number; step: number; hint: string };
type State = { clients: number; units: number; visitsSaved: number; minutes: number; hourly: number; wastedRate: number; wigPrice: number; inrPerUsd: number };

const FIELDS: Field[] = [
  { key: "clients", label: "Clients fitted a month", min: 5, max: 300, step: 5, hint: "A busy oncology wig boutique" },
  { key: "units", label: "YouCam units per client", min: 6, max: 80, step: 1, hint: "Our typical client: 41 (passport, 8 wigs, own hair, 3 shades, 3 headwear, brows)" },
  { key: "visitsSaved", label: "Fitting visits saved per client", min: 0, max: 2, step: 0.25, hint: "Assumption: the shortlist and cap size arrive before the first visit" },
  { key: "minutes", label: "Minutes per fitting visit", min: 15, max: 120, step: 5, hint: "Assumption" },
  { key: "hourly", label: "Fitter's cost per hour (₹)", min: 100, max: 2000, step: 50, hint: "Assumption" },
  { key: "wastedRate", label: "Clients who'd buy a wig they don't wear (%)", min: 0, max: 40, step: 1, hint: "Assumption; worn wigs can't usually be returned" },
  { key: "wigPrice", label: "Average wig price (₹)", min: 2000, max: 60000, step: 500, hint: "Our demo stock averages about ₹21,000" },
  { key: "inrPerUsd", label: "Rupees per US dollar", min: 70, max: 100, step: 1, hint: "Assumption for converting YouCam's USD price" },
];

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

/** A deliberately simple, assumption-labelled ROI model for a wig boutique. */
export function Roi() {
  const [v, setV] = useState<State>({ clients: 30, units: 41, visitsSaved: 0.5, minutes: 45, hourly: 400, wastedRate: 8, wigPrice: 21000, inrPerUsd: 88 });
  const cost = v.clients * v.units * USD_PER_UNIT * v.inrPerUsd;
  const staff = v.clients * v.visitsSaved * (v.minutes / 60) * v.hourly;
  const hours = v.clients * v.visitsSaved * (v.minutes / 60);
  const wasted = v.clients * (v.wastedRate / 100) * v.wigPrice;
  return (
    <div className={s.roi}>
      <div className={s.inputs}>
        {FIELDS.map((f) => (
          <label key={f.key}>
            <span>{f.label} <b className="num">{f.key === "hourly" || f.key === "wigPrice" ? inr(v[f.key]) : v[f.key]}</b></span>
            <input type="range" min={f.min} max={f.max} step={f.step} value={v[f.key]} onChange={(e) => setV((x) => ({ ...x, [f.key]: Number(e.target.value) }))} />
            <small>{f.hint}</small>
          </label>
        ))}
      </div>
      <div className={s.out} aria-live="polite">
        <div><span>YouCam API cost a month</span><b className="num">{inr(cost)}</b><small>{v.clients * v.units} units at ${USD_PER_UNIT}</small></div>
        <div><span>Fitter time saved a month</span><b className="num">{hours.toFixed(1)} h</b><small>worth {inr(staff)}</small></div>
        <div><span>Unworn wigs avoided a month</span><b className="num">{inr(wasted)}</b><small>saved by clients, not the shop</small></div>
        <div className={s.net}><span>Shop&rsquo;s net a month</span><b className="num">{inr(staff - cost)}</b><small>time saved minus API cost</small></div>
      </div>
    </div>
  );
}
