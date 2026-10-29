"use client";

import { useEffect, useMemo, useState } from "react";
import { inr } from "@/lib/catalogue";
import { hexToLab } from "@/lib/color";
import { appointmentLabel } from "@/lib/dates";
import type { Readings } from "@/lib/demo";
import type { SharePayload } from "@/lib/seal";
import { parseStock, rankStock, type Client, type StockItem } from "@/lib/stock";
import s from "./fitter.module.css";

export function clientOf(b: SharePayload, fit: Client["fit"] = null): Client {
  const r = b.readings as Readings;
  return {
    name: b.name, lengthTerm: r.length?.term, typeMapping: r.type?.mapping, lab: b.colour ? hexToLab(b.colour.hex) : null,
    code: b.colour?.code ?? null, blend: b.colour?.blend ?? null, capCm: b.cap?.cm ?? null, fit,
    appointment: b.appointment ? appointmentLabel(b.appointment) : null,
  };
}

/** Copies text and says so in place. */
export function CopyButton({ text, label, className }: { text: string; label: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button className={className ?? "btn btn-ghost btn-sm"} onClick={async () => { await navigator.clipboard.writeText(text).catch(() => undefined); setDone(true); setTimeout(() => setDone(false), 2000); }}>
      {done ? "Copied" : label}
    </button>
  );
}

const SAMPLE = `sku,name,length,texture,shade,caps,price_inr,fit,url
AB-101,Your lob,shoulder,straight,4,Petite|Average,15900,Women,https://example.com/products/ab-101`;

/** "Load your stock": a boutique pastes its own catalogue and ranks it for this client, all in the browser. */
export function YourStock({ client, fit: given }: { client: SharePayload; fit?: "Women" | "Men" }) {
  const [text, setText] = useState("");
  const [fit, setFit] = useState<"All" | "Women" | "Men">(given ?? "All");
  useEffect(() => setFit(given ?? "All"), [given]);
  const [items, setItems] = useState<StockItem[] | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const c = useMemo(() => clientOf(client, fit === "All" ? null : fit), [client, fit]);
  const ranked = useMemo(() => (items?.length ? rankStock(items, c) : null), [items, c]);

  function rank(t = text) {
    const { items: got, errors: errs } = parseStock(t);
    setErrors(errs);
    setItems(got);
  }
  async function example() {
    setBusy(true);
    try {
      const t = await fetch("/stock.example.json").then((r) => r.text());
      setText(t);
      rank(t);
    } catch {
      setErrors(["The example stock couldn't be loaded. Check your connection."]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="your-stock" className="deep sec" aria-labelledby="ys-title" data-noprint>
      <div className="wrap">
        <div className={s.ysHead}>
          <div>
            <p className="kicker">Your own stock</p>
            <h2 id="ys-title" className="h-sec">Rank your shop&rsquo;s wigs for {client.name}.</h2>
          </div>
          <p className="lede">
            Paste your catalogue as CSV or JSON: SKU, name, length, texture, shade code, cap sizes, price and product link. Hairloom ranks it against this client&rsquo;s passport with the same score the studio uses, and writes the hold note for each wig. It runs in this browser: nothing is uploaded and no YouCam units are used.
          </p>
        </div>
        <div className={s.ysGrid}>
          <div className={s.ysForm}>
            <label htmlFor="ys-text" className="small">Stock (CSV with a header row, or JSON)</label>
            <textarea id="ys-text" rows={9} spellCheck={false} value={text} placeholder={SAMPLE} onChange={(e) => setText(e.target.value)} />
            <div className={s.actions}>
              <button className="btn btn-ivory btn-sm" disabled={!text.trim()} onClick={() => rank()}>Rank for {client.name}</button>
              <button className="btn btn-ghost btn-sm" disabled={busy} onClick={example}>{busy ? "Loading…" : "Load the example stock"}</button>
              <a className="btn btn-ghost btn-sm" href="/stock.example.json" download>Download the template</a>
            </div>
            <div className={s.chipsRow} role="radiogroup" aria-label="Which wigs to rank">
              {(["All", "Women", "Men"] as const).map((f) => (
                <button key={f} role="radio" aria-checked={fit === f} onClick={() => setFit(f)}>{f === "All" ? "All wigs" : `${f}'s`}</button>
              ))}
            </div>
            <p className="small">
              Ranked against: {c.lengthTerm ?? "length not read"}, {c.typeMapping ? `type ${c.typeMapping}` : "texture not read"}, shade {c.code ?? "not measured"}{c.blend ? ` (or a ${c.blend} blend)` : ""}, {c.capCm ? `${c.capCm} cm head` : "head not measured"}. Lengths: ear, chin, shoulder, chest, midback. Textures: straight, wavy, curly, coily. Caps: Petite, Average, Large, separated by |.
            </p>
            {errors.length > 0 && (
              <ul className={s.ysErr} role="alert">
                {errors.slice(0, 6).map((e) => <li key={e}>{e}</li>)}
                {errors.length > 6 && <li>and {errors.length - 6} more</li>}
              </ul>
            )}
          </div>
          <div aria-live="polite">
            {ranked ? (
              <ol className={s.ysList}>
                {ranked.slice(0, 12).map((r, i) => (
                  <li key={r.item.sku + i}>
                    <span className={s.ysN}>{i + 1}</span>
                    <div className={s.ysMain}>
                      <p className={s.ysName}><b>{r.item.name}</b> <span>{r.item.sku}</span> <em>{r.band}</em></p>
                      <p className="small">{r.length} · {r.texture} · pull in shade {r.pullShade}{r.item.shade !== c.code ? ` (stocked ${r.item.shade})` : ""} · cap {r.cap.note}{r.item.price_inr != null ? ` · ${inr(r.item.price_inr)}` : ""}</p>
                      <div className={s.ysAct}>
                        <CopyButton text={r.hold} label="Copy hold note" />
                        {r.item.url && <a className="btn btn-ghost btn-sm" href={r.item.url} target="_blank" rel="noopener noreferrer">View at retailer</a>}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <div className={s.ysEmpty}>Your ranked stock appears here, closest to {client.name}&rsquo;s own hair first.</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
