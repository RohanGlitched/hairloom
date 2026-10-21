"use client";

import { useState } from "react";
import { KINDS } from "@/lib/kinds";
import { FITTINGS, unitsOf, usd } from "@/lib/pricing";
import s from "./CostTable.module.css";

/** The YouCam units behind each kind of fitting, built from the same task whitelist the studio runs. */
export function CostTable() {
  const [id, setId] = useState(FITTINGS[0].id);
  const f = FITTINGS.find((x) => x.id === id)!;
  const units = unitsOf(f);
  return (
    <div className={s.box}>
      <div className={s.tabs} role="tablist" aria-label="Kind of fitting">
        {FITTINGS.map((x) => (
          <button key={x.id} role="tab" aria-selected={x.id === id} onClick={() => setId(x.id)}>{x.title} <span className="num">{unitsOf(x)}</span></button>
        ))}
      </div>
      <p className={s.who}>{f.who}</p>
      <p className={s.total}>
        <b className="num">{units} units</b>
        <span className="num">${usd(units, "sub")}–{usd(units, "payg")} a client</span>
      </p>
      <table className={s.table}>
        <thead><tr><th>Step</th><th className={s.api}>YouCam API</th><th>Times</th><th>Units</th></tr></thead>
        <tbody>
          {f.steps.map(([k, times, label]) => (
            <tr key={k}><td>{label}</td><td className={s.api}>{KINDS[k].api}</td><td className="num">{times}</td><td className="num">{KINDS[k].units * times}</td></tr>
          ))}
        </tbody>
        <tfoot><tr><td>Total</td><td className={s.api} /><td /><td className="num">{units}</td></tr></tfoot>
      </table>
    </div>
  );
}
