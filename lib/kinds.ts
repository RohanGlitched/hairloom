// The whitelist of YouCam tasks the studio can run. The client names a kind; the server
// builds the request body here, so no arbitrary feature or prompt can be sent through us.
import { HEADWEAR, WIGS } from "./catalogue";

export type KindName =
  | "hairType" | "hairFrizz" | "hairLength" | "face"
  | "wig" | "ownHair" | "hairColor" | "headwear" | "brows" | "skin" | "hairVol" | "hairExt";

type Ctx = { files: string[]; opt: Record<string, string | number | undefined> };

export type Kind = {
  path: string;
  images: number; // photos the client must send
  units: number; // charged by YouCam on success
  api: string; // product name for the UI
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
    body: ({ files }) => ({ src_file_id: files[0], features: ["faceShape", "eyebrowShape", "eyebrowThickness", "eyebrowColor", "hairColor"] }),
  },
  wig: {
    path: "/s2s/v2.1/task/hair-transfer", images: 1, units: 2, api: "AI Hairstyle Virtual Try-On",
    ref: (opt) => {
      const w = WIGS.find((x) => x.id === opt.wig);
      if (!w) throw new Error("unknown wig");
      return `/catalogue/${w.id}.jpg`;
    },
    body: ({ files }) => ({ src_file_id: files[0], ref_file_id: files[1], hair_color: "ref" }),
  },
  ownHair: {
    path: "/s2s/v2.1/task/hair-transfer", images: 2, units: 2, api: "AI Hairstyle Virtual Try-On",
    body: ({ files }) => ({ src_file_id: files[0], ref_file_id: files[1], hair_color: "ref" }),
  },
  hairColor: {
    path: "/s2s/v2.0/task/hair-color", images: 1, units: 1, api: "AI Hair Color Virtual Try-On",
    body: ({ files, opt }) => {
      const hex = String(opt.hex ?? "");
      if (!/^#[0-9a-fA-F]{6}$/.test(hex)) throw new Error("bad colour");
      return { src_file_id: files[0], pattern: { name: "full" }, palettes: [{ color: hex, color_intensity: 70, shine_intensity: 40 }] };
    },
  },
  headwear: {
    path: "/s2s/v2.0/task/image-to-image/youcam", images: 1, units: 1, api: "AI Image Generator (image to image)",
    body: ({ files, opt }) => {
      const h = HEADWEAR.find((x) => x.id === opt.headwear);
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
      const hex = String(opt.hex ?? "#3a2a22");
      const name = String(opt.pattern ?? "SoftArch20");
      if (!/^#[0-9a-fA-F]{6}$/.test(hex) || !/^[A-Za-z]+\d+$/.test(name)) throw new Error("bad brow");
      const raw = Number(opt.thickness ?? 20);
      if (!Number.isFinite(raw)) throw new Error("bad brow");
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
      if (!VOLUME.includes(String(opt.template))) throw new Error("unknown volume");
      return { src_file_id: files[0], template_id: String(opt.template) };
    },
  },
  hairExt: {
    path: "/s2s/v2.0/task/hair-ext", images: 1, units: 1, api: "AI Hair Extension Virtual Try-On",
    body: ({ files, opt }) => {
      if (!EXTENSION.includes(String(opt.template))) throw new Error("unknown extension");
      return { src_file_id: files[0], template_id: String(opt.template) };
    },
  },
  skin: {
    path: "/s2s/v2.1/task/skin-analysis", images: 1, units: 9, api: "AI Skin Analysis",
    body: ({ files }) => ({ src_file_id: files[0], dst_actions: SKIN, format: "json", miniserver_args: { enable_mask_overlay: true } }),
  },
};

export const isKind = (k: unknown): k is KindName => typeof k === "string" && Object.hasOwn(KINDS, k);

/** Checks a kind's options without uploading anything. Returns an error message, or null when valid. */
export function validate(name: KindName, opt: Record<string, string | number | undefined>): string | null {
  const kind = KINDS[name];
  try {
    kind.ref?.(opt);
    kind.body({ files: Array.from({ length: kind.images + (kind.ref ? 1 : 0) }, (_, i) => `check-${i}`), opt });
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}
