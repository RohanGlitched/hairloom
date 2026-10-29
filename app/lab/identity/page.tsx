"use client";

// Build helper: how far the face moves between each headwear render (image to image) and its source
// photo, from MediaPipe face-detector keypoints, in the browser. Run scripts/measure-identity.cjs.
import { useEffect, useState } from "react";
import { PERSONAS } from "@/lib/demo";

export default function Identity() {
  const [out, setOut] = useState("");
  useEffect(() => {
    (async () => {
      const { faceKeypoints } = await import("@/lib/faceCrop");
      const pairs: { key: string; kind: string; src: string; out: string }[] = [];
      for (const p of PERSONAS) {
        for (const [h, src] of Object.entries(p.headwear)) pairs.push({ key: `${p.id}/head_${h}`, kind: "headwear", src: p.week4, out: src });
        pairs.push({ key: `${p.id}/week4`, kind: "after hair loss (demo photo)", src: p.kept, out: p.week4 });
      }
      const rows = [];
      for (const pr of pairs) {
        const [a, b] = await Promise.all([faceKeypoints(pr.src).catch(() => null), faceKeypoints(pr.out).catch(() => null)]);
        if (!a || !b) { rows.push({ ...pr, ok: false }); continue; }
        // Positions as a share of the image, so different output sizes compare; distances in eye spans.
        const n = (q: { x: number; y: number }, s: { w: number; h: number }) => ({ x: q.x / s.w, y: q.y / s.h });
        const eye = Math.hypot(n(a.points[0], a).x - n(a.points[1], a).x, n(a.points[0], a).y - n(a.points[1], a).y);
        const four = [0, 1, 2, 3].map((i) => Math.hypot(n(a.points[i], a).x - n(b.points[i], b).x, n(a.points[i], a).y - n(b.points[i], b).y) / eye);
        const shift = four.reduce((s, x) => s + x, 0) / four.length;
        const widthRatio = (b.box.w / b.w) / (a.box.w / a.w);
        rows.push({ ...pr, ok: true, shift: Math.round(shift * 1000) / 1000, widthRatio: Math.round(widthRatio * 1000) / 1000 });
      }
      setOut(JSON.stringify({ measured: new Date().toISOString(), method: "MediaPipe face detector (BlazeFace short range) keypoints: both eyes, nose tip, mouth centre. shift = mean keypoint move between source and output, in source eye-spans, with positions as a share of image size. widthRatio = face-box width share, output over source.", rows }, null, 1));
    })();
  }, []);
  return <pre id="out" data-done={out ? "1" : "0"} style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>{out || "measuring…"}</pre>;
}
