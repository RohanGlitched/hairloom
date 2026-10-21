// Synthetic image bytes for the validators: real headers, no real photo.

/** A JPEG header (SOI, a padding comment, SOF0 with the given size, SOS, EOI) of at least `size` bytes. */
export function jpeg(w: number, h: number, size = 12_000): Uint8Array {
  const pad = Math.max(0, Math.min(65_000, size - 40));
  const head = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00];
  const com = [0xff, 0xfe, ((pad + 2) >> 8) & 0xff, (pad + 2) & 0xff, ...new Array(pad).fill(0x20)];
  const sof = [0xff, 0xc0, 0x00, 0x11, 0x08, h >> 8, h & 0xff, w >> 8, w & 0xff, 0x03, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1];
  return Uint8Array.from([...head, ...com, ...sof, 0xff, 0xda, 0x00, 0x02, 0xff, 0xd9]);
}

export function png(w: number, h: number, size = 12_000): Uint8Array {
  const b = new Uint8Array(size);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, w);
  new DataView(b.buffer).setUint32(20, h);
  return b;
}

export const dataUrl = (bytes: Uint8Array, type = "image/jpeg") => `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;
