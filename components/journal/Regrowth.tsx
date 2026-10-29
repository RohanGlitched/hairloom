"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { persona, type Readings } from "@/lib/demo";
import { prepare, runTask } from "@/lib/client";
import { get, type Session } from "@/lib/store";
import { bridgeFor, regrowthDiff } from "@/lib/regrowth";
import { inr } from "@/lib/catalogue";
import { Consent, hasConsent } from "@/components/Consent";
import regrowth from "@/data/regrowth.json";
import s from "./journal.module.css";

type Now = Pick<Readings, "type" | "length">;
const SLOTS = ["Front", "Turned one way", "Turned the other way"];

/**
 * "Read new growth": the kept-hair record's own detections (Hair Type and Hair Length, one shared upload)
 * on photos of new growth, compared with the hair kept. Anjali's example is prepared, so it's free.
 */
export function Regrowth() {
  const anjali = persona("anjali");
  const ex = regrowth.anjali;
  const [mine, setMine] = useState<Session | null>(null);
  const [photos, setPhotos] = useState<(string | null)[]>([null, null, null]);
  const [now, setNow] = useState<Now | null>(null);
  const [busy, setBusy] = useState(false);
  const [secs, setSecs] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const agreed = useRef(false);
  const [asking, setAsking] = useState<number | null>(null);
  const pickers = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    get<Session>("session").then((x) => setMine(x?.mode === "live" && x.readings ? x : null));
    hasConsent().then((v) => { agreed.current = v; });
  }, []);

  const live = !!now;
  // Live: your re-read against your passport. Otherwise Anjali's example against hers.
  const keptReadings = live && mine?.readings ? mine.readings : anjali.readings;
  const shown: Now = now ?? (ex.readings as Now);
  const diff = regrowthDiff(keptReadings, shown);
  const bridge = bridgeFor(shown, live ? mine?.fit ?? "Women" : anjali.fit);

  async function read() {
    if (!photos.every(Boolean)) return;
    setBusy(true); setErr(null); setSecs(0);
    try {
      const img = new Image(); img.src = photos[0]!; await img.decode();
      const size: [number, number] = [img.naturalWidth, img.naturalHeight];
      let [a, b] = [photos[1]!, photos[2]!];
      try {
        const { facing } = await import("@/lib/faceCrop");
        const [fa, fb] = await Promise.all([facing(a), facing(b)]);
        if (fa === "left" && fb === "right") [a, b] = [b, a];
      } catch { /* keep the order given */ }
      const trio = await Promise.all([photos[0]!, a, b].map((p) => prepare(p, 1024, size)));
      const r = await runTask("hairType", trio, { also: "hairLength" }, setSecs);
      if (!r.ok) { setErr(r.message); return; }
      const parts = (r.results as { parts?: Record<string, Record<string, unknown>> }).parts ?? {};
      const type = (parts.hairType?.hair_type as Now["type"]) ?? null;
      const length = (parts.hairLength?.hair_length as Now["length"]) ?? null;
      if (!type && !length) { setErr("No reading came back. Use three clear photos: front, then turned each way."); return; }
      setNow({ type, length });
    } catch {
      setErr("These photos couldn't be read. Try JPEG or PNG photos.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="regrowth" className="deep sec" aria-labelledby="regrow-title">
      <div className={`wrap ${s.regWrap}`}>
        <div className={s.regText}>
          <p className="kicker">Regrowth</p>
          <h2 id="regrow-title" className="h-sec">Read the new growth against the hair you kept.</h2>
          <p className="lede">
            Hair usually returns within three to six months of finishing treatment, often curlier or a different colour. The same YouCam detections that made the kept-hair record, Hair Type and Hair Length on one shared upload, read the new growth, and Hairloom says what changed and which wigs suit it while it grows.
          </p>
          <dl className={s.diff}>
            <dt>Curl</dt>
            <dd><span>Kept: {diff.curl?.kept ?? "not read"}</span><span>Now: {diff.curl?.now ?? "not read"}</span><b>{diff.curl?.word}</b></dd>
            <dt>Length</dt>
            <dd><span>Kept: {diff.length?.kept ?? "not read"}</span><span>Now: {diff.length?.now ?? "not read"}</span><b>{diff.length?.word}</b></dd>
          </dl>
          <p className={s.regSum}>{diff.summary}</p>
          <p className="small">
            While it grows: {bridge.map(({ w, band }, i) => <span key={w.id}>{i > 0 && " or "}<Link href={`/studio?wig=${w.id}`}>{w.name}</Link> ({w.style.toLowerCase()}, {inr(w.price)}, {band.toLowerCase()})</span>)}, ranked against the new growth rather than the hair kept. A topper or a soft cap also works while it fills in.
          </p>
          <p className="small">
            {live ? "Your new growth, read live and compared with your kept-hair record. Photos stay in this browser." : <>Example: Anjali, a demo person. {ex.note}</>}
          </p>

          <div className={s.regLive}>
            <b>Read your own new growth</b>
            {mine ? (
              <>
                <div className={s.regSlots}>
                  {SLOTS.map((label, i) => (
                    <label key={label} className={s.regSlot} onClick={(e) => { if (!agreed.current && !busy) { e.preventDefault(); setAsking(i); } }}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {photos[i] ? <img src={photos[i]!} alt={label} /> : <span>{label}</span>}
                      <input ref={(el) => { pickers.current[i] = el; }} type="file" accept="image/*" disabled={busy} style={{ position: "absolute", opacity: 0, width: 1, height: 1 }}
                        onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; const url = await prepare(f, 1024); setPhotos((p) => p.map((x, j) => (j === i ? url : x))); }} />
                    </label>
                  ))}
                </div>
                {asking != null && (
                  <Consent agree="I’m 18 or over, these are photos of me, and I agree to the above." button="btn-ivory" onCancel={() => setAsking(null)}
                    onAgree={() => { agreed.current = true; const i = asking; setAsking(null); pickers.current[i]?.click(); }} />
                )}
                <button className="btn btn-ghost btn-sm" disabled={busy || !photos.every(Boolean)} onClick={read}>
                  {busy ? `Reading your new growth… ${secs} s` : "Read my new growth · 4 units"}
                </button>
              </>
            ) : (
              <p className="small">It compares with the kept-hair record in this browser, so <Link href="/studio">keep a record of your hair in the studio</Link> first.</p>
            )}
            {err && <p className={s.err} role="alert">{err}</p>}
          </div>
        </div>
        <div className={s.regPair}>
          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={live && mine?.kept ? mine.kept : anjali.kept} alt="The kept photo, before treatment" />
            <figcaption>Kept</figcaption>
          </figure>
          <figure>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={live ? photos[0]! : ex.photo} alt="New growth after treatment" />
            <figcaption>{live ? "New growth" : ex.label}</figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
