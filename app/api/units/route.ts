import { NextResponse } from "next/server";
import { unitsLeft } from "@/lib/youcam";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Live unit balance for the studio's meter. Never exposes anything but the number.
export async function GET() {
  try {
    const units = await unitsLeft();
    const floor = Number(process.env.UNIT_FLOOR ?? 120);
    return NextResponse.json({ ok: true, units, floor, live: units > floor });
  } catch {
    return NextResponse.json({ ok: false, units: null, live: false });
  }
}
