import { NextResponse, type NextRequest } from "next/server";
import { unitsLeft } from "@/lib/youcam";
import { dayCap, dayLeft, floorOf, laneOf } from "@/lib/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Live unit balance and today's remaining allowance for the studio's meter. Never exposes anything but numbers.
export async function GET(req: NextRequest) {
  const lane = laneOf(req.headers.get("x-judge-code"));
  try {
    const [units, left, floor] = await Promise.all([unitsLeft(), lane ? dayLeft(lane) : Promise.resolve(0), floorOf(lane ?? "public")]);
    return NextResponse.json({
      ok: true, units, floor, lane: lane ?? "bad_code", dayLeft: left, dayCap: lane ? dayCap(lane) : 0, resets: "05:30 IST",
      live: !!lane && units > floor && left !== 0,
    });
  } catch {
    return NextResponse.json({ ok: false, units: null, live: false });
  }
}
