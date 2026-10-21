"use client";

// Skin analysis needs the face to fill most of the frame (YouCam: face width over 60% of the
// image). This finds the face on-device with MediaPipe and crops a close-up around it.
import type { FaceDetector } from "@mediapipe/tasks-vision";

let detector: Promise<FaceDetector> | null = null;

function load() {
  detector ??= (async () => {
    const { FilesetResolver, FaceDetector } = await import("@mediapipe/tasks-vision");
    const fileset = await FilesetResolver.forVisionTasks("/mp");
    return FaceDetector.createFromOptions(fileset, { baseOptions: { modelAssetPath: "/mp/blaze_face_short_range.tflite" }, runningMode: "IMAGE", minDetectionConfidence: 0.5 });
  })();
  return detector;
}

/** Returns a JPEG data URL cropped so the face is ~70% of the width, or null if no single face is found. */
export async function cropFace(src: string): Promise<string | null> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const det = await load();
  const found = det.detect(img).detections;
  if (found.length !== 1 || !found[0].boundingBox) return null;
  const b = found[0].boundingBox;
  const side = Math.min(b.width / 0.7, img.naturalWidth);
  const h = Math.min(side * 1.25, img.naturalHeight);
  const cx = b.originX + b.width / 2, cy = b.originY + b.height * 0.42;
  const x = Math.max(0, Math.min(img.naturalWidth - side, cx - side / 2));
  const y = Math.max(0, Math.min(img.naturalHeight - h, cy - h / 2));
  const scale = Math.max(1, 720 / side);
  const c = document.createElement("canvas");
  c.width = Math.round(side * Math.min(scale, 1024 / side)); c.height = Math.round(h * Math.min(scale, 1024 / side));
  c.getContext("2d")!.drawImage(img, x, y, side, h, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.92);
}

/**
 * Which way the face points in the picture, from BlazeFace keypoints (eyes, nose tip):
 * "right" when the nose sits right of the eyes' midpoint, "left" when left, else "front".
 */
export async function facing(src: string): Promise<"left" | "right" | "front" | null> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const det = await load();
  const f = det.detect(img).detections[0];
  const k = f?.keypoints;
  if (!k || k.length < 3) return null;
  const [eyeA, eyeB, nose] = k;
  const span = Math.abs(eyeA.x - eyeB.x) || 1e-3;
  const off = (nose.x - (eyeA.x + eyeB.x) / 2) / span;
  return off > 0.12 ? "right" : off < -0.12 ? "left" : "front";
}
