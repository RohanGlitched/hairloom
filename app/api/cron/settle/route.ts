import { NextResponse, type NextRequest } from "next/server";
import { createHash, timingSafeEqual } from "node:crypto";
import { sweep } from "../../try/tasks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const digest = (s: string) => createHash("sha256").update(s).digest();

/** Vercel Cron (Authorization: Bearer $CRON_SECRET): settles tasks nobody came back for. */
export async function GET(req: NextRequest) {
  const want = process.env.CRON_SECRET;
  const got = req.headers.get("authorization") ?? "";
  if (!want || !timingSafeEqual(digest(got), digest(`Bearer ${want}`))) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    return NextResponse.json({ ok: true, ...(await sweep()) });
  } catch (e) {
    return NextResponse.json({ ok: false, message: (e as Error).message }, { status: 500 });
  }
}
