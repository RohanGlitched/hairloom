"use client";

import { useState } from "react";
import { BRIEF_INR, MILLS, fitting, unitsOf } from "@/lib/pricing";
import s from "./Roi.module.css";

type State = { clients: number; price: number; visitsSaved: number; minutes: number; hourly: number; extraRate: number; margin: number; wigPrice: number; wastedRate: number; inrPerUsd: number };
type Field = { key: keyof State; label: string; min: number; max: number; step: number; hint: string; fmt?: "inr" | "pct" };

const FIELDS: Field[] = [
  { key: "clients", label: "Clients fitted a month", min: 5, max: 300, step: 5, hint: "A busy oncology wig boutique" },
  { key: "price", label: "Shop pays per fitter brief", min: 0, max: 1000, step: 25, hint: "Draft pilot price, before GST", fmt: "inr" },
  { key: "visitsSaved", label: "Fitting visits saved per client", min: 0, max: 2, step: 0.25, hint: "Assumption: the shortlist and cap size arrive before the first visit" },
  { key: "minutes", label: "Minutes per fitting visit", min: 15, max: 120, step: 5, hint: "Assumption" },
  { key: "hourly", label: "Fitter's cost per hour", min: 100, max: 2000, step: 50, hint: "Assumption", fmt: "inr" },
  { key: "extraRate", label: "Clients who buy one more wig", min: 0, max: 30, step: 1, hint: "Assumption: a second wig or a better one, after seeing it on her face", fmt: "pct" },
  { key: "margin", label: "Shop's margin on a wig", min: 10, max: 70, step: 5, hint: "Assumption", fmt: "pct" },
  { key: "wigPrice", label: "Average wig price", min: 2000, max: 60000, step: 500, hint: "Our demo stock averages about ₹21,000", fmt: "inr" },
  { key: "wastedRate", label: "Clients who'd buy a wig they don't wear", min: 0, max: 40, step: 1, hint: "Assumption; worn wigs can't usually be returned", fmt: "pct" },
  { key: "inrPerUsd", label: "Rupees per US dollar", min: 70, max: 100, step: 1, hint: "For converting YouCam's USD price" },
];

const inr = (n: number) => (Math.round(n) < 0 ? "−" : "") + "₹" + Math.abs(Math.round(n)).toLocaleString("en-IN");
const show = (f: Field, n: number) => (f.fmt === "inr" ? inr(n) : f.fmt === "pct" ? `${n}%` : String(n));
const UNITS = unitsOf(fitting("chemo"));

function headline(wigs: number) {
  if (wigs === 0) return "It pays for itself on fitter time alone.";
  if (wigs === Infinity) return "Set a wig margin to see the break-even.";
  if (wigs <= 1) { const m = Math.floor(1 / wigs); return `It pays for itself if one client ${m === 1 ? "a month" : `every ${m} months`} buys one more wig.`; }
  return `It pays for itself at ${wigs.toFixed(1)} extra wigs a month.`;
}

/** An assumption-labelled model: what a boutique gains from fitter briefs, and what Hairloom keeps. */
export function Roi() {
  const [v, setV] = useState<State>({ clients: 30, price: BRIEF_INR, visitsSaved: 0.5, minutes: 45, hourly: 400, extraRate: 5, margin: 40, wigPrice: 21000, wastedRate: 8, inrPerUsd: 88 });
  const fees = v.clients * v.price;
  const hours = v.clients * v.visitsSaved * (v.minutes / 60);
  const time = hours * v.hourly;
  const perWig = v.wigPrice * (v.margin / 100);
  const extra = v.clients * (v.extraRate / 100) * perWig;
  const net = time + extra - fees;
  const breakEven = perWig > 0 ? Math.max(0, (fees - time) / perWig) : Infinity;
  // Pay-as-you-go price, the dearest: a pilot's volume sits between YouCam's subscription tiers.
  const api = (v.clients * UNITS * MILLS.payg * v.inrPerUsd) / 1000;
  const kept = fees - api;
  const wasted = v.clients * (v.wastedRate / 100) * v.wigPrice;
  return (
    <div className={s.roi}>
      <div className={s.inputs}>
        {FIELDS.map((f) => (
          <label key={f.key}>
            <span>{f.label} <b className="num">{show(f, v[f.key])}</b></span>
            <input type="range" min={f.min} max={f.max} step={f.step} value={v[f.key]} onChange={(e) => setV((x) => ({ ...x, [f.key]: Number(e.target.value) }))} />
            <small>{f.hint}</small>
          </label>
        ))}
      </div>
      <div className={s.out} aria-live="polite">
        <p className={s.headline}>
          {headline(breakEven)}
        </p>
        <h3 className={s.who}>The boutique, a month</h3>
        <div className={s.rows}>
          <p><span>Fitter time saved</span><b className="num">{inr(time)}</b><small>{hours.toFixed(1)} h</small></p>
          <p><span>Margin on extra wigs</span><b className="num">{inr(extra)}</b><small>{(v.clients * v.extraRate / 100).toFixed(1)} wigs at {inr(perWig)}</small></p>
          <p><span>Paid for briefs</span><b className="num">{inr(-fees)}</b><small>{v.clients} × {inr(v.price)}</small></p>
        </div>
        <div className={s.net}><span>Boutique&rsquo;s net</span><b className="num">{inr(net)}</b><small>break-even at {breakEven === Infinity ? "—" : breakEven.toFixed(2)} extra wigs a month</small></div>
        <h3 className={s.who}>Hairloom, a month</h3>
        <div className={s.rows}>
          <p><span>YouCam API cost</span><b className="num">{inr(-api)}</b><small>{v.clients * UNITS} units at ${(MILLS.payg / 1000).toFixed(3)}</small></p>
          <p><span>Kept before hosting and GST</span><b className="num">{inr(kept)}</b><small>{fees > 0 ? `${Math.round((kept / fees) * 100)}% of fees` : "no fees"}</small></p>
        </div>
        <h3 className={s.who}>Clients, a month</h3>
        <div className={s.rows}>
          <p><span>Unworn wigs not bought</span><b className="num">{inr(wasted)}</b><small>saved by clients, not the shop</small></p>
        </div>
      </div>
    </div>
  );
}
