// The whitelist of YouCam tasks the studio can run. The client names a kind; the server
// builds the request body here, so no arbitrary feature or prompt can be sent through us.
import { HEADWEAR, WIGS } from "./catalogue";

export type KindName =
  | "hairType" | "hairFrizz" | "hairLength" | "face"
  | "wig" | "ownHair" | "hairColor" | "headwear" | "brows" | "skin" | "hairVol" | "hairExt";

type Opt = Record<string, string | number | undefined>;
type Ctx = { files: string[]; opt: Opt };

/** Option readers: a value of the wrong type is an error, never coerced. */
const str = (opt: Opt, k: string, fallback?: string): string => {
  const v = opt[k] ?? fallback;
  if (typeof v !== "string") throw new Error(`bad ${k}`);
  return v;
};
const num = (opt: Opt, k: string, fallback: number): number => {
  const v = opt[k] ?? fallback;
  if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`bad ${k}`);
  return v;
};

export type Kind = {
  path: string;
  images: number; // photos the client must send
  units: number; // charged by YouCam on success
  api: string; // product name for the UI
  jpegOnly?: boolean; // hair-transfer accepts JPG/JPEG only
  body: (c: Ctx) => unknown;
  /** A site image the server fetches and uploads itself, appended to `files` (e.g. a catalogue wig). */
  ref?: (opt: Ctx["opt"]) => string;
};

const SKIN = ["moisture", "redness", "texture", "radiance"];
/** YouCam's template ids for toppers and volumisers (hair-vol) and clip-in lengths (hair-ext). */
export const VOLUME = ["female_subtle", "female_natural", "female_medium", "female_high"];
export const EXTENSION = ["all_length_1", "all_length_2_", "all_length_3"];

export const KINDS: Record<KindName, Kind> = {
  hairType: { path: "/s2s/v2.0/task/hair-type-detection", images: 3, units: 2, api: "AI Hair Type Detection", body: ({ files }) => ({ src_file_ids: files }) },
  hairFrizz: { path: "/s2s/v2.0/task/hair-frizziness-detection", images: 3, units: 2, api: "AI Hair Frizziness Detection", body: ({ files }) => ({ src_file_ids: files }) },
  hairLength: { path: "/s2s/v2.0/task/hair-length-detection", images: 1, units: 2, api: "AI Hair Length Detection", body: ({ files }) => ({ src_file_id: files[0] }) },
  face: {
    path: "/s2s/v2.0/task/face-attr-analysis", images: 1, units: 10, api: "AI Face Attribute & Ratio Analyzer",
    // "flexible": everyday photos are rarely perfectly frontal; at the default ("high") five of five
    // real portraits we tested were rejected. The result's face_quality still flags a turned face.
    body: ({ files }) => ({ src_file_id: files[0], features: ["faceShape", "eyebrowShape", "eyebrowThickness", "eyebrowColor", "hairColor"], face_angle_strictness_level: "flexible" }),
  },
  wig: {
    path: "/s2s/v2.1/task/hair-transfer", images: 1, units: 2, api: "AI Hairstyle Virtual Try-On", jpegOnly: true,
    ref: (opt) => {
      const w = WIGS.find((x) => x.id === str(opt, "wig"));
      if (!w) throw new Error("unknown wig");
      return `/catalogue/${w.id}.jpg`;
    },
    body: ({ files }) => ({ src_file_id: files[0], ref_file_id: files[1], hair_color: "ref" }),
  },
  ownHair: {
    path: "/s2s/v2.1/task/hair-transfer", images: 2, units: 2, api: "AI Hairstyle Virtual Try-On", jpegOnly: true,
    body: ({ files }) => ({ src_file_id: files[0], ref_file_id: files[1], hair_color: "ref" }),
  },
  hairColor: {
    path: "/s2s/v2.0/task/hair-color", images: 1, units: 1, api: "AI Hair Color Virtual Try-On",
    body: ({ files, opt }) => {
      const hex = typeof opt.hex === "string" ? opt.hex : "";
      if (!/^#[0-9a-fA-F]{6}$/.test(hex)) throw new Error("bad colour");
      return { src_file_id: files[0], pattern: { name: "full" }, palettes: [{ color: hex, color_intensity: 70, shine_intensity: 40 }] };
    },
  },
  headwear: {
    path: "/s2s/v2.0/task/image-to-image/youcam", images: 1, units: 1, api: "AI Image Generator (image to image)",
    body: ({ files, opt }) => {
      const h = HEADWEAR.find((x) => x.id === str(opt, "headwear"));
      if (!h) throw new Error("unknown headwear");
      return {
        model: "youcam-image-v2", src_file_ids: [files[0]],
        prompt: `The exact same person, same face, same expression, same clothes, same background and lighting, now wearing ${h.prompt}. Keep their identity identical.`,
      };
    },
  },
  brows: {
    path: "/s2s/v2.0/task/makeup-vto", images: 1, units: 1, api: "AI Makeup Virtual Try-On",
    body: ({ files, opt }) => {
      let hex: string, name: string, raw: number;
      try { hex = str(opt, "hex", "#3a2a22"); name = str(opt, "pattern", "SoftArch20"); raw = num(opt, "thickness", 20); } catch { throw new Error("bad brow"); }
      if (!/^#[0-9a-fA-F]{6}$/.test(hex) || !/^[A-Za-z]+\d+$/.test(name)) throw new Error("bad brow");
      const thickness = Math.round(Math.max(-100, Math.min(100, raw)));
      return {
        src_file_id: files[0],
        effects: [{ category: "eyebrows", pattern: { type: "shape", name, curvature: 0, thickness, definition: 60 }, palettes: [{ color: hex, colorIntensity: 70, texture: "matte" }] }],
      };
    },
  },
  hairVol: {
    path: "/s2s/v2.0/task/hair-vol", images: 1, units: 2, api: "AI Hair Volume Virtual Try-On",
    body: ({ files, opt }) => {
      const t = opt.template;
      if (typeof t !== "string" || !VOLUME.includes(t)) throw new Error("unknown volume");
      return { src_file_id: files[0], template_id: t };
    },
  },
  hairExt: {
    path: "/s2s/v2.0/task/hair-ext", images: 1, units: 1, api: "AI Hair Extension Virtual Try-On",
    body: ({ files, opt }) => {
      const t = opt.template;
      if (typeof t !== "string" || !EXTENSION.includes(t)) throw new Error("unknown extension");
      return { src_file_id: files[0], template_id: t };
    },
  },
  skin: {
    path: "/s2s/v2.1/task/skin-analysis", images: 1, units: 9, api: "AI Skin Analysis",
    body: ({ files }) => ({ src_file_id: files[0], dst_actions: SKIN, format: "json", miniserver_args: { enable_mask_overlay: true } }),
  },
};

export const isKind = (k: unknown): k is KindName => typeof k === "string" && Object.hasOwn(KINDS, k);

/** The request's `opt`: a plain object of short strings and finite numbers, or null. Nothing is coerced. */
export function readOptions(raw: unknown): Record<string, string | number> | null {
  if (raw === undefined) return {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw) || Object.getPrototypeOf(raw) !== Object.prototype) return null;
  const out: Record<string, string | number> = {};
  const entries = Object.entries(raw);
  if (entries.length > 8) return null;
  for (const [k, v] of entries) {
    if (!/^[a-z]{1,16}$/i.test(k)) return null;
    if (typeof v === "string" ? v.length > 64 : !(typeof v === "number" && Number.isFinite(v))) return null;
    out[k] = v;
  }
  return out;
}

/** Checks a kind's options without uploading anything. Returns an error message, or null when valid. */
export function validate(name: KindName, opt: Opt): string | null {
  const kind = KINDS[name];
  try {
    kind.ref?.(opt);
    kind.body({ files: Array.from({ length: kind.images + (kind.ref ? 1 : 0) }, (_, i) => `check-${i}`), opt });
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}
