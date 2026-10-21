import { NextResponse, type NextRequest } from "next/server";
import { KINDS, isKind } from "@/lib/kinds";
import { YouCamError, createTask, deleteTask, pollTask, spent, unitsLeft, upload } from "@/lib/youcam";

export const runtime = "nodejs";
export const maxDuration = 60;

// Units kept back so the account never runs dry during judging.
const FLOOR = Number(process.env.UNIT_FLOOR ?? 120);
// Per visitor (IP) budget, per rolling hour. In-memory per server instance: a courtesy limit, not security.
const PER_HOUR = Number(process.env.UNITS_PER_VISITOR_HOUR ?? 60);
const ledger = new Map<string, { at: number; units: number }[]>();

function visitor(req: NextRequest) {
  return (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
}

function usedThisHour(ip: string) {
  const now = Date.now();
  const rows = (ledger.get(ip) ?? []).filter((r) => now - r.at < 3_600_000);
  ledger.set(ip, rows);
  return rows.reduce((s, r) => s + r.units, 0);
}

const fail = (code: string, message: string, status = 400) => NextResponse.json({ ok: false, code, message }, { status });

const FRIENDLY: Record<string, string> = {
  error_face_angle_invalid: "Your head angle is outside what this step accepts. Face the camera for the front photo and turn clearly to each side for the others.",
  error_mismatch_image_size: "The three photos must be the same size. Retake them in one session.",
  error_no_face: "We couldn't find a face. Use a well-lit photo that shows your whole face.",
  error_multiple_people: "Only one person should be in the photo.",
  error_large_face_angle: "Face the camera straight on and try again.",
  error_hair_too_short: "This step needs a photo that shows some hair. Use a photo from your hair record instead.",
  error_no_shoulder: "Step back a little so your shoulders are in the photo.",
  error_lighting_dark: "The photo is too dark. Face a window or a lamp.",
  error_src_face_too_small: "Move closer: your face should fill most of the frame.",
  error_nsfw_content_detected: "This photo can't be processed. Try a different one.",
};

export async function POST(req: NextRequest) {
  let body: { kind?: unknown; images?: unknown; opt?: unknown };
  try {
    body = await req.json();
  } catch {
    return fail("bad_request", "The request could not be read.");
  }
  if (!isKind(body.kind)) return fail("bad_kind", "Unknown step.");
  const kind = KINDS[body.kind];
  const images = Array.isArray(body.images) ? body.images : [];
  if (images.length !== kind.images || !images.every((s) => typeof s === "string" && s.length < 2_800_000)) {
    return fail("bad_images", `This step needs ${kind.images} photo${kind.images > 1 ? "s" : ""} under 2 MB each.`);
  }
  const opt = (body.opt && typeof body.opt === "object" ? body.opt : {}) as Record<string, string | number>;

  const ip = visitor(req);
  if (usedThisHour(ip) + kind.units > PER_HOUR) {
    return fail("visitor_limit", "You've used this hour's share of live units. The demo people stay free to explore, or come back in an hour.", 429);
  }
  try {
    const left = await unitsLeft();
    if (left - kind.units < FLOOR) {
      return fail("resting", "The live studio is resting to save units for judging. Everything still works with the demo people.", 503);
    }
    const files: string[] = [];
    for (const [i, b64] of (images as string[]).entries()) {
      const bytes = Uint8Array.from(Buffer.from(b64.replace(/^data:image\/\w+;base64,/, ""), "base64"));
      files.push(await upload(bytes, `hairloom-${i}.jpg`));
    }
    let reqBody: unknown;
    try {
      if (kind.ref) {
        const r = await fetch(new URL(kind.ref(opt), req.nextUrl.origin));
        if (!r.ok) return fail("bad_option", "That catalogue item couldn't be loaded.");
        files.push(await upload(new Uint8Array(await r.arrayBuffer()), "reference.jpg"));
      }
      reqBody = kind.body({ files, opt });
    } catch (e) {
      return fail("bad_option", (e as Error).message);
    }
    const taskId = await createTask(kind.path, reqBody);
    ledger.get(ip)?.push({ at: Date.now(), units: kind.units }) ?? ledger.set(ip, [{ at: Date.now(), units: kind.units }]);
    spent(kind.units);
    return NextResponse.json({ ok: true, taskId, units: kind.units, api: kind.api });
  } catch (e) {
    const err = e instanceof YouCamError ? e : new YouCamError("unknown", "Something went wrong talking to YouCam.");
    return fail(err.code, err.message, err.status);
  }
}

export async function GET(req: NextRequest) {
  const k = req.nextUrl.searchParams.get("kind");
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!isKind(k) || !/^[\w+/=-]{10,200}$/.test(id)) return fail("bad_request", "Unknown task.");
  const kind = KINDS[k];
  try {
    const st = await pollTask(kind.path, id);
    if (st.status === "running") return NextResponse.json({ ok: true, status: "running" });
    if (st.status === "error") {
      await deleteTask(id);
      return NextResponse.json({ ok: true, status: "error", code: st.error, message: FRIENDLY[st.error] ?? st.message ?? "YouCam couldn't process this photo." });
    }
    // Download any result image here so the browser never depends on a 2-hour signed URL,
    // then delete the task (and its input photos) at YouCam.
    let image: string | undefined;
    const url = typeof st.results.url === "string" ? st.results.url : undefined;
    if (url) {
      const r = await fetch(url);
      if (r.ok) image = `data:${r.headers.get("content-type") ?? "image/jpeg"};base64,${Buffer.from(await r.arrayBuffer()).toString("base64")}`;
    }
    const results = { ...st.results };
    delete results.url;
    // Skin analysis returns one mask per concern; fetch them now, before the task is deleted.
    if (Array.isArray(results.output)) {
      results.output = await Promise.all(
        (results.output as { mask_urls?: string[] }[]).map(async (o) => {
          const u = o.mask_urls?.[0];
          if (!u) return { ...o, mask_urls: [] };
          const r = await fetch(u).catch(() => null);
          const mask = r?.ok ? `data:image/png;base64,${Buffer.from(await r.arrayBuffer()).toString("base64")}` : null;
          return { ...o, mask_urls: [], mask };
        }),
      );
    }
    await deleteTask(id);
    return NextResponse.json({ ok: true, status: "success", results, image });
  } catch (e) {
    const err = e instanceof YouCamError ? e : new YouCamError("unknown", "Something went wrong talking to YouCam.");
    return fail(err.code, err.message, err.status);
  }
}
