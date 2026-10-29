"use client";

import { useEffect, useRef, useState } from "react";
import { BOUTIQUE, LENGTH_LABEL, WIGS, inr } from "@/lib/catalogue";
import { describe } from "@/lib/demo";
import { demoBrief } from "@/lib/brief";
import { appointmentLabel, dayLabel } from "@/lib/dates";
import { capSize } from "@/lib/match";
import { wigShade } from "@/lib/colours";
import { nearestShades } from "@/lib/color";
import { prepare, runTask } from "@/lib/client";
import { Consent, hasConsent } from "@/components/Consent";
import { unseal, type SharePayload } from "@/lib/seal";
import { PERSONAS, type Readings } from "@/lib/demo";
import { demoSku } from "@/lib/stock";
import { CopyButton, YourStock } from "./YourStock";
import { Desk } from "./Desk";
import s from "./fitter.module.css";

export function FitterDesk() {
  const [brief, setBrief] = useState<SharePayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [paste, setPaste] = useState("");
  // Which demo person's brief is open, if any; tools and stock rank for the open brief, else Anjali's.
  const [demoId, setDemoId] = useState<string | null>(null);

  async function openLink(hash: string) {
    const m = /s=([\w-]+)\.([\w-]+)/.exec(hash);
    if (!m) return setErr("That doesn't look like a Hairloom link. It should contain #s= followed by a code.");
    setLoading(true); setErr(null);
    try { setBrief(await unseal(m[1], m[2])); setDemoId(null); } catch (e) { setErr((e as Error).message); } finally { setLoading(false); }
  }

  useEffect(() => {
    const read = () => {
      const h = window.location.hash;
      if (h.includes("s=")) void openLink(h);
      else if (/^#demo(=\w+)?$/.test(h)) { const id = h.split("=")[1] ?? "anjali"; setBrief(demoBrief(id)); setDemoId(PERSONAS.some((p) => p.id === id) ? id : "anjali"); window.scrollTo({ top: 0 }); }
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  return (
    <>
      <section className={`night ${s.head}`}>
        <div className="wrap">
          <p className="kicker">For wig fitters</p>
          <h1 className="h-hero">{brief ? `Fitting brief: ${brief.name}` : "The fitter desk"}</h1>
          <p className="lede">
            {brief
              ? "Decrypted in this browser from the link your client sent. Nothing here was readable by our server."
              : "Open a client's sealed link to see their hair passport and shortlist before they arrive. No account and nothing to install."}
          </p>
          {!brief && (
            <div className={s.open} id="open">
              <label className="visually-hidden" htmlFor="paste">Client link</label>
              <input id="paste" placeholder="Paste the link your client sent" value={paste} onChange={(e) => setPaste(e.target.value)} />
              <button className="btn btn-ivory" disabled={!paste || loading} onClick={() => openLink(paste)}>{loading ? "Opening…" : "Open brief"}</button>
              <button className="btn btn-ghost" onClick={() => { setBrief(demoBrief()); setDemoId("anjali"); history.replaceState(null, "", "#demo"); }}>Open a demo brief</button>
            </div>
          )}
          {err && <p className={s.err} role="alert">{err}</p>}
        </div>
      </section>

      {brief && <Brief b={brief} onClose={() => { setBrief(null); history.replaceState(null, "", "/fitter"); }} />}

      <YourStock client={brief ?? demoBrief()} fit={PERSONAS.find((p) => p.id === (brief ? demoId : "anjali"))?.fit} />
      <Stock />
      <Assistant brief={brief ?? demoBrief()} situation={PERSONAS.find((p) => p.id === (brief ? demoId : "anjali"))?.situation ?? "chemo"} person={brief ? demoId ?? undefined : "anjali"} fit={PERSONAS.find((p) => p.id === (brief ? demoId : "anjali"))?.fit} />
      <AutoTag />
    </>
  );
}

function Brief({ b, onClose }: { b: SharePayload; onClose: () => void }) {
  const r = b.readings as Readings;
  const d = describe(r);
  const when = b.appointment ? appointmentLabel(b.appointment) : null;
  // One line per wig, pulled in the client's own measured shade (a recoloured pick names its shade).
  const pullMap = new Map<string, { w: (typeof WIGS)[number]; code: string }>();
  for (const l of b.looks) {
    const [kind, id, code] = l.key.split(":");
    const w = WIGS.find((x) => x.id === id);
    if (!w || !["wig", "hair", "shade"].includes(kind)) continue;
    if (kind === "shade" || !pullMap.has(id)) pullMap.set(id, { w, code: kind === "shade" ? code : b.colour?.code ?? wigShade(w).code });
  }
  const pull = [...pullMap.values()];

  return (
    <section className={`paper ${s.brief}`} aria-label="Fitting brief">
      <div className="wrap">
        <div className={s.briefTop}>
          <div className={s.keptCol}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={b.kept} alt={`${b.name} before hair loss`} />
            <p className="small">Kept {dayLabel(b.keptAt)}</p>
          </div>
          <div>
            <dl className={s.facts}>
              {when && <><dt>Appointment</dt><dd>{when}</dd></>}
              <dt>Shade</dt><dd>{b.colour ? <><i style={{ background: b.colour.hex }} />Nearest code {b.colour.code}, {b.colour.name.toLowerCase()} <small>(ΔE {b.colour.dE}, measured on the client&rsquo;s device)</small>{b.colour.grey != null && b.colour.grey >= 0.05 && <><br />About {Math.round(b.colour.grey * 100)}% grey{b.colour.blend ? `: try a ${b.colour.blend} blend, judged by eye` : ""}</>}</> : "Not measured"}</dd>
              <dt>Curl pattern</dt><dd>{d.curl ? `${d.curl.raw}, ${d.curl.label.toLowerCase()}` : "Not read"}</dd>
              <dt>Frizz</dt><dd>{d.frizz?.label ?? "Not read"}</dd>
              <dt>Length</dt><dd>{d.length?.label ?? "Not read"}</dd>
              <dt>Cap size</dt><dd>{b.cap?.cm ? `${capSize(b.cap.cm)}, ${b.cap.cm} cm` : "Not measured"}{b.cap?.parting ? ` · ${b.cap.parting === "none" ? "no" : b.cap.parting} parting` : ""}</dd>
              <dt>Face shape</dt><dd>{d.face?.label ?? "Not read"}</dd>
              <dt>Brows</dt><dd>{d.brows ? <><i style={{ background: d.browHex ?? "#444" }} />{d.brows.label}</> : "Not read"}</dd>
            </dl>
            {b.note && <blockquote className={s.note}>&ldquo;{b.note}&rdquo;</blockquote>}
          </div>
          <div className={s.prep}>
            <h2 className="h-sub">Before they arrive</h2>
            <ul>
              {pull.map(({ w, code }) => {
                const cap = capSize(b.cap?.cm) ?? "to be measured";
                const hold = `Please hold ${demoSku(w)} (${w.name}) in shade ${code}${b.colour?.blend ? ` or ${b.colour.blend}` : ""}, cap ${cap}, for ${b.name}${when ? `, fitting ${when}` : ""}.`;
                return (
                  <li key={w.id}>
                    Pull <b>{w.name}</b> in shade {code}{b.colour?.blend ? ` or the ${b.colour.blend} blend` : ""} and one shade either side.
                    <span className={s.holdRow} data-noprint>
                      <CopyButton text={hold} label={`Reserve ${demoSku(w)}`} />
                      <a className="btn btn-ghost btn-sm" href={`/embed?wig=${w.id}`} target="_blank" rel="noopener">Product page</a>
                    </span>
                  </li>
                );
              })}
              <li>Have an adjustable cap ready{b.cap?.cm ? ` around ${capSize(b.cap.cm)!.toLowerCase()}` : ""}: heads can be up to a size smaller after hair loss (American Cancer Society). Re-measure at the fitting.</li>
              {d.frizz && /frizz/i.test(d.frizz.label) && <li>Their own hair had some frizz; a slightly textured fibre will look more like them.</li>}
              <li>Offer a soft liner or sleep cap if the scalp is sensitive.</li>
            </ul>
            <div className={s.actions}>
              <button className="btn btn-ink btn-sm" onClick={() => window.print()}>Print brief</button>
              <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
            </div>
          </div>
        </div>
        <h2 className="h-sec" style={{ marginTop: 48 }}>Their shortlist, on their own face</h2>
        <div className={s.looks}>
          {b.looks.map((l) => (
            <figure key={l.key}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={l.src} alt={`${b.name} wearing ${l.label}`} />
              <figcaption><b>{l.label}</b><span>{l.detail}</span></figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function Stock() {
  return (
    <section id="stock" className="night sec" data-noprint>
      <div className="wrap">
        <p className="kicker">Demo stock</p>
        <h2 className="h-sec">{BOUTIQUE.name}, {BOUTIQUE.city}</h2>
        <p className="lede" style={{ marginTop: 12 }}>{BOUTIQUE.note} Each tag shows the shade code the shop lists; measuring the photos reads darker, as the <a href="/evidence">evidence page</a> shows.</p>
        <div className={s.stock}>
          {WIGS.map((w) => {
            const sh = wigShade(w);
            return (
              <article key={w.id} className={s.item}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/catalogue/thumb/${w.id}.jpg`} alt={`${w.name} wig on a model`} loading="lazy" />
                <h3>{w.name}</h3>
                <p className="small">{w.style}</p>
                <p className={s.tags}>
                  <span><i style={{ background: sh.hex }} />{sh.code}</span>
                  <span>{LENGTH_LABEL[w.length]}</span>
                  <span>{w.texture}</span>
                  <span>{w.cap}</span>
                </p>
                <p className={s.price}><span className="num">{inr(w.price)}</span> · {w.fibre}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function AutoTag() {
  const [img, setImg] = useState<string | null>(null);
  const [out, setOut] = useState<{ length?: string; shade?: string; hex?: string; dE?: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // The studio's consent, before the photo is sent to YouCam. A ref, so the picker opens in the same click.
  const agreed = useRef(false);
  const [asking, setAsking] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  useEffect(() => { hasConsent().then((v) => { agreed.current = v; }); }, []);

  async function tag(file?: File) {
    if (!file) return;
    setErr(null); setOut(null);
    let url: string;
    try { url = await prepare(file, 1024); } catch { return setErr("This photo couldn't be read. Try a JPEG or PNG."); }
    setImg(url);
    setBusy(true);
    const { measureHair } = await import("@/lib/hairColor");
    const [col, len] = await Promise.all([measureHair(url).catch(() => null), runTask("hairLength", [url])]);
    setBusy(false);
    const n = col ? nearestShades(col.lab, 1)[0] : null;
    if (!len.ok) setErr(len.message);
    setOut({ length: len.ok ? String((len.results.hair_length as { term?: string })?.term ?? "") : undefined, shade: n ? `${n.code}, ${n.name.toLowerCase()}` : undefined, hex: col?.hex, dE: n?.dE });
  }

  return (
    <section className="deep sec" aria-labelledby="tag-title" data-noprint>
      <div className={`wrap ${s.tagWrap}`}>
        <div>
          <p className="kicker">Stock onboarding</p>
          <h2 id="tag-title" className="h-sec">Tag a wig from its photo.</h2>
          <p className="lede" style={{ marginTop: 12 }}>
            Upload a photo of a wig on a model. YouCam&rsquo;s hair-length detection reads the length (2 units) and the hair mask in your browser measures the shade code, so stock is described the same way as each client&rsquo;s passport.
          </p>
          <label className="btn btn-ivory" style={{ marginTop: 20, position: "relative" }} onClick={(e) => { if (!agreed.current && !busy) { e.preventDefault(); setAsking(true); } }}>
            {busy ? "Reading…" : "Upload a wig photo"}
            <input ref={picker} type="file" accept="image/*" style={{ position: "absolute", opacity: 0, width: 1, height: 1 }} onChange={(e) => { void tag(e.target.files?.[0]); e.target.value = ""; }} disabled={busy} />
          </label>
          {asking && (
            <Consent
              agree="I’m 18 or over, and I have the right to upload this photo and the permission of anyone in it."
              button="btn-ivory"
              onCancel={() => setAsking(false)}
              onAgree={() => { agreed.current = true; setAsking(false); picker.current?.click(); }}
            />
          )}
          {err && <p className={s.err} role="alert">{err}</p>}
        </div>
        <div className={s.tagOut}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {img ? <img src={img} alt="Uploaded wig photo" /> : <div className={s.tagEmpty}>Your photo appears here</div>}
          {out && (
            <dl className={s.facts}>
              <dt>Length</dt><dd>{out.length || "Not read"}</dd>
              <dt>Shade</dt><dd>{out.shade ? <><i style={{ background: out.hex }} />{out.shade} <small className="num">ΔE {out.dE?.toFixed(1)}</small></> : "Not enough hair visible"}</dd>
            </dl>
          )}
        </div>
      </div>
    </section>
  );
}

function Assistant({ brief, situation, person, fit }: { brief: SharePayload; situation: "chemo" | "alopecia"; person?: string; fit?: "Women" | "Men" }) {
  const [copied, setCopied] = useState(false);
  const url = typeof window === "undefined" ? "https://hairloom-studio.vercel.app/api/mcp" : `${window.location.origin}/api/mcp`;
  return (
    <section id="assistant" className="paper sec" data-noprint>
      <div className={`wrap ${s.tagWrap}`}>
        <div>
          <p className="kicker">For your AI assistant</p>
          <h2 className="h-sec">Ask your AI assistant what to pull before the client arrives.</h2>
          <p className="lede" style={{ marginTop: 12 }}>
            Hairloom runs an MCP server. Add it to any AI assistant that supports remote MCP servers, and it can rank your stock (or our demo boutique&rsquo;s) against a client&rsquo;s passport, give the pull list in their shade, plan dates around treatment and cost a fitting. Pair it with YouCam&rsquo;s own hosted MCP servers for live try-ons.
          </p>
          <div className={s.mcpUrl}>
            <code>{url}</code>
            <button className="btn btn-ink btn-sm" onClick={async () => { await navigator.clipboard.writeText(url).catch(() => undefined); setCopied(true); }}>{copied ? "Copied" : "Copy"}</button>
          </div>
          <p className="small" style={{ marginTop: 10 }}>Tools: match_wigs, shade_for_colour, list_stock, show_on_demo_person, fitting_plan, fitting_cost. No client photos ever pass through it.</p>
        </div>
        <Desk key={brief.name} brief={brief} situation={situation} person={person} fit={fit} />
      </div>
    </section>
  );
}
