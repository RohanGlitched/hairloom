"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import s from "./studio.module.css";

type Img = { phase: number; image: string | Blob; width: number; height: number };
type YMKGlobal = {
  init: (a: Record<string, unknown>) => void;
  openCameraKit: () => void;
  close: () => void;
  addEventListener: (e: string, cb: (x: unknown) => void) => unknown;
  removeEventListener: (id: unknown) => void;
};
declare global { interface Window { YMK?: YMKGlobal; YMKAsyncInit?: () => void } }

const SDK = "https://plugins-media.makeupar.com/v2.5-camera-kit/sdk.js";
let loading: Promise<YMKGlobal> | null = null;

function loadSdk(): Promise<YMKGlobal> {
  loading ??= new Promise((res, rej) => {
    if (window.YMK) return res(window.YMK);
    window.YMKAsyncInit = () => res(window.YMK!);
    const sc = document.createElement("script");
    sc.src = SDK;
    sc.async = true;
    const fail = () => { loading = null; rej(new Error("The YouCam camera could not load. Upload photos instead.")); };
    sc.onerror = fail;
    document.body.appendChild(sc);
    setTimeout(() => window.YMK && res(window.YMK), 4000);
    // The script loaded but never set up YMK: give up rather than wait forever.
    setTimeout(() => (window.YMK ? res(window.YMK) : fail()), 20_000);
  });
  return loading;
}

const toDataUrl = (x: string | Blob) =>
  typeof x === "string" ? Promise.resolve(x) : new Promise<string>((r) => { const f = new FileReader(); f.onload = () => r(String(f.result)); f.readAsDataURL(x); });

/**
 * YouCam's JS Camera Kit in a sheet. `mode` "hairtype" walks the person through
 * front, right-turn and left-turn shots and checks face quality before each capture.
 */
export function CameraKit({ mode, onDone, onCancel }: { mode: "hairtype" | "makeup" | "hairdensity"; onDone: (images: string[]) => void; onCancel: () => void }) {
  const [status, setStatus] = useState("Loading the YouCam camera…");
  const [quality, setQuality] = useState<Record<string, string | boolean> | null>(null);
  const ids = useRef<unknown[]>([]);
  // Callers pass an inline onDone; keeping it in a ref stops each re-render from re-opening the camera.
  const done = useRef(onDone);
  useEffect(() => { done.current = onDone; }, [onDone]);

  const close = useCallback(() => {
    try { window.YMK?.close(); } catch { /* already closed */ }
    ids.current.forEach((i) => window.YMK?.removeEventListener(i));
    ids.current = [];
  }, []);

  useEffect(() => {
    let live = true;
    loadSdk()
      .then((Y) => {
        if (!live) return;
        ids.current.push(
          Y.addEventListener("faceQualityChanged", (q) => setQuality(q as Record<string, string | boolean>)),
          Y.addEventListener("cameraFailed", (e) => setStatus(`The camera didn't open (${String(e)}). Allow camera access, or upload photos instead.`)),
          Y.addEventListener("loaded", () => setStatus(mode === "hairtype" ? "Face the camera. Then turn right, then left, when asked." : "Face the camera in good light.")),
          Y.addEventListener("faceDetectionCaptured", async (r) => {
            const imgs = ((r as { images: Img[] }).images ?? []).sort((a, b) => a.phase - b.phase);
            const urls = await Promise.all(imgs.map((i) => toDataUrl(i.image)));
            close();
            done.current(urls);
          }),
        );
        Y.init({ faceDetectionMode: mode, imageFormat: "base64", language: "enu", qualityLevel: "moderate", width: Math.min(480, window.innerWidth - 32), height: Math.min(640, window.innerHeight - 180) });
        Y.openCameraKit();
      })
      .catch((e: Error) => setStatus(e.message));
    return () => { live = false; close(); };
  }, [mode, close]);

  return (
    <div className={s.camSheet} role="dialog" aria-modal="true" aria-label="YouCam camera">
      <div className={s.camBox}>
        <div className={s.camHead}>
          <p>{status}</p>
          <button className="btn btn-ghost btn-sm" onClick={() => { close(); onCancel(); }}>Close camera</button>
        </div>
        <div id="YMK-module" className={s.camMount} />
        {quality && (
          <p className={s.camQ}>
            Face {quality.hasFace ? "found" : "not found"} · position {String(quality.position)} · facing {String(quality.frontal)} · light {String(quality.lighting)}
          </p>
        )}
      </div>
    </div>
  );
}
