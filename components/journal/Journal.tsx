"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { prepare, runTask } from "@/lib/client";
import { get, set } from "@/lib/store";
import s from "./journal.module.css";

type Milestone = { day: number; title: string; body: string; action?: { href: string; label: string }; src?: { label: string; url: string } };

const ACS = "https://www.cancer.org/cancer/managing-cancer/side-effects/hair-skin-nails/hair-loss/choosing-and-wearing-wig.html";
const ACS2 = "https://www.cancer.org/cancer/managing-cancer/side-effects/hair-skin-nails/hair-loss/coping-with-hair-loss.html";
const CRUK = "https://www.cancerresearchuk.org/about-cancer/treatment/cancer-drugs/side-effects/hair-loss-and-thinning";
const CRUK2 = "https://www.cancerresearchuk.org/about-cancer/coping/physically/changes-appearance/hair-loss/wigs-other-ways";

/** Days are relative to the first treatment; regrowth is relative to the last. */
const PLAN: Milestone[] = [
  { day: -14, title: "Keep your hair passport", body: "Three photos with your hair down, while it is still yours. This is the record every later step compares with.", action: { href: "/studio", label: "Open the studio" }, src: { label: "ACS: take photos and save a lock of hair", url: ACS } },
  { day: -10, title: "Choose and fit a wig", body: "Charities advise matching a wig before hair loss, while a fitter can still see your colour and style. Send your shortlist ahead.", action: { href: "/studio", label: "Try wigs" }, src: { label: "CRUK", url: CRUK2 } },
  { day: -3, title: "Soft headwear and a sleep cap", body: "Have something soft for nights and for the days without a wig.", action: { href: "/studio", label: "Try headwear" } },
  { day: 0, title: "First treatment", body: "Check in on your skin and scalp each week if you like. Bring anything that worries you to your care team." },
  { day: 14, title: "Hair usually starts to fall out", body: "Usually about two to three weeks after the first cycle. Your head may be up to a size smaller: have the wig cap adjusted.", src: { label: "ACS, CRUK", url: CRUK } },
  { day: 42, title: "Brows and lashes may thin", body: "They can go weeks or months after the hair on your head. Practise your rebuilt brows before you need them.", action: { href: "/studio", label: "Rebuild brows" } },
];
const REGROWTH: Milestone[] = [
  { day: 90, title: "Regrowth usually starts", body: "Hair usually returns within about three to six months of finishing, sometimes a different colour or curlier. Re-read it and compare with the hair you kept.", action: { href: "/studio", label: "Read new growth" }, src: { label: "CRUK, ACS", url: ACS2 } },
];

type CheckIn = { at: number; scores: Record<string, number>; masks: Record<string, string>; photo: string };
const CONCERNS = ["moisture", "redness", "texture", "radiance"] as const;
const LABEL: Record<string, string> = { moisture: "Moisture", redness: "Redness", texture: "Texture", radiance: "Radiance" };

const day = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
const fmt = (d: Date) => d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

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

  useEffect(() => { get<CheckIn[]>("checkins").then((c) => c && setChecks(c)); }, []);

  const items = useMemo(() => {
    if (!start || !end) return [];
    const s0 = new Date(start + "T09:00"), e0 = new Date(end + "T09:00");
    return [...PLAN.map((m) => ({ ...m, date: day(s0, m.day) })), ...REGROWTH.map((m) => ({ ...m, date: day(e0, m.day) }))];
  }, [start, end]);
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
      const full = await prepare(file, 1600);
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
    } finally {
      setBusy(false);
    }
  }

  const last = checks[checks.length - 1];

  return (
    <>
      <section className="night sec">
        <div className={`wrap ${s.planWrap}`}>
          <div className={s.planHead}>
            <p className="kicker">Plan</p>
            <h2 className="h-sec">Your dates</h2>
            <label>First treatment<input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
            <label>Last treatment (expected)<input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
            <button className="btn btn-ghost btn-sm" onClick={ics}>Add to my calendar (.ics)</button>
            <p className="small">General timings from cancer charities. Your care team knows your regimen; ask them what to expect.</p>
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
            <p className="kicker">Weekly skin check-in</p>
            <h2 id="skin-title" className="h-sec">Notice change early, then ask.</h2>
            <p className="lede" style={{ marginTop: 12 }}>
              Treatment can leave skin drier or more sensitive. A selfie each week gives you YouCam&rsquo;s raw scores for moisture, redness, texture and radiance, so you can show your care team what changed rather than describe it. Higher is better. This is not a diagnosis.
            </p>
            <label className="btn btn-ink" style={{ marginTop: 22, position: "relative" }}>
              {busy ? `Reading your skin… ${secs} s` : "Add this week's selfie · 9 units"}
              <input type="file" accept="image/*" capture="user" disabled={busy} style={{ position: "absolute", opacity: 0, width: 1, height: 1 }} onChange={(e) => checkIn(e.target.files?.[0])} />
            </label>
            <p className="small" style={{ marginTop: 10 }}>We crop to your face on this device first, because skin analysis needs the face to fill the frame. Photos and scores stay in this browser.</p>
            {err && <p className={s.err} role="alert">{err}</p>}
          </div>
          <div className={s.skinOut}>
            {last ? (
              <>
                <div className={s.maskBox}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={last.masks[show] ?? last.photo} alt={`${LABEL[show]} map from your latest check-in`} />
                </div>
                <div className={s.scoreTabs} role="tablist">
                  {CONCERNS.map((c) => (
                    <button key={c} role="tab" aria-selected={show === c} onClick={() => setShow(c)}>
                      <span>{LABEL[c]}</span>
                      <b className="num">{last.scores[c] ?? "—"}</b>
                      <Spark values={checks.map((x) => x.scores[c]).filter((v) => v != null)} />
                    </button>
                  ))}
                </div>
                <p className="small">{checks.length} check-in{checks.length > 1 ? "s" : ""}, latest {new Date(last.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}. Scores are YouCam&rsquo;s raw scores (1–100), not the flattered display scores.</p>
              </>
            ) : (
              <div className={s.empty}>Your first check-in appears here, with a map of each concern.</div>
            )}
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
