"use client";

// On-device hair colour: MediaPipe's hair segmenter finds hair pixels, then we take a
// trimmed median in CIELAB. Runs entirely in the browser; the photo is never uploaded for this.
import type { ImageSegmenter } from "@mediapipe/tasks-vision";
import { type Lab, labToHex, rgbToLab } from "./color";

let segmenter: Promise<ImageSegmenter> | null = null;

function load() {
  segmenter ??= (async () => {
    quietMediaPipe();
    const { FilesetResolver, ImageSegmenter } = await import("@mediapipe/tasks-vision");
    const fileset = await FilesetResolver.forVisionTasks("/mp");
    return ImageSegmenter.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: "/mp/hair_segmenter.tflite" },
      runningMode: "IMAGE",
      outputCategoryMask: true,
      outputConfidenceMasks: false,
    });
  })();
  return segmenter;
}

// MediaPipe's wasm logs routine INFO lines through console.error; drop only those.
function quietMediaPipe() {
  const orig = console.error;
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === "string" && /^INFO: |XNNPACK|^W\d{4} /.test(args[0])) return;
    orig(...args);
  };
}

export type HairColour = { lab: Lab; hex: string; pixels: number; coverage: number };

async function toImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = src;
  await img.decode();
  return img;
}

/** Measures hair colour in an image (URL or data URL). Returns null when too little hair is visible. */
export async function measureHair(src: string): Promise<HairColour | null> {
  const [seg, img] = await Promise.all([load(), toImage(src)]);
  const scale = Math.min(1, 512 / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);
  const px = ctx.getImageData(0, 0, w, h).data;

  const result = seg.segment(canvas);
  const mask = result.categoryMask!.getAsUint8Array();
  const mw = result.categoryMask!.width, mh = result.categoryMask!.height;
  const labs: Lab[] = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const m = mask[Math.floor((y * mh) / h) * mw + Math.floor((x * mw) / w)];
      if (m === 0) continue; // 0 = background, >0 = hair
      const i = (y * w + x) * 4;
      labs.push(rgbToLab(px[i], px[i + 1], px[i + 2]));
    }
  }
  result.close();
  if (labs.length < 400) return null;

  // Trim the darkest 15% (shadow) and brightest 15% (shine) by lightness, then median each channel.
  labs.sort((a, b) => a[0] - b[0]);
  const core = labs.slice(Math.floor(labs.length * 0.15), Math.ceil(labs.length * 0.85));
  const med = (k: 0 | 1 | 2) => { const v = core.map((l) => l[k]).sort((a, b) => a - b); return v[Math.floor(v.length / 2)]; };
  const lab: Lab = [med(0), med(1), med(2)];
  return { lab, hex: labToHex(lab), pixels: labs.length, coverage: labs.length / (w * h) };
}
