"use client";

import { useState } from "react";
import { Passport } from "@/components/Passport";
import type { Readings } from "@/lib/demo";
import { prepare } from "@/lib/client";
import { KINDS, type KindName } from "@/lib/kinds";
import { CameraKit } from "./CameraKit";
import type { Ctx } from "./Studio";
import s from "./studio.module.css";

type Job = { kind: KindName; label: string; state: "waiting" | "running" | "done" | "error"; note?: string; secs?: number };

const SLOTS = [
  { label: "Front", tip: "Face the camera, hair down over your shoulders." },
  { label: "Turned one way", tip: "Turn your head about 45° so your face points to the right of the photo." },
  { label: "Turned the other way", tip: "Now about 45° the other way, face pointing to the left of the photo." },
];

export function KeepStep({ ctx }: { ctx: Ctx }) {
  const { session, update } = ctx;
  const [photos, setPhotos] = useState<(string | null)[]>([session.kept ?? null, session.turns?.[0] ?? null, session.turns?.[1] ?? null]);
  const [camera, setCamera] = useState(false);
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (session.mode === "demo" && session.readings && session.kept) {
    return (
      <div className={s.step}>
        <StepHead n={1} title={`${session.name}'s hair passport`} lede="Read by YouCam from three photos taken before treatment. Colour is measured in your browser from the front photo." />
        <Passport p={{ name: session.name, kept: session.kept, turns: session.turns ?? [], readings: session.readings }} />
        <div className={s.next}><button className="btn btn-ivory" onClick={() => ctx.go("try")}>Next: try wigs on week 4</button></div>
      </div>
    );
  }

  const front = photos[0];
  const three = photos.every(Boolean);
  const cost = (three ? KINDS.hairType.units + KINDS.hairFrizz.units : 0) + KINDS.hairLength.units + KINDS.face.units;

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
    // The three-angle readings need three photos of identical size, in the order front, right, left.
    let trio: string[] = [];
    if (three) {
      const img = new Image(); img.src = front; await img.decode();
      const size: [number, number] = [img.naturalWidth, img.naturalHeight];
      trio = await Promise.all(photos.map((p) => prepare(p!, 1024, size)));
    }
    const plan: Job[] = [
      { kind: "hairLength", label: "Length", state: "waiting" },
      { kind: "face", label: "Face shape and brows", state: "waiting" },
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

    if (!readings.length && !readings.face) {
      setError("No reading came back. Check the messages above, adjust the photos and try again.");
      return;
    }
    update((x) => ({ ...x, kept: front, turns: three ? [photos[1]!, photos[2]!] : [], readings, keptAt: Date.now(), today: x.today ?? front }));
  }

  return (
    <div className={s.step}>
      <StepHead n={1} title="Keep your hair as it is today" lede="Three photos with your hair down: front, then turned each way. YouCam reads curl, frizz, length, face shape and brows. Your hair colour is measured here in the browser." />

      {session.readings && session.kept ? (
        <>
          <Passport p={{ name: "Your", kept: session.kept, turns: session.turns ?? [], readings: session.readings }} number="—" date={new Date(session.keptAt ?? Date.now()).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} />
          <div className={s.next}>
            <button className="btn btn-ivory" onClick={() => ctx.go("try")}>Next: try wigs</button>
            <button className="btn btn-ghost" onClick={() => update((x) => ({ ...x, readings: undefined }))}>Retake photos</button>
          </div>
        </>
      ) : (
        <>
          <div className={s.captureBar}>
            <button className="btn btn-ivory" onClick={() => setCamera(true)}>Use YouCam&rsquo;s guided camera</button>
            <span className="small">It checks your face angle and light, then takes all three shots for you.</span>
          </div>
          <div className={s.slots}>
            {SLOTS.map((slot, i) => (
              <label key={slot.label} className={s.slot}>
                <span className={s.slotImg}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {photos[i] ? <img src={photos[i]!} alt={`${slot.label} photo`} /> : <span className={s.slotEmpty}>{i === 0 ? "Required" : "For curl and frizz"}</span>}
                </span>
                <b>{slot.label}</b>
                <small>{slot.tip}</small>
                <input type="file" accept="image/*" onChange={(e) => pick(i, e.target.files?.[0])} className={s.file} />
                <span className="btn btn-ghost btn-sm">{photos[i] ? "Replace" : "Upload"}</span>
              </label>
            ))}
          </div>
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
            {!ctx.units.live && <span className="small">Live runs are paused. Try a demo person instead.</span>}
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
