"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PERSONAS, type Persona } from "@/lib/demo";
import { prepare, runTask } from "@/lib/client";
import type { KindName } from "@/lib/kinds";
import { type Session, type Render, emptySession, erase, get, set } from "@/lib/store";
import { KeepStep } from "./KeepStep";
import { TryStep } from "./TryStep";
import { LookStep } from "./LookStep";
import { ShareStep } from "./ShareStep";
import s from "./studio.module.css";

export type Units = { units: number | null; floor: number; live: boolean };

export type Ctx = {
  session: Session;
  persona: Persona | null;
  update: (fn: (x: Session) => Session) => void;
  /** Runs a live YouCam task, records the render under `key`, and returns it (or an error message). */
  live: (kind: KindName, images: string[], opt: Record<string, string | number>, key?: string, onTick?: (n: number) => void) => Promise<{ ok: true; render?: Render; results: Record<string, unknown> } | { ok: false; message: string }>;
  units: Units;
  go: (step: Step) => void;
};

export type Step = "keep" | "try" | "look" | "share";
const STEPS: { id: Step; label: string; hint: string }[] = [
  { id: "keep", label: "Keep", hint: "Your hair passport" },
  { id: "try", label: "Try", hint: "Wigs and your own hair" },
  { id: "look", label: "Brows & headwear", hint: "For the days without" },
  { id: "share", label: "Share", hint: "Send to your fitter" },
];

/** Demo sessions are built from precomputed YouCam output, so they cost nothing. */
function demoSession(p: Persona): Session {
  const renders: Record<string, Render> = {};
  for (const [w, src] of Object.entries(p.wigs)) renders[`wig:${w}`] = { src, api: "AI Hairstyle Virtual Try-On", units: 0, ms: 0, at: 0 };
  for (const [h, src] of Object.entries(p.headwear)) renders[`head:${h}`] = { src, api: "AI Image Generator (image to image)", units: 0, ms: 0, at: 0 };
  renders.own = { src: p.own, api: "AI Hairstyle Virtual Try-On", units: 0, ms: 0, at: 0 };
  return { ...emptySession("demo", p.name), personaId: p.id, kept: p.kept, turns: p.turns.filter(Boolean) as string[], readings: p.readings, keptAt: Date.parse("2026-10-21"), today: p.week4, renders, shortlist: [] };
}

export function Studio({ initialPersona }: { initialPersona?: string }) {
  const [session, setSession] = useState<Session | null>(null);
  const [step, setStep] = useState<Step>("keep");
  const [units, setUnits] = useState<Units>({ units: null, floor: 120, live: false });
  const loaded = useRef(false);

  // Restore a saved live session, or start on a demo person.
  useEffect(() => {
    if (loaded.current) return;
    loaded.current = true;
    (async () => {
      const saved = await get<Session>("session");
      const fromUrl = initialPersona && PERSONAS.find((p) => p.id === initialPersona);
      if (fromUrl) setSession(demoSession(fromUrl));
      else if (saved?.mode === "live") setSession(saved);
      else setSession(null);
    })();
    fetch("/api/units").then((r) => r.json()).then((u) => setUnits({ units: u.units, floor: u.floor ?? 120, live: !!u.live })).catch(() => undefined);
  }, [initialPersona]);

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
    fetch("/api/units").then((x) => x.json()).then((u) => setUnits({ units: u.units, floor: u.floor ?? 120, live: !!u.live })).catch(() => undefined);
    if (!r.ok) return { ok: false, message: r.message };
    const render = r.image ? { src: r.image, api: r.api, units: r.units, ms: r.ms, at: Date.now() } : undefined;
    update((x) => ({ ...x, unitsSpent: x.unitsSpent + r.units, renders: key && render ? { ...x.renders, [key]: render } : x.renders }));
    return { ok: true, render, results: r.results };
  }, [update]);

  const persona = useMemo(() => (session?.personaId ? PERSONAS.find((p) => p.id === session.personaId) ?? null : null), [session?.personaId]);

  if (session === null) return <Start onDemo={(p) => { setSession(demoSession(p)); setStep("keep"); }} onLive={() => { setSession(emptySession("live")); setStep("keep"); }} units={units} />;

  const ctx: Ctx = { session, persona, update, live, units, go: (st) => { setStep(st); window.scrollTo({ top: 0, behavior: "smooth" }); } };
  const done = { keep: !!session.readings, try: session.shortlist.some((k) => k.startsWith("wig:") || k.startsWith("shade:") || k === "own"), look: session.shortlist.some((k) => k.startsWith("head:") || k.startsWith("brows:")), share: false };

  return (
    <div className={s.shell}>
      <aside className={s.side} aria-label="Studio steps">
        <div className={s.who}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {session.kept ? <img src={session.kept} alt="" /> : <span className={s.whoBlank} aria-hidden="true" />}
          <div>
            <b>{session.name}</b>
            <span>{session.mode === "demo" ? "Demo person · free" : "Your photos · stays on this device"}</span>
          </div>
        </div>
        <ol className={s.stepList}>
          {STEPS.map((st, i) => (
            <li key={st.id}>
              <button aria-current={step === st.id ? "step" : undefined} onClick={() => ctx.go(st.id)}>
                <span className={s.stepNum}>{done[st.id] ? "✓" : i + 1}</span>
                <span><b>{st.label}</b><small>{st.hint}</small></span>
              </button>
            </li>
          ))}
        </ol>
        <UnitMeter units={units} spent={session.unitsSpent} />
        <div className={s.sideFoot}>
          <button className="btn btn-ghost btn-sm" onClick={() => setSession(null)}>Switch person</button>
          {session.mode === "live" && (
            <button className="btn btn-ghost btn-sm" onClick={async () => { if (confirmErase()) { await erase(); setSession(null); } }}>Erase my photos</button>
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

function confirmErase() {
  return typeof window !== "undefined" && window.confirm("Erase your hair passport and every try-on from this device?");
}

function UnitMeter({ units, spent }: { units: Units; spent: number }) {
  return (
    <div className={s.meter}>
      <p><b className="num">{units.units ?? "—"}</b> YouCam units left for live runs</p>
      <p className="small">
        {units.units == null ? "Checking the live balance…" : units.live ? `You've used ${spent} here. Demo people are free.` : "Live runs are paused to save units for judging. Demo people still work."}
      </p>
    </div>
  );
}

function Start({ onDemo, onLive, units }: { onDemo: (p: Persona) => void; onLive: () => void; units: Units }) {
  return (
    <div className={s.start}>
      <div className={s.startHead}>
        <p className="kicker">The studio</p>
        <h1 className="h-sec">Whose hair are we keeping today?</h1>
        <p className="lede">Start with a demo person to see every step instantly, or use your own photos. Your photos stay in this browser.</p>
      </div>
      <div className={s.startGrid}>
        {PERSONAS.map((p) => (
          <button key={p.id} className={s.startCard} onClick={() => onDemo(p)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.kept} alt="" />
            <span className={s.startText}>
              <b>{p.name}, {p.age}</b>
              <span>{p.blurb}</span>
              <small>Demo person · free · precomputed</small>
            </span>
          </button>
        ))}
        <button className={`${s.startCard} ${s.startLive}`} onClick={onLive} disabled={units.units != null && !units.live}>
          <span className={s.startArch} aria-hidden="true" />
          <span className={s.startText}>
            <b>Use my own photos</b>
            <span>Capture three angles with YouCam&rsquo;s camera, or upload photos. A full passport uses 16 units; each try-on 1–2.</span>
            <small>{units.units == null ? "Checking live units…" : units.live ? `${units.units} units available` : "Live runs paused to save units for judging"}</small>
          </span>
        </button>
      </div>
    </div>
  );
}
