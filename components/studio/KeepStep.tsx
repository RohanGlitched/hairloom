"use client";

import { useState } from "react";
import { Passport } from "@/components/Passport";
import type { Cap, Readings } from "@/lib/demo";
import { measured } from "@/lib/colours";
import { prepare } from "@/lib/client";
import { KINDS, type KindName } from "@/lib/kinds";
import { capSize } from "@/lib/match";
import { CameraKit } from "./CameraKit";
import type { Ctx } from "./Studio";
import s from "./studio.module.css";

type Job = { kind: KindName; label: string; state: "waiting" | "running" | "done" | "error"; note?: string; secs?: number };

const SLOTS = [
  { label: "Front", tip: "Face the camera, hair down over your shoulders." },
  { label: "Turned one way", tip: "Turn your head about 45°, like saying no." },
  { label: "Turned the other way", tip: "Now about 45° the other way." },
];

export function KeepStep({ ctx }: { ctx: Ctx }) {
  const { session, update } = ctx;
  const [photos, setPhotos] = useState<(string | null)[]>([session.kept ?? null, session.turns?.[0] ?? null, session.turns?.[1] ?? null]);
  const [camera, setCamera] = useState(false);
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [withFace, setWithFace] = useState(true);
  const [cap, setCap] = useState<Cap>(session.cap ?? { cm: null, parting: null });

  if (session.mode === "demo" && session.readings && session.kept) {
    const alopecia = session.situation === "alopecia";
    return (
      <div className={s.step}>
        <StepHead n={1} title={`${session.name}'s hair passport`} lede={alopecia ? "Read by YouCam from three photos taken while her hair still covered the patches." : "Read by YouCam from three photos taken before treatment, with the head measured at home."} />
        <Passport p={{ name: session.name, kept: session.kept, turns: session.turns ?? [], readings: session.readings, cap: session.cap, situation: session.situation }} lab={session.personaId ? measured(`${session.personaId}/kept`) : null} />
        <div className={s.next}><button className="btn btn-ivory" onClick={() => ctx.go("try")}>Next: try wigs</button></div>
      </div>
    );
  }

  const front = photos[0];
  const three = photos.every(Boolean);
  const cost = (three ? KINDS.hairType.units + KINDS.hairFrizz.units : 0) + KINDS.hairLength.units + (withFace ? KINDS.face.units : 0);

  async function pick(i: number, file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Choose a photo file (JPG or PNG).");
    const url = await prepare(file, 1024);
    setPhotos((p) => p.map((x, j) => (j === i ? url : x)));
    setError(null);
  }

  async function read() {
    if (!front) return;
    setError(null);
    let trio: string[] = [];
    if (three) {
      const img = new Image(); img.src = front; await img.decode();
      const size: [number, number] = [img.naturalWidth, img.naturalHeight];
      // YouCam expects [front, face pointing image-right, face pointing image-left]. Check which
      // side photo is which from face landmarks, so a swapped upload or camera order still reads.
      let [a, b] = [photos[1]!, photos[2]!];
      try {
        const { facing } = await import("@/lib/faceCrop");
        const [fa, fb] = await Promise.all([facing(a), facing(b)]);
        if (fa === "left" && fb === "right") [a, b] = [b, a];
      } catch { /* keep the order given */ }
      trio = await Promise.all([front, a, b].map((p) => prepare(p, 1024, size)));
    }
    const plan: Job[] = [
      { kind: "hairLength", label: "Length", state: "waiting" },
      ...(withFace ? [{ kind: "face", label: "Face shape and brows", state: "waiting" } as Job] : []),
      ...(three ? [{ kind: "hairType", label: "Curl pattern", state: "waiting" } as Job, { kind: "hairFrizz", label: "Frizz", state: "waiting" } as Job] : []),
    ];
    setJobs(plan);
    const readings: Readings = { type: null, frizz: null, length: null, face: null };
    const setJob = (k: KindName, j: Partial<Job>) => setJobs((js) => js?.map((x) => (x.kind === k ? { ...x, ...j } : x)) ?? null);

    await Promise.all(plan.map(async (job) => {
      setJob(job.kind, { state: "running" });
      const imgs = job.kind === "hairType" || job.kind === "hairFrizz" ? trio : [front];
      const r = await ctx.live(job.kind, imgs, {}, undefined, (secs) => setJob(job.kind, { secs }));
      if (!r.ok) return setJob(job.kind, { state: "error", note: r.message });
      const res = r.results as Record<string, unknown>;
      if (job.kind === "hairLength") readings.length = res.hair_length as Readings["length"];
      if (job.kind === "hairType") readings.type = res.hair_type as Readings["type"];
      if (job.kind === "hairFrizz") readings.frizz = res.hair_frizziness as Readings["frizz"];
      if (job.kind === "face") readings.face = res as Readings["face"];
      setJob(job.kind, { state: "done" });
    }));

    if (!readings.length && !readings.face && !readings.type) {
      setError("No reading came back. Check the messages above, adjust the photos and try again.");
      return;
    }
    update((x) => ({ ...x, kept: front, turns: three ? [photos[1]!, photos[2]!] : [], readings, cap, keptAt: Date.now(), base: x.today ? x.base : "kept" }));
  }

  return (
    <div className={s.step}>
      <StepHead n={1} title="Keep your hair as it is today" lede="Three photos with your hair down: front, then turned each way. YouCam reads curl, frizz, length, face shape and brows; your hair colour is measured on this device." />

      {session.readings && session.kept ? (
        <>
          <Passport p={{ name: "Your", kept: session.kept, turns: session.turns ?? [], readings: session.readings, cap: session.cap }} date={new Date(session.keptAt ?? Date.now()).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} />
          <div className={s.next}>
            <button className="btn btn-ivory" onClick={() => ctx.go("try")}>Next: try wigs</button>
            <button className="btn btn-ghost" onClick={() => update((x) => ({ ...x, readings: undefined }))}>Retake photos</button>
          </div>
        </>
      ) : (
        <>
          <div className={s.captureBar}>
            <button className="btn btn-ivory" onClick={() => setCamera(true)}>Use YouCam&rsquo;s guided camera</button>
            <span className="small">It shows your face position and light as you shoot, and walks you through all three angles.</span>
          </div>
          <div className={s.slots}>
            {SLOTS.map((slot, i) => (
              <label key={slot.label} className={s.slot}>
                <span className={s.slotImg}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {photos[i] ? <img src={photos[i]!} alt={`${slot.label} photo`} /> : <span className={s.slotEmpty}>{i === 0 ? "Needed" : "For curl and frizz"}</span>}
                </span>
                <b>{slot.label}</b>
                <small>{slot.tip}</small>
                <input type="file" accept="image/*" onChange={(e) => pick(i, e.target.files?.[0])} className={s.file} />
                <span className="btn btn-ghost btn-sm">{photos[i] ? "Replace" : "Upload"}</span>
              </label>
            ))}
          </div>

          <fieldset className={s.capBox}>
            <legend>For your fitter (optional)</legend>
            <label>
              <span>Head size, cm</span>
              <input type="number" inputMode="decimal" min={45} max={65} step={0.5} value={cap.cm ?? ""} placeholder="e.g. 55.5"
                onChange={(e) => setCap((c) => ({ ...c, cm: e.target.value ? Math.min(65, Math.max(45, Number(e.target.value))) : null }))} />
              <small>Soft tape around your hairline at the front, just above your ears, and round the nape. {capSize(cap.cm) ? `That's an ${capSize(cap.cm)!.toLowerCase()} cap.` : ""}</small>
            </label>
            <label>
              <span>Parting</span>
              <select value={cap.parting ?? ""} onChange={(e) => setCap((c) => ({ ...c, parting: (e.target.value || null) as Cap["parting"] }))}>
                <option value="">Choose</option><option value="left">Left</option><option value="centre">Centre</option><option value="right">Right</option><option value="none">No parting</option>
              </select>
            </label>
          </fieldset>

          <label className={s.check}>
            <input type="checkbox" checked={withFace} onChange={(e) => setWithFace(e.target.checked)} /> Also read face shape and brows (10 units; needed to rebuild your brows later)
          </label>

          {jobs && (
            <ul className={s.jobs}>
              {jobs.map((j) => (
                <li key={j.kind} data-state={j.state}>
                  <span>{j.label}</span>
                  <span className="small">{KINDS[j.kind].api}</span>
                  <span className="num">{j.state === "running" ? `${j.secs ?? 0} s…` : j.state === "done" ? "Read" : j.state === "error" ? "Not read" : "Waiting"}</span>
                  {j.note && <em>{j.note}</em>}
                </li>
              ))}
            </ul>
          )}
          {error && <p className={s.err} role="alert">{error}</p>}
          <div className={s.next}>
            <button className="btn btn-ivory" disabled={!front || !ctx.units.live || jobs?.some((j) => j.state === "running")} onClick={read}>
              Read my hair · {cost} units
            </button>
            {!front && <span className="small">Add at least the front photo.</span>}
            {front && !three && <span className="small">With only a front photo, curl and frizz are skipped.</span>}
            {!ctx.units.live && <span className="small">The live studio is resting. Try a demo person instead.</span>}
          </div>
        </>
      )}
      {camera && <CameraKit mode="hairtype" onCancel={() => setCamera(false)} onDone={async (imgs) => { setCamera(false); const ready = await Promise.all(imgs.slice(0, 3).map((u) => prepare(u, 1024))); setPhotos([ready[0] ?? null, ready[1] ?? null, ready[2] ?? null]); }} />}
    </div>
  );
}

export function StepHead({ n, title, lede }: { n: number; title: string; lede: string }) {
  return (
    <header className={s.stepHead}>
      <p className="kicker">Step {n}</p>
      <h1 className="h-sec">{title}</h1>
      <p className="lede">{lede}</p>
    </header>
  );
}
