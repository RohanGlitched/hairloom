"use client";

import { useState } from "react";
import { HEADWEAR, WIGS } from "@/lib/catalogue";
import { greyBlend, nearestShades, labToHex } from "@/lib/color";
import { greyOf, measured } from "@/lib/colours";
import { prepare } from "@/lib/client";
import { seal, type SharePayload } from "@/lib/seal";
import type { Ctx } from "./Studio";
import { StepHead } from "./KeepStep";
import s from "./studio.module.css";

export function lookLabel(key: string) {
  if (key === "own") return { label: "Own hair", detail: "Their kept hair, placed on today's photo" };
  const [kind, a, b] = key.split(":");
  if (kind === "wig" || kind === "hair") { const w = WIGS.find((x) => x.id === a); return { label: w?.name ?? a, detail: w ? `${w.style} · ${w.cap} · ${w.fibre}` : "" }; }
  if (kind === "thin") return { label: a.startsWith("female_") ? "Fuller volume" : "Clip-in length", detail: "A preview for thinning hair; ask the fitter about a topper for the crown" };
  if (kind === "shade") { const w = WIGS.find((x) => x.id === a); return { label: `${w?.name ?? a} in shade ${b}`, detail: w ? `${w.style} · recoloured to shade ${b}` : "" }; }
  if (kind === "head") { const h = HEADWEAR.find((x) => x.id === a); return { label: h?.name ?? a, detail: h?.note ?? "" }; }
  if (kind === "brows") return { label: "Rebuilt brows", detail: "In the kept shape and shade" };
  return { label: key, detail: "" };
}

export function ShareStep({ ctx }: { ctx: Ctx }) {
  const { session, update } = ctx;
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [when, setWhen] = useState("");
  const [copied, setCopied] = useState(false);

  if (!session.kept || !session.readings) {
    return (
      <div className={s.step}>
        <StepHead n={4} title="Share with your fitter" lede="Make your hair passport and pick a few looks first." />
        <button className="btn btn-ivory" onClick={() => ctx.go("keep")}>Go to step 1</button>
      </div>
    );
  }

  const looks = session.shortlist.filter((k) => session.renders[k]);

  async function create() {
    setBusy(true); setErr(null); setLink(null);
    try {
      const pre = session.mode === "demo" && session.personaId ? measured(`${session.personaId}/kept`) : null;
      const g0 = pre && session.personaId ? greyOf(`${session.personaId}/kept`) : null;
      const m = pre ? { lab: pre, hex: labToHex(pre), grey: g0?.grey ?? null, base: g0?.base ?? null } : await import("@/lib/hairColor").then(({ measureHair }) => measureHair(session.kept!)).catch(() => null);
      const n = m ? nearestShades(m.lab, 1)[0] : null;
      const blend = m ? greyBlend(m.grey, m.base) : null;
      const payload: SharePayload = {
        v: 1,
        name: session.name === "You" ? "Client" : session.name,
        keptAt: session.keptAt ?? Date.now(),
        kept: await prepare(session.kept!, 420),
        readings: session.readings,
        colour: m && n ? { hex: m.hex, code: n.code, name: n.name, dE: Math.round(n.dE * 10) / 10, ...(m.grey != null ? { grey: Math.round(m.grey * 1000) / 1000 } : {}), ...(blend ? { blend: blend.code } : {}), ...(m.base ? { base: labToHex(m.base) } : {}) } : null,
        looks: await Promise.all(looks.map(async (k) => ({ key: k, ...lookLabel(k), src: await prepare(session.renders[k].src, 520) }))),
        note: session.note.slice(0, 1200),
        appointment: when || undefined,
        cap: session.cap ? { cm: session.cap.cm ?? null, parting: session.cap.parting ?? null } : undefined,
      };
      const { id, key } = await seal(payload);
      setLink(`${window.location.origin}/fitter#s=${id}.${key}`);
      ctx.update((x) => ({ ...x, sharedAt: Date.now() }));
    } catch (e) {
      setErr((e as Error).message || "The link couldn't be made.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={s.step}>
      <StepHead n={4} title="Share with your wig fitter" lede="One link carries your passport and shortlist. It's locked in this browser, and the key travels only inside the link, so our server can never read it." />

      <div className={s.shareGrid}>
        <div>
          <h2 className="h-sub">Your shortlist</h2>
          {looks.length ? (
            <ul className={s.shortlist}>
              {looks.map((k) => (
                <li key={k}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={session.renders[k].src} alt="" />
                  <b>{lookLabel(k).label}</b>
                  <button className="btn btn-ghost btn-sm" onClick={() => update((x) => ({ ...x, shortlist: x.shortlist.filter((y) => y !== k) }))}>Remove</button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="small">Nothing on your shortlist yet. Add looks in <button className={s.linkBtn} onClick={() => ctx.go("try")}>Try</button> or <button className={s.linkBtn} onClick={() => ctx.go("look")}>Brows &amp; headwear</button>.</p>
          )}
        </div>
        <div className={s.form}>
          <label>
            <span>Note for your fitter</span>
            <textarea rows={4} value={session.note} maxLength={1200} placeholder="For example: I'd like something low-maintenance for work. My scalp is sensitive." onChange={(e) => update((x) => ({ ...x, note: e.target.value }))} />
          </label>
          <label>
            <span>Appointment (optional)</span>
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </label>
          <button className="btn btn-ivory" disabled={busy} onClick={create}>{busy ? "Sealing the link…" : "Create fitter link"}</button>
          {session.mode === "demo" && !link && <p className="small"><a href={`/fitter#demo=${session.personaId ?? "anjali"}`}>Or see what a fitter sees, with {session.name}&rsquo;s demo brief</a></p>}
          {err && <p className={s.err} role="alert">{err}</p>}
          {link && (
            <div className={s.linkBox}>
              <p className={s.doneLine}><span aria-hidden="true">✓</span> Your fitter link is ready</p>
              <p className="small">Send it by message or email. Your fitter sees your passport, these looks on your face and a list of wigs to have ready. Anyone with the full link can open it, and it expires after 60 days.</p>
              <code>{link}</code>
              <div className={s.next}>
                <button className="btn btn-ivory btn-sm" onClick={async () => { await navigator.clipboard.writeText(link).catch(() => undefined); setCopied(true); }}>{copied ? "Copied" : "Copy link"}</button>
                <a className="btn btn-ghost btn-sm" href={link} target="_blank" rel="noreferrer">Open as your fitter</a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
