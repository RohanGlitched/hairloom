import demo from "@/data/demo.json";

export type Readings = {
  type: { mapping: string; term: string } | null;
  frizz: { mapping: number; term: string } | null;
  length: { term: string } | null;
  face: {
    faceshape?: string;
    eyebrow?: Record<string, string>;
    color?: { eyebrow_color?: string; hair_color?: string; hair_color_name?: string };
  } | null;
};

export type Cap = { cm: number | null; parting: "left" | "centre" | "right" | "none" | null };
export type SkinCheck = { week: number; photo: string; scores: Record<string, number>; masks: Record<string, string> };

export type Persona = {
  id: string;
  name: string;
  age: number;
  city: string;
  blurb: string;
  situation: "chemo" | "alopecia";
  /** Label for the photo taken after hair loss ("Week 4", or "Month 3" for alopecia). */
  later: string;
  fit: "Women" | "Men";
  cap: Cap;
  brows: string | null;
  withHair: Record<string, string>;
  shades: Record<string, string>; // "wig:code" -> render
  /** Template id -> render; on `thinPhoto` when the person has one, else on the kept photo. */
  thinning: Record<string, string>;
  thinPhoto?: string | null;
  skin: SkinCheck[];
  kept: string;
  turns: (string | null)[];
  week4: string;
  own: string;
  readings: Readings;
  wigs: Record<string, string>;
  headwear: Record<string, string>;
};

export const PERSONAS = demo.personas as unknown as Persona[];
export const persona = (id: string) => PERSONAS.find((p) => p.id === id) ?? PERSONAS[0];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Human wording for the YouCam readings, with the raw value kept beside it. */
export function describe(r: Readings) {
  const brow = r.face?.eyebrow;
  return {
    // "Kinky" is YouCam's word for type 4 hair; say what it looks like instead.
    curl: r.type ? { label: r.type.term.replace(/kinky soft to coily/i, "Soft to tight coils").replace(/kinky/gi, "Tightly coiled"), raw: r.type.mapping } : null,
    frizz: r.frizz ? { label: r.frizz.term, raw: String(r.frizz.mapping) } : null,
    length: r.length ? { label: cap(r.length.term), raw: r.length.term } : null,
    face: r.face?.faceshape ? { label: r.face.faceshape, raw: r.face.faceshape } : null,
    brows: brow ? { label: `${brow.left_shape}, ${brow.left_body_thickness?.toLowerCase()}`, raw: `${brow.left_shape}/${brow.right_shape}` } : null,
    browHex: /^#[0-9a-fA-F]{6}$/.test(r.face?.color?.eyebrow_color ?? "") ? r.face!.color!.eyebrow_color! : null,
    apiHair: r.face?.color?.hair_color ? { hex: r.face.color.hair_color, name: r.face.color.hair_color_name ?? "" } : null,
  };
}

/** Maps the YouCam brow shape onto a makeup-vto eyebrow pattern for rebuilding brows. */
export function browPattern(shape?: string) {
  const s = (shape ?? "").toLowerCase();
  if (s.includes("straight")) return "Straight20";
  if (s.includes("angled") || s.includes("arch")) return "HighArch10";
  if (s.includes("round") || s.includes("curv")) return "Curved10";
  return "SoftArch20";
}
