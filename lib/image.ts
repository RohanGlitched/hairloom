// Checks an uploaded photo's bytes before any unit is reserved: real JPEG or PNG (the formats
// YouCam accepts), a plausible size, and pixel dimensions read from the file header.

export type Photo = { bytes: Uint8Array; type: "image/jpeg" | "image/png"; width: number; height: number };

export const MIN_BYTES = 8_000;
export const MAX_BYTES = 2_000_000;
export const MIN_SIDE = 256; // long side; prepare() sends up to 1024
export const MAX_SIDE = 2560; // YouCam's largest accepted long side

function jpegSize(b: Uint8Array): [number, number] | null {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const m = b[i + 1];
    if (m === 0xff) { i++; continue; }
    if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
    const len = (b[i + 2] << 8) | b[i + 3];
    if (len < 2) return null;
    // SOF0–SOF15, except DHT (C4), JPG (C8) and DAC (CC)
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return [(b[i + 7] << 8) | b[i + 8], (b[i + 5] << 8) | b[i + 6]];
    if (m === 0xda || m === 0xd9) return null;
    i += 2 + len;
  }
  return null;
}

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const u32 = (b: Uint8Array, i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;

/** Decodes a `data:image/...;base64,` URL and checks it. Returns the photo, or an error message. */
export function readPhoto(src: unknown, jpegOnly = false): Photo | string {
  if (typeof src !== "string") return "not a data URL";
  const m = /^data:image\/(jpeg|png);base64,([A-Za-z0-9+/]+={0,2})$/.exec(src);
  if (!m) return "not a base64 JPEG or PNG";
  if (m[2].length > Math.ceil(MAX_BYTES / 3) * 4) return "too large";
  const bytes = Uint8Array.from(Buffer.from(m[2], "base64"));
  if (bytes.length < MIN_BYTES) return "too small to be a photo";
  if (bytes.length > MAX_BYTES) return "too large";
  let type: Photo["type"], size: [number, number] | null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    type = "image/jpeg"; size = jpegSize(bytes);
  } else if (PNG.every((v, i) => bytes[i] === v) && u32(bytes, 12) === 0x49484452) {
    type = "image/png"; size = [u32(bytes, 16), u32(bytes, 20)];
  } else return "not a JPEG or PNG file";
  if (jpegOnly && type !== "image/jpeg") return "this step accepts JPEG only";
  if (!size || !size[0] || !size[1]) return "unreadable image header";
  const long = Math.max(...size);
  if (long < MIN_SIDE || long > MAX_SIDE) return `long side must be ${MIN_SIDE}–${MAX_SIDE} px`;
  return { bytes, type, width: size[0], height: size[1] };
}
