"use client";

import { useEffect, useMemo, useState } from "react";
import { hexToLab } from "@/lib/color";
import { appointmentLabel } from "@/lib/dates";
import type { Readings } from "@/lib/demo";
import type { SharePayload } from "@/lib/seal";
import { parseStock, priceOf, rankStock, type Client, type StockItem } from "@/lib/stock";
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

/** Two examples: the demo boutique, and real public product pages read for their metadata only. */
const EXAMPLES = [
  { id: "demo", file: "/stock.example.json", label: "Demo boutique (Kesh & Co.)" },
  { id: "public", file: "/stock.public-listings.json", label: "Public listings (no partnership)" },
] as const;
const who = (name: string) => name.replace(/\s*\(demo\)$/, "");

/** "Load your stock": a boutique pastes its own catalogue and ranks it for this client, all in the browser. */
export function YourStock({ client, fit: given, renders }: { client: SharePayload; fit?: "Women" | "Men"; renders?: Record<string, string> }) {
  const [all, setAll] = useState(false);
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
  const [which, setWhich] = useState<(typeof EXAMPLES)[number]["id"] | null>(null);
  async function example(id: (typeof EXAMPLES)[number]["id"] = "demo") {
    setBusy(true); setWhich(id);
    try {
      const t = await fetch(EXAMPLES.find((e) => e.id === id)!.file).then((r) => r.text());
      setText(t);
      rank(t);
    } catch {
      setErrors(["The example stock couldn't be loaded. Check your connection."]);
    } finally {
      setBusy(false);
    }
  }
  // A demo brief opens with the demo boutique already ranked, so there's something to read at once (0 units).
  const demo = /\(demo\)$/.test(client.name);
  useEffect(() => { if (demo && !items) void example("demo"); }, [demo]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section id="your-stock" className="deep sec" aria-labelledby="ys-title" data-noprint>
      <div className="wrap">
        <div className={s.ysHead}>
          <div>
            <p className="kicker">Your own stock</p>
            <h2 id="ys-title" className="h-sec">Rank your shop&rsquo;s wigs for {who(client.name)}.</h2>
          </div>
          <p className="lede">
            Paste your catalogue as CSV or JSON: SKU, name, length, texture, shade code, cap sizes, price and product link. Hairloom ranks it against the hair this client kept with the same score the studio uses, and writes the hold note for each wig. It runs in this browser: nothing is uploaded and no YouCam units are used.
          </p>
        </div>
        <div className={s.ysGrid}>
          <div className={s.ysForm}>
            <label htmlFor="ys-text" className="small">Stock (CSV with a header row, or JSON)</label>
            <textarea id="ys-text" rows={9} spellCheck={false} value={text} placeholder={SAMPLE} onChange={(e) => setText(e.target.value)} />
            <div className={s.actions}>
              <button className="btn btn-ivory btn-sm" disabled={!text.trim()} onClick={() => { setWhich(null); rank(); }}>Rank for {who(client.name)}</button>
              <a className="btn btn-ghost btn-sm" href="/stock.example.json" download>Download the template</a>
            </div>
            <div className={s.chipsRow} role="radiogroup" aria-label="Example stock">
              {EXAMPLES.map((e) => (
                <button key={e.id} role="radio" aria-checked={which === e.id} disabled={busy} onClick={() => example(e.id)}>{e.label}</button>
              ))}
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
            {ranked && which === "public" && <p className={s.ysNote}>Real product pages from two retailers, read on Oct 30 for their listed length, texture, one shade code, cap size and price. No images, and no partnership: prices change, so check the retailer.</p>}
            {ranked ? (
              <ol className={s.ysList}>
                {ranked.slice(0, all ? ranked.length : 5).map((r, i) => {
                  // A demo boutique wig the client has already tried on shows its render as a thumbnail.
                  const id = /^KC-([A-Z]+)-/.exec(r.item.sku)?.[1]?.toLowerCase();
                  const thumb = id && renders?.[id];
                  return (
                  <li key={r.item.sku + i} className={thumb ? s.ysWithThumb : undefined}>
                    <span className={s.ysN}>{i + 1}</span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {thumb && <img className={s.ysThumb} src={thumb} alt={`${r.item.name} on ${who(client.name)}`} loading="lazy" />}
                    <div className={s.ysMain}>
                      <p className={s.ysName}><b>{r.item.name}</b> <span>{r.item.retailer ?? r.item.sku}</span> <em>{r.band}</em></p>
                      <p className={s.ysWhy}>Match {r.why}</p>
                      <p className="small">{r.length} · {r.texture} · pull in shade {r.pullShade}{r.item.shade !== c.code ? ` (stocked ${r.item.shade})` : ""} · cap {r.cap.note}{priceOf(r.item) ? ` · ${priceOf(r.item)}` : ""}</p>
                      <div className={s.ysAct}>
                        <CopyButton text={r.hold} label="Copy hold note" />
                        {r.item.url && <a className="btn btn-ghost btn-sm" href={r.item.url} target="_blank" rel="noopener noreferrer">View at retailer</a>}
                      </div>
                    </div>
                  </li>
                  );
                })}
              </ol>
            ) : null}
            {ranked && ranked.length > 5 && (
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 14 }} onClick={() => setAll(!all)}>{all ? "Show the top 5" : `Show all ${ranked.length}`}</button>
            )}
            {ranked ? null : (
              <div className={s.ysEmpty}>Your ranked stock appears here, closest to {who(client.name)}&rsquo;s own hair first{demo ? " (demo)" : ""}.</div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
