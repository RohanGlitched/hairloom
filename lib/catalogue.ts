// The fictional demo boutique's stock, headwear and wig colour codes. Shared by client and server.

export type Length = "ear" | "chin" | "shoulder" | "chest" | "midback";
export type Texture = "straight" | "wavy" | "curly" | "coily";

export type Wig = {
  id: string;
  name: string;
  style: string;
  length: Length;
  texture: Texture;
  code: string; // wig colour code, see SHADES
  cap: "Lace front" | "Monofilament top" | "Classic cap" | "Hand-tied";
  fibre: "Heat-friendly synthetic" | "Synthetic" | "Human hair";
  price: number; // INR
  care: "Low" | "Medium" | "High";
  fit: "Women" | "Men";
};

export const BOUTIQUE = {
  name: "Kesh & Co.",
  city: "Pune",
  note: "A fictional boutique made for this demo. Every wig photo was generated with the YouCam Image Generator.",
};

export const WIGS: Wig[] = [
  { id: "asha", name: "Asha", style: "Sleek lob, centre parting", length: "shoulder", texture: "straight", code: "2", cap: "Lace front", fibre: "Heat-friendly synthetic", price: 14900, care: "Low", fit: "Women" },
  { id: "meera", name: "Meera", style: "Long layers, soft side parting", length: "chest", texture: "straight", code: "1B", cap: "Monofilament top", fibre: "Human hair", price: 48500, care: "High", fit: "Women" },
  { id: "nora", name: "Nora", style: "Blunt chin-length bob", length: "chin", texture: "straight", code: "6", cap: "Classic cap", fibre: "Synthetic", price: 8900, care: "Low", fit: "Women" },
  { id: "ivy", name: "Ivy", style: "Textured pixie", length: "ear", texture: "straight", code: "30", cap: "Monofilament top", fibre: "Synthetic", price: 11200, care: "Low", fit: "Women" },
  { id: "zuri", name: "Zuri", style: "Defined shoulder curls", length: "shoulder", texture: "curly", code: "1B", cap: "Lace front", fibre: "Heat-friendly synthetic", price: 16400, care: "Medium", fit: "Women" },
  { id: "amara", name: "Amara", style: "Rounded coily afro", length: "chin", texture: "coily", code: "1", cap: "Classic cap", fibre: "Synthetic", price: 12800, care: "Medium", fit: "Women" },
  { id: "june", name: "June", style: "Loose shoulder waves", length: "chest", texture: "wavy", code: "38", cap: "Lace front", fibre: "Heat-friendly synthetic", price: 17900, care: "Medium", fit: "Women" },
  { id: "silver", name: "Silver", style: "Short layered crop", length: "ear", texture: "straight", code: "56", cap: "Monofilament top", fibre: "Synthetic", price: 13500, care: "Low", fit: "Women" },
  { id: "rosa", name: "Rosa", style: "Long auburn waves", length: "midback", texture: "wavy", code: "33", cap: "Hand-tied", fibre: "Human hair", price: 52000, care: "High", fit: "Women" },
  { id: "lena", name: "Lena", style: "Salt-and-pepper lob", length: "shoulder", texture: "straight", code: "44", cap: "Lace front", fibre: "Heat-friendly synthetic", price: 15600, care: "Low", fit: "Women" },
  { id: "tara", name: "Tara", style: "Long, deep side parting, darker root", length: "chest", texture: "straight", code: "4", cap: "Hand-tied", fibre: "Human hair", price: 44900, care: "High", fit: "Women" },
  { id: "kai", name: "Kai", style: "Classic short crop", length: "ear", texture: "straight", code: "4", cap: "Monofilament top", fibre: "Synthetic", price: 9800, care: "Low", fit: "Men" },
  { id: "dev", name: "Dev", style: "Textured short, salt and pepper", length: "ear", texture: "wavy", code: "44", cap: "Classic cap", fibre: "Synthetic", price: 9200, care: "Low", fit: "Men" },
  { id: "arjun", name: "Arjun", style: "Classic side parting, grey at the temples", length: "ear", texture: "straight", code: "1B", cap: "Lace front", fibre: "Human hair", price: 24500, care: "Medium", fit: "Men" },
  { id: "sam", name: "Sam", style: "Short natural curls", length: "ear", texture: "curly", code: "4", cap: "Classic cap", fibre: "Synthetic", price: 10400, care: "Low", fit: "Men" },
];

export const LENGTH_ORDER: Length[] = ["ear", "chin", "shoulder", "chest", "midback"];
export const LENGTH_LABEL: Record<Length, string> = { ear: "Above the ear", chin: "Chin", shoulder: "Shoulder", chest: "Chest", midback: "Mid-back" };
export const TEXTURE_ORDER: Texture[] = ["straight", "wavy", "curly", "coily"];

/** Loose industry convention (brands vary); hex values are our approximations of typical swatches. */
export const SHADES: { code: string; name: string; hex: string }[] = [
  { code: "1", name: "Jet black", hex: "#100e0d" },
  { code: "1B", name: "Off black", hex: "#1d1714" },
  { code: "2", name: "Darkest brown", hex: "#2b1e18" },
  { code: "4", name: "Dark brown", hex: "#3b2a20" },
  { code: "6", name: "Chestnut brown", hex: "#4f3525" },
  { code: "8", name: "Medium brown", hex: "#5e4331" },
  { code: "10", name: "Light chestnut", hex: "#71523a" },
  { code: "12", name: "Light golden brown", hex: "#8b6b4c" },
  { code: "14", name: "Dark blonde", hex: "#a08262" },
  { code: "16", name: "Neutral blonde", hex: "#b99d77" },
  { code: "24", name: "Warm blonde", hex: "#cfae7b" },
  { code: "613", name: "Golden platinum", hex: "#e4d3a6" },
  { code: "27", name: "Strawberry blonde", hex: "#b77b4d" },
  { code: "30", name: "Copper", hex: "#8e4b2b" },
  { code: "33", name: "Dark auburn", hex: "#6c2f23" },
  { code: "38", name: "Ash brown with grey", hex: "#7e7064" },
  { code: "44", name: "Salt and pepper", hex: "#8a8580" },
  { code: "51", name: "Light grey", hex: "#a9a7a3" },
  { code: "56", name: "Smoke grey", hex: "#c5c3bf" },
  { code: "60", name: "White", hex: "#e3e1db" },
];

export const shade = (code: string) => SHADES.find((s) => s.code === code) ?? SHADES[0];

export type Headwear = { id: string; name: string; note: string; prompt: string; men?: boolean };
export const HEADWEAR: Headwear[] = [
  { id: "turban", name: "Jersey turban", note: "Pre-tied, dusty rose. Soft on a sensitive scalp.", prompt: "a soft dusty rose jersey cotton turban head wrap that fully covers the head" },
  { id: "silk", name: "Silk headscarf", note: "Green and gold botanical print, tied at the nape.", prompt: "a printed silk headscarf with a green and gold botanical pattern, tied at the nape and fully covering the head" },
  { id: "beanie", men: true, name: "Wool beanie", note: "Oatmeal knit for cold days and errands.", prompt: "a soft oatmeal knitted wool beanie that fully covers the head, with no hair showing underneath" },
  { id: "cap", men: true, name: "Sleep cap", note: "Charcoal cotton, for nights and under a wig.", prompt: "a fitted charcoal cotton sleep cap that fully covers the head" },
];

export const inr = (n: number) => "₹" + n.toLocaleString("en-IN");
