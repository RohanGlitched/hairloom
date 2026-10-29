"use client";

import { useState } from "react";
import { get, set, type Session } from "@/lib/store";
import s from "./Consent.module.css";

/** The same terms the studio asks for before its first upload, for the other pages that upload a photo. */
export const TERMS = [
  "Your photos and kept-hair record are kept in this browser. There’s no account.",
  "For each reading or try-on, the photo it needs is sent through our server to YouCam (Perfect Corp) to be processed. As soon as your browser has the result, we ask YouCam to delete that task and its photo.",
  "Hairloom helps with appearance. It doesn’t diagnose anything; talk to your care team about treatment and hair loss.",
];

/** True once this browser agreed, in the studio (stored on the session) or on another page. */
export async function hasConsent(): Promise<boolean> {
  const [session, given] = await Promise.all([get<Session>("session"), get<number>("consent")]);
  return !!(session?.consent || given);
}

export function giveConsent() {
  const at = Date.now();
  void set("consent", at);
  void get<Session>("session").then((x) => { if (x?.mode === "live" && !x.consent) void set("session", { ...x, consent: at }); });
}

export function Consent({ agree, onAgree, onCancel, button }: { agree: string; onAgree: () => void; onCancel: () => void; button: string }) {
  const [ok, setOk] = useState(false);
  return (
    <div className={s.box} role="group" aria-label="Before you add a photo">
      <b>Before you add a photo</b>
      <ul>{TERMS.map((t) => <li key={t}>{t}</li>)}</ul>
      <label className={s.check}><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} /> {agree}</label>
      <div className={s.row}>
        <button className={`btn btn-sm ${button}`} disabled={!ok} onClick={() => { giveConsent(); onAgree(); }}>Continue and choose a photo</button>
        <button className="btn btn-sm" style={{ color: "inherit", borderColor: "currentColor", background: "transparent" }} onClick={onCancel}>Not now</button>
      </div>
    </div>
  );
}
