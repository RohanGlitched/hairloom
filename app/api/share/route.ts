import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { store } from "@/lib/storage";

export const runtime = "nodejs";

// Stores a sealed (AES-GCM) fitter link. The server sees only ciphertext and never the key.
const MAX = 3_500_000;
const fail = (message: string, status = 400) => NextResponse.json({ ok: false, message }, { status });

export async function POST(req: NextRequest) {
  const text = await req.text();
  if (text.length > MAX) return fail("This share is too large. Keep the shortlist to four looks.", 413);
  let body: { v?: number; iv?: string; data?: string };
  try { body = JSON.parse(text); } catch { return fail("The share could not be read."); }
  if (body.v !== 1 || typeof body.iv !== "string" || typeof body.data !== "string" || !/^[\w-]+$/.test(body.iv + body.data)) return fail("The share is not sealed correctly.");
  const id = randomBytes(9).toString("base64url");
  try {
    await store().write(`shares/${id}.json`, JSON.stringify({ v: 1, iv: body.iv, data: body.data, at: Date.now() }));
  } catch {
    return fail("The link couldn't be saved. Try again in a moment.", 502);
  }
  return NextResponse.json({ ok: true, id });
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!/^[\w-]{8,20}$/.test(id)) return fail("That link isn't valid.");
  const text = await store().read(`shares/${id}.json`).catch(() => null);
  if (!text) return fail("This link has expired or never existed. Ask your client to send it again.", 404);
  return new NextResponse(text, { headers: { "content-type": "application/json", "cache-control": "private, no-store" } });
}
