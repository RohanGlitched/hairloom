"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { prepare, runTask } from "@/lib/client";
import { get, set } from "@/lib/store";
import { persona } from "@/lib/demo";
import { Consent, hasConsent } from "@/components/Consent";
import s from "./journal.module.css";

type Milestone = { day: number; title: string; body: string; action?: { href: string; label: string }; src?: { label: string; url: string } };

const ACS = "https://www.cancer.org/cancer/managing-cancer/side-effects/hair-skin-nails/hair-loss/choosing-and-wearing-wig.html";
const ACS2 = "https://www.cancer.org/cancer/managing-cancer/side-effects/hair-skin-nails/hair-loss/coping-with-hair-loss.html";
const CRUK = "https://www.cancerresearchuk.org/about-cancer/treatment/cancer-drugs/side-effects/hair-loss-and-thinning";
const CRUK2 = "https://www.cancerresearchuk.org/about-cancer/coping/physically/changes-appearance/hair-loss/wigs-other-ways";

/** Days are relative to the first treatment; regrowth is relative to the last. */
const PLAN: Milestone[] = [
  { day: -14, title: "Keep your hair passport", body: "Three photos with your hair down, while it is still yours. This is the record every later step compares with.", action: { href: "/studio", label: "Open the studio" }, src: { label: "ACS: take photos and save a lock of hair", url: ACS } },
  { day: -10, title: "Choose and fit a wig", body: "Charities advise matching a wig before hair loss, while a fitter can still see your colour and style. Send your shortlist ahead.", action: { href: "/studio?step=try", label: "Try wigs" }, src: { label: "CRUK", url: CRUK2 } },
  { day: -3, title: "Soft headwear and a sleep cap", body: "Have something soft for nights and for the days without a wig.", action: { href: "/studio?step=look", label: "Try headwear" } },
  { day: 0, title: "First treatment", body: "If it helps, add a skin check-in once per treatment cycle. Bring anything that worries you to your care team." },
  { day: 14, title: "Hair usually starts to fall out", body: "Usually about two to three weeks after the first cycle.", src: { label: "ACS, CRUK", url: CRUK } },
  { day: 21, title: "Measure your head again", body: "Your head can be up to a size smaller once the hair has gone. Re-measure with a soft tape and have the wig cap adjusted.", src: { label: "ACS", url: ACS } },
  { day: 42, title: "Brows and lashes may thin", body: "They can go weeks or months after the hair on your head. Practise your rebuilt brows before you need them.", action: { href: "/studio?step=look", label: "Rebuild brows" } },
];
const ALOPECIA: Milestone[] = [
  { day: 0, title: "Keep your hair passport now", body: "While your hair still covers the patches. It is the record a fitter matches to, however things change.", action: { href: "/studio", label: "Open the studio" } },
  { day: 7, title: "Try toppers before wigs", body: "If the patches are small, a topper or clip-ins may be enough. Preview volume and length on your kept photo.", action: { href: "/studio?step=try", label: "Try toppers" } },
  { day: 30, title: "Re-photograph each month", body: "Patches in alopecia areata can spread, settle or regrow, so a monthly photo helps you and your dermatologist see the pattern. It is a photo record, not a measurement." },
  { day: 60, title: "Choose with a fitter when you're ready", body: "Send your passport and shortlist ahead, with your head size and parting.", action: { href: "/studio?step=share", label: "Share a brief" } },
];
const REGROWTH: Milestone[] = [
  { day: 90, title: "Regrowth usually starts", body: "Hair usually returns within about three to six months of finishing, sometimes a different colour or curlier. Re-read it and compare with the hair you kept.", action: { href: "/studio", label: "Read new growth" }, src: { label: "CRUK, ACS", url: ACS2 } },
];

type CheckIn = { at: number; scores: Record<string, number>; masks: Record<string, string>; photo: string };
const CONCERNS = ["moisture", "redness", "texture", "radiance"] as const;
const LABEL: Record<string, string> = { moisture: "Moisture", redness: "Redness", texture: "Texture", radiance: "Radiance" };

const day = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
const fmt = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", ...(d.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}) });

export function Journal() {
  // Dates depend on "today", so they are set after mount to keep server and client markup identical.
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  useEffect(() => {
    setStart(day(new Date(), 14).toISOString().slice(0, 10));
    setEnd(day(new Date(), 14 + 18 * 7).toISOString().slice(0, 10));
  }, []);
  const [checks, setChecks] = useState<CheckIn[]>([]);
  const [busy, setBusy] = useState(false);
  const [secs, setSecs] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [show, setShow] = useState<string>("redness");
  const [map, setMap] = useState(false);
  const [mode, setMode] = useState<"chemo" | "alopecia">("chemo");
  // Same consent as the studio before any photo leaves the device. A ref, so the picker opens in the same click.
  const agreed = useRef(false);
  const [asking, setAsking] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  useEffect(() => { get<CheckIn[]>("checkins").then((c) => c && setChecks(c)); hasConsent().then((v) => { agreed.current = v; }); }, []);

  const items = useMemo(() => {
    if (!start || !end) return [];
    const s0 = new Date(start + "T09:00"), e0 = new Date(end + "T09:00");
    if (mode === "alopecia") return ALOPECIA.map((m) => ({ ...m, date: day(new Date(), m.day) }));
    return [...PLAN.map((m) => ({ ...m, date: day(s0, m.day) })), ...REGROWTH.map((m) => ({ ...m, date: day(e0, m.day) }))];
  }, [start, end, mode]);
  const today = Date.now();

  function ics() {
    const stamp = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, "");
    const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Hairloom//Journal//EN", ...items.flatMap((m, i) => ["BEGIN:VEVENT", `UID:hairloom-${i}-${stamp(m.date)}@hairloom`, `DTSTAMP:${stamp(new Date())}T000000Z`, `DTSTART;VALUE=DATE:${stamp(m.date)}`, `SUMMARY:${m.title}`, `DESCRIPTION:${m.body.replace(/[,;]/g, "\\$&")}`, "END:VEVENT"]), "END:VCALENDAR"];
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/calendar" }));
    a.download = "hairloom-plan.ics";
    a.click();
  }

  async function checkIn(file?: File) {
    if (!file) return;
    setErr(null); setBusy(true); setSecs(0);
    try {
      // Crop from the full photo (up to YouCam's 2560 px), not a downscaled copy.
      const full = await prepare(file, 2560);
      const { cropFace } = await import("@/lib/faceCrop");
      const face = await cropFace(full);
      if (!face) { setErr("We need one clear face in the photo. Face the camera in good light."); return; }
      const r = await runTask("skin", [face], {}, setSecs);
      if (!r.ok) { setErr(r.message); return; }
      const out = (r.results.output as { type: string; raw_score: number; mask?: string | null }[]) ?? [];
      const c: CheckIn = { at: Date.now(), scores: Object.fromEntries(out.map((o) => [o.type, Math.round(o.raw_score)])), masks: Object.fromEntries(out.filter((o) => o.mask).map((o) => [o.type, o.mask!])), photo: await prepare(face, 360) };
      const next = [...checks, c].slice(-12);
      setChecks(next);
      await set("checkins", next);
    } catch {
      setErr("This photo couldn't be read. Try another, or check your connection.");
    } finally {
      setBusy(false);
    }
  }

  const demo = persona("anjali").skin ?? [];
  const example = checks.length === 0 && demo.length > 0;
  const shown: CheckIn[] = example ? demo.map((d, i) => ({ at: Date.parse("2026-10-21") + d.week * 7 * 86400000 + i, scores: d.scores, masks: d.masks, photo: d.photo })) : checks;
  const last = shown[shown.length - 1];

  return (
    <>
      <section className="night sec">
        <div className={`wrap ${s.planWrap}`}>
          <div className={s.planHead}>
            <p className="kicker">Plan</p>
            <h2 className="h-sec">Your dates</h2>
            <div className={s.modes} role="radiogroup" aria-label="Kind of hair loss">
              <button role="radio" aria-checked={mode === "chemo"} onClick={() => setMode("chemo")}>Chemotherapy</button>
              <button role="radio" aria-checked={mode === "alopecia"} onClick={() => setMode("alopecia")}>Alopecia or thinning</button>
            </div>
            {mode === "chemo" && <>
              <label>First treatment<input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
              <label>Last treatment (expected)<input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
            </>}
            <button className="btn btn-ghost btn-sm" onClick={ics}>Add to my calendar (.ics)</button>
            <p className="small">{mode === "chemo" ? "General timings from cancer charities. Your care team knows your regimen; ask them what to expect." : "General guidance, not medical advice. Your dermatologist knows your pattern; ask them what to expect."}</p>
          </div>
          <ol className={s.timeline}>
            {items.map((m) => (
              <li key={m.title} data-past={m.date.getTime() < today}>
                <time className="num">{fmt(m.date)}</time>
                <div>
                  <h3 className="h-sub">{m.title}</h3>
                  <p>{m.body}</p>
                  <p className={s.links}>
                    {m.action && <Link href={m.action.href}>{m.action.label}</Link>}
                    {m.src && <a href={m.src.url} target="_blank" rel="noreferrer" className="src">{m.src.label}</a>}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="paper sec" aria-labelledby="skin-title">
        <div className={`wrap ${s.skinWrap}`}>
          <div>
            <p className="kicker">Skin check-in</p>
            <h2 id="skin-title" className="h-sec">{mode === "chemo" ? "Skin check-ins, once a cycle." : "Skin check-ins, when you want a record."}</h2>
            <p className="lede" style={{ marginTop: 12 }}>
              {mode === "chemo"
                ? <>Treatment can leave skin drier or more sensitive. A selfie each treatment cycle gives you YouCam&rsquo;s scores for moisture, redness, texture and radiance, so you can show your care team what changed rather than describe it. It is not a diagnosis; anything that worries you is a question for them.</>
                : <>A selfie gives you YouCam&rsquo;s cosmetic scores for moisture, redness, texture and radiance, a photo record you can show your dermatologist if your skin changes. It doesn&rsquo;t measure hair loss and it is not a diagnosis.</>}
            </p>
            <label className="btn btn-ink" style={{ marginTop: 22, position: "relative" }} onClick={(e) => { if (!agreed.current && !busy) { e.preventDefault(); setAsking(true); } }}>
              {busy ? `Reading your skin… ${secs} s` : <>Check in on my skin <small style={{ fontWeight: 400, opacity: 0.75 }}>· 9 units</small></>}
              <input ref={picker} type="file" accept="image/*" capture="user" disabled={busy} style={{ position: "absolute", opacity: 0, width: 1, height: 1 }} onChange={(e) => { void checkIn(e.target.files?.[0]); e.target.value = ""; }} />
            </label>
            {asking && (
              <Consent
                agree="I’m 18 or over, this is a photo of me, and I agree to the above."
                button="btn-ink"
                onCancel={() => setAsking(false)}
                onAgree={() => { agreed.current = true; setAsking(false); picker.current?.click(); }}
              />
            )}
            <p className="small" style={{ marginTop: 10 }}>We crop to your face on this device first, because skin analysis needs the face to fill the frame. Photos and scores stay in this browser.</p>
            {err && <p className={s.err} role="alert">{err}</p>}
          </div>
          <div className={s.skinOut}>
            {last ? (
              <>
                <div className={s.maskBox}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={last.photo} alt="Your latest check-in photo" />
                  {/* The concern map is faint, kept to the face, and shown only on request. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {map && last.masks[show] && <img className={s.mask} src={last.masks[show]} alt={`${LABEL[show]} map, faded over the face`} />}
                </div>
                {last.masks[show] && (
                  <button className={s.mapBtn} aria-pressed={map} onClick={() => setMap(!map)}>{map ? `Hide the ${LABEL[show].toLowerCase()} map` : `Show where YouCam read ${LABEL[show].toLowerCase()}`}</button>
                )}
                <div className={s.scoreTabs} role="tablist">
                  {CONCERNS.map((c) => {
                    const vals = shown.map((x) => x.scores[c]).filter((v) => v != null);
                    const d = vals.length > 1 ? vals[vals.length - 1] - vals[vals.length - 2] : null;
                    return (
                      <button key={c} role="tab" aria-selected={show === c} onClick={() => setShow(c)}>
                        <span>{LABEL[c]} <i className={s.dir}>higher is better</i></span>
                        <b className="num">{last.scores[c] ?? "—"}</b>
                        <Spark values={vals} />
                        {d != null && <small className={s.trend} data-trend={Math.abs(d) < 3 ? "same" : d > 0 ? "better" : "worse"}>{Math.abs(d) < 3 ? "About the same" : d > 0 ? `Better by ${d}` : `Worse by ${-d}`}</small>}
                      </button>
                    );
                  })}
                </div>
                <p className="small">
                  {example
                    ? "Example: Anjali's check-ins before treatment and at week 4 (demo person, real YouCam output). Yours replace these."
                    : `${checks.length} check-in${checks.length > 1 ? "s" : ""}, latest ${new Date(last.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}.`}{" "}
                  Scores are YouCam&rsquo;s raw 1&ndash;100 scores, and higher is better for every concern.
                </p>
                <p className={s.cosmetic}>
                  These are cosmetic scores read from a photo, not a medical assessment. Light, camera and make-up change them; ask your care team about anything that worries you.
                </p>
              </>
            ) : (
              <div className={s.empty}>Your first check-in appears here, with a map of each concern.</div>
            )}
          </div>
        </div>
      </section>

      <section className="night sec" aria-labelledby="pay-title">
        <div className="wrap">
          <p className="kicker">Paying for a wig</p>
          <h2 id="pay-title" className="h-sec">Ask before you buy.</h2>
          <div className={s.pay}>
            <div><h3 className="h-sub">India</h3><p>Some hospitals and charities give free wigs made from donated hair, such as the Tata Memorial Centre with the Cherian Foundation, and Cope with Cancer in Mumbai. Ask your oncology team or social worker.</p></div>
            <div><h3 className="h-sub">UK</h3><p>Wigs are free on the NHS in Scotland and Wales. In England an NHS stock synthetic wig costs &pound;80.15 unless you qualify for free prescriptions.</p><a className="src" href="https://www.nhsbsa.nhs.uk/help-travel-eye-care-wigs-and-fabric-support-costs/wigs-and-fabric-supports" target="_blank" rel="noreferrer">NHSBSA</a></div>
            <div><h3 className="h-sub">US</h3><p>Original Medicare doesn&rsquo;t cover wigs. Some private plans do with a doctor&rsquo;s prescription for a &ldquo;cranial prosthesis&rdquo;; your passport is useful paperwork.</p><a className="src" href="https://www.breastcancer.org/treatment-side-effects/hair-loss/wigs/insurance" target="_blank" rel="noreferrer">Breastcancer.org</a></div>
            <div><h3 className="h-sub">Children</h3><p>Hairloom is for adults. Children&rsquo;s hair loss needs a paediatric team and specialist wig charities, who fit wigs for growing heads.</p></div>
          </div>
        </div>
      </section>
    </>
  );
}

function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return <svg width="64" height="18" aria-hidden="true" />;
  const min = Math.min(...values) - 2, max = Math.max(...values) + 2;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 62 + 1},${17 - ((v - min) / (max - min)) * 16}`).join(" ");
  return <svg width="64" height="18" aria-hidden="true"><polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>;
}
