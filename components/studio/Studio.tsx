"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BOUTIQUE, WIGS } from "@/lib/catalogue";
import { PERSONAS, type Persona } from "@/lib/demo";
import { NOTES, demoShortlist } from "@/lib/brief";
import { demoDates } from "@/lib/dates";
import { fetchUnits, prepare, runTask, type UnitsInfo } from "@/lib/client";
import type { KindName } from "@/lib/kinds";
import { type Session, type Render, emptySession, erase, get, set } from "@/lib/store";
import { KeepStep } from "./KeepStep";
import { TryStep } from "./TryStep";
import { LookStep } from "./LookStep";
import { ShareStep } from "./ShareStep";
import { JudgeCode } from "./JudgeCode";
import s from "./studio.module.css";

export type Units = UnitsInfo;

export type Ctx = {
  session: Session;
  persona: Persona | null;
  update: (fn: (x: Session) => Session) => void;
  /** Runs a live YouCam task, records the render under `key`, and returns it (or an error message). */
  live: (kind: KindName, images: string[], opt: Record<string, string | number>, key?: string, onTick?: (n: number) => void) => Promise<{ ok: true; render?: Render; results: Record<string, unknown> } | { ok: false; message: string }>;
  units: Units;
  go: (step: Step) => void;
  /** A wig the shopper arrived with, from a shop's widget: pinned first in Try. */
  wig?: string;
};

export type Step = "keep" | "try" | "look" | "share";
const STEPS: { id: Step; label: string; hint: string }[] = [
  { id: "keep", label: "Keep", hint: "Your kept-hair record" },
  { id: "try", label: "Try", hint: "Wigs and your own hair" },
  { id: "look", label: "Brows & headwear", hint: "For the days without" },
  { id: "share", label: "Share", hint: "Send to your fitter" },
];

const pre = (src: string, api: string): Render => ({ src, api, units: 0, ms: 0, at: 0 });

/** Demo sessions are built from precomputed YouCam output, so they cost nothing. */
function demoSession(p: Persona): Session {
  const renders: Record<string, Render> = {};
  for (const [w, src] of Object.entries(p.wigs)) renders[`wig:${w}`] = pre(src, "AI Hairstyle Virtual Try-On");
  for (const [w, src] of Object.entries(p.withHair ?? {})) renders[`hair:${w}`] = pre(src, "AI Hairstyle Virtual Try-On");
  for (const [k, src] of Object.entries(p.shades ?? {})) renders[`shade:${k}`] = pre(src, "AI Hair Color Virtual Try-On");
  for (const [h, src] of Object.entries(p.headwear)) renders[`head:${h}`] = pre(src, "AI Image Generator (image to image)");
  for (const [k, src] of Object.entries(p.thinning ?? {})) renders[`thin:${k}`] = pre(src, k.startsWith("female_") ? "AI Hair Volume Virtual Try-On" : "AI Hair Extension Virtual Try-On");
  if (p.brows) renders["brows:demo"] = pre(p.brows, "AI Makeup Virtual Try-On");
  renders.own = pre(p.own, "AI Hairstyle Virtual Try-On");
  return {
    ...emptySession("demo", p.name), personaId: p.id, kept: p.kept, turns: p.turns.filter(Boolean) as string[], readings: p.readings,
    keptAt: demoDates().keptAt, today: p.week4, base: "today", later: p.later, situation: p.situation, fit: p.fit, cap: p.cap, renders,
    // Pre-seeded, so Share opens with looks to send: own hair back, the closest wig and one headwear.
    shortlist: demoShortlist(p).filter((k) => renders[k]), note: NOTES[p.id] ?? "",
  };
}

const STEP_IDS: Step[] = ["keep", "try", "look", "share"];

export function Studio({ initialPersona, initialStep, initialWig }: { initialPersona?: string; initialStep?: string; initialWig?: string }) {
  // undefined = still loading (avoids flashing the person picker), null = picker
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [step, setStep] = useState<Step>(STEP_IDS.includes(initialStep as Step) ? (initialStep as Step) : "keep");
  const [units, setUnits] = useState<Units>({ units: null, floor: 120, live: false });
  const [consenting, setConsenting] = useState(false);
  const loaded = useRef(false);

  const refreshUnits = useCallback(() => {
    fetchUnits().then((u) => u && setUnits(u));
  }, []);

  // Restore a saved live session, or start on a demo person.
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    (async () => {
      const fromUrl = initialPersona && PERSONAS.find((p) => p.id === initialPersona);
      if (fromUrl) return setSession(demoSession(fromUrl));
      const saved = await get<Session>("session");
      setSession(saved?.mode === "live" ? saved : null);
    })();
    refreshUnits();
  }, [initialPersona, refreshUnits]);

  const update = useCallback((fn: (x: Session) => Session) => {
    setSession((prev) => {
      if (!prev) return prev;
      const next = fn(prev);
      if (next.mode === "live") void set("session", next);
      return next;
    });
  }, []);

  const live: Ctx["live"] = useCallback(async (kind, images, opt, key, onTick) => {
    const imgs = await Promise.all(images.map((i) => (i.startsWith("data:") ? i : prepare(i))));
    const r = await runTask(kind, imgs, opt, onTick);
    refreshUnits();
    if (!r.ok) return { ok: false, message: r.message };
    const render = r.image ? { src: r.image, api: r.api, units: r.units, ms: r.ms, at: Date.now() } : undefined;
    update((x) => ({ ...x, unitsSpent: x.unitsSpent + r.units, renders: key && render ? { ...x.renders, [key]: render } : x.renders }));
    return { ok: true, render, results: r.results };
  }, [update, refreshUnits]);

  const persona = useMemo(() => (session?.personaId ? PERSONAS.find((p) => p.id === session.personaId) ?? null : null), [session?.personaId]);

  if (session === undefined) return <div className={s.loading} aria-busy="true">Opening the studio…</div>;
  if (consenting) {
    return <Consent onBack={() => setConsenting(false)} onAgree={() => { setConsenting(false); setSession({ ...emptySession("live"), consent: Date.now(), base: "kept", later: "Today" }); setStep("keep"); }} />;
  }
  if (session === null) return <Start onDemo={(p) => { setSession(demoSession(p)); setStep(STEP_IDS.includes(initialStep as Step) ? (initialStep as Step) : initialWig ? "try" : "keep"); }} onLive={() => setConsenting(true)} units={units} onCode={refreshUnits} wig={WIGS.find((w) => w.id === initialWig)?.name} />;

  const ctx: Ctx = { session, persona, update, live, units, wig: WIGS.some((w) => w.id === initialWig) ? initialWig : undefined, go: (st) => { setStep(st); window.scrollTo({ top: 0, behavior: "smooth" }); } };
  const done = {
    keep: !!session.readings,
    try: session.shortlist.some((k) => /^(wig|hair|shade|thin):/.test(k) || k === "own"),
    look: session.shortlist.some((k) => k.startsWith("head:") || k.startsWith("brows:")),
    share: !!session.sharedAt,
  };

  return (
    <div className={s.shell}>
      <aside className={s.side} aria-label="Studio steps">
        <div className={s.who}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {session.kept ? <img src={session.kept} alt="" /> : <span className={s.whoBlank} aria-hidden="true" />}
          <div>
            <b>{session.name}</b>
            <span>{session.mode === "demo" ? "Demo person" : "Your photos"}</span>
          </div>
        </div>
        <ol className={s.stepList}>
          {STEPS.map((st, i) => (
            <li key={st.id}>
              <button aria-current={step === st.id ? "step" : undefined} onClick={() => ctx.go(st.id)}>
                <span className={s.stepNum} aria-hidden="true">{done[st.id] ? "✓" : i + 1}</span>
                <span><b>{st.label}</b><small>{st.hint}</small></span>
              </button>
            </li>
          ))}
        </ol>
        {session.mode === "demo" ? (
          <p className={s.demoNote}>Everything shown for {session.name} is real YouCam output, prepared in advance, so it&rsquo;s instant and free.</p>
        ) : (
          <UnitMeter units={units} spent={session.unitsSpent} />
        )}
        <div className={s.sideFoot}>
          <button className="btn btn-ghost btn-sm" onClick={() => setSession(null)}>Switch person</button>
          {session.mode === "live" && (
            <button className="btn btn-ghost btn-sm" onClick={async () => { if (window.confirm("Erase your kept-hair record and every try-on from this device?")) { await erase(); setSession(null); } }}>Erase my photos</button>
          )}
        </div>
      </aside>
      <section className={s.main} aria-live="polite">
        {step === "keep" && <KeepStep ctx={ctx} />}
        {step === "try" && <TryStep ctx={ctx} />}
        {step === "look" && <LookStep ctx={ctx} />}
        {step === "share" && <ShareStep ctx={ctx} />}
      </section>
    </div>
  );
}

function UnitMeter({ units, spent }: { units: Units; spent: number }) {
  return (
    <details className={s.meter}>
      <summary>{units.live ? "Live studio is on" : units.units == null ? "Checking the live studio…" : "Live studio is resting"}</summary>
      <p className="small">
        Each reading or try-on uses YouCam API units (1–2 for a try-on, up to 16 for a kept-hair record). You&rsquo;ve used {spent}; <span className="num">{units.units ?? "—"}</span> are left on this demo account, with some kept back for judging.
      </p>
    </details>
  );
}

function Consent({ onAgree, onBack }: { onAgree: () => void; onBack: () => void }) {
  const [ok, setOk] = useState(false);
  return (
    <div className={s.consent}>
      <p className="kicker">Before you add photos</p>
      <h1 className="h-sec">How your photos are handled</h1>
      <ul>
        <li>Your photos and kept-hair record are kept in this browser. There&rsquo;s no account.</li>
        <li>For each reading or try-on, the photo it needs is sent through our server to YouCam (Perfect Corp) to be processed. As soon as your browser has the result, we ask YouCam to delete that task and its photo.</li>
        <li>Hair colour is measured on this device and never uploaded for that.</li>
        <li>Hairloom helps with appearance. It doesn&rsquo;t diagnose anything; talk to your care team about treatment and hair loss.</li>
        <li>A try-on shows style and colour. It can&rsquo;t show how a cap fits, how heavy a wig is or how lace looks up close, so try real wigs with a fitter before you buy.</li>
      </ul>
      <label className={s.check}><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} /> I&rsquo;m 18 or over, these are photos of me, and I agree to the above.</label>
      <div className={s.next}>
        <button className="btn btn-ivory" disabled={!ok} onClick={onAgree}>Continue with my photos</button>
        <button className="btn btn-ghost" onClick={onBack}>Back</button>
      </div>
    </div>
  );
}

function Start({ onDemo, onLive, units, onCode, wig }: { onDemo: (p: Persona) => void; onLive: () => void; units: Units; onCode: () => void; wig?: string }) {
  return (
    <div className={s.start}>
      <div className={s.startHead}>
        <p className="kicker">The studio</p>
        <h1 className="h-sec">Whose hair are we keeping today?</h1>
        <p className="lede">Start with a demo person to see every step instantly, or use your own photos. Your record stays in this browser.</p>
        {wig && <p className={s.fromShop}>You came from {BOUTIQUE.name} to try <b>{wig}</b>. It will be first in step 2, whoever you choose.</p>}
      </div>
      <div className={s.startGrid}>
        {PERSONAS.map((p) => (
          <button key={p.id} className={s.startCard} onClick={() => onDemo(p)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.kept} alt="" />
            <span className={s.startText}>
              <b>{p.name}, {p.age}</b>
              <span>{p.blurb}</span>
              <small>Demo person · instant</small>
            </span>
          </button>
        ))}
        <button className={`${s.startCard} ${s.startLive}`} onClick={onLive} disabled={units.units != null && !units.live}>
          <span className={s.startArch} aria-hidden="true">
            <svg viewBox="0 0 120 160" width="62%"><g fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M30 150V70a30 30 0 0 1 60 0v80" /><circle cx="60" cy="92" r="16" /><path d="M44 64h32" opacity=".5" /></g></svg>
          </span>
          <span className={s.startText}>
            <b>Use my own photos</b>
            <span>YouCam&rsquo;s camera guides you through three angles, or upload photos. Your record stays on this device.</span>
            <small>
              {units.units == null ? "Checking the live studio…"
                : units.lane === "bad_code" ? "That judge code isn't right; check it or clear it"
                : units.live ? `Live${units.lane === "judge" ? " (judge allowance)" : ""}${units.dayLeft != null ? ` · ${units.dayLeft} of ${units.dayCap} units left today` : ""}`
                : units.dayLeft === 0 ? "Today's live units are used up; live runs return at 05:30 IST, demo people still work"
                : "Resting to save units for judging; demo people still work"}
            </small>
          </span>
        </button>
      </div>
      <JudgeCode onChange={onCode} />
    </div>
  );
}
