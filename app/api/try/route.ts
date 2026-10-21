import { NextResponse, type NextRequest } from "next/server";
import { KINDS, isKind, validate } from "@/lib/kinds";
import { YouCamError, createTask, deleteTask, pollTask, unitsLeft, upload } from "@/lib/youcam";
import { dailyAllows, held, hold, pollAllowed, readHandle, reserve, signHandle } from "@/lib/guard";

export const runtime = "nodejs";
export const maxDuration = 60;

// Units kept back so the account never runs dry during judging.
const FLOOR = Number(process.env.UNIT_FLOOR ?? 120);
// Skin analysis also returns a resized source image; only the concern maps are passed on.
const SKIN_TYPES = new Set(["moisture", "redness", "texture", "radiance"]);

const visitor = (req: NextRequest) => (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
const fail = (code: string, message: string, status = 400) => NextResponse.json({ ok: false, code, message }, { status });
const toErr = (e: unknown) => (e instanceof YouCamError ? e : new YouCamError("unknown", "Something went wrong talking to YouCam."));

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

/** Starts a whitelisted task. Returns a signed handle; the raw YouCam task id never leaves the server. */
export async function POST(req: NextRequest) {
  let body: { kind?: unknown; images?: unknown; opt?: unknown };
  try { body = await req.json(); } catch { return fail("bad_request", "The request could not be read."); }
  if (!isKind(body.kind)) return fail("bad_kind", "Unknown step.");
  const name = body.kind;
  const kind = KINDS[name];
  const images = Array.isArray(body.images) ? body.images : [];
  if (images.length !== kind.images || !images.every((s) => typeof s === "string" && /^data:image\/(jpeg|png);base64,/.test(s) && s.length < 2_800_000)) {
    return fail("bad_images", `This step needs ${kind.images} JPEG or PNG photo${kind.images > 1 ? "s" : ""} under 2 MB each.`);
  }
  const opt = (body.opt && typeof body.opt === "object" ? body.opt : {}) as Record<string, string | number>;
  // Options are checked before anything is uploaded, so a bad request never leaves a photo at YouCam.
  const bad = validate(name, opt);
  if (bad) return fail("bad_option", bad);

  // Reserve synchronously, before any await, so parallel requests can't all pass the same check.
  const release = reserve(visitor(req), kind.units);
  if (!release) return fail("visitor_limit", "You've used this hour's share of live units. The demo people stay free to explore, or come back in an hour.", 429);
  const unhold = hold(kind.units);
  let started = false;
  try {
    const left = await unitsLeft();
    if (left - held() < FLOOR) return fail("resting", "The live studio is resting to save units for judging. Everything still works with the demo people.", 503);
    const day = await dailyAllows(kind.units);
    if (!day.ok) return fail("resting", "Today's live allowance is used up. Everything still works with the demo people, and live runs return tomorrow.", 503);

    const files: string[] = [];
    for (const [i, b64] of (images as string[]).entries()) {
      files.push(await upload(Uint8Array.from(Buffer.from(b64.slice(b64.indexOf(",") + 1), "base64")), `hairloom-${i}.jpg`));
    }
    if (kind.ref) {
      const r = await fetch(new URL(kind.ref(opt), req.nextUrl.origin));
      if (!r.ok) return fail("bad_option", "That catalogue item couldn't be loaded.");
      files.push(await upload(new Uint8Array(await r.arrayBuffer()), "reference.jpg"));
    }
    const taskId = await createTask(kind.path, kind.body({ files, opt }));
    started = true;
    return NextResponse.json({ ok: true, handle: signHandle(name, taskId), units: kind.units, api: kind.api });
  } catch (e) {
    const err = toErr(e);
    return fail(err.code, err.message, err.status);
  } finally {
    unhold();
    if (!started) release();
  }
}

/** Polls a task by its signed handle. The task is NOT deleted here: the client confirms receipt with DELETE. */
export async function GET(req: NextRequest) {
  const handle = req.nextUrl.searchParams.get("h") ?? "";
  const h = readHandle(handle);
  if (!h || !isKind(h.kind)) return fail("bad_handle", "This task link isn't valid. Start the step again.", 403);
  if (!pollAllowed(handle)) return NextResponse.json({ ok: true, status: "running" });
  const kind = KINDS[h.kind];
  try {
    const st = await pollTask(kind.path, h.taskId);
    if (st.status === "running") return NextResponse.json({ ok: true, status: "running" });
    if (st.status === "error") {
      await deleteTask(h.taskId);
      return NextResponse.json({ ok: true, status: "error", code: st.error, message: FRIENDLY[st.error] ?? st.message ?? "YouCam couldn't process this photo." });
    }
    // Fetch result files now so the browser never depends on 2-hour signed URLs.
    // If any download fails, report "running" and try again on the next poll; nothing is lost.
    let image: string | undefined;
    const results: Record<string, unknown> = { ...st.results };
    if (typeof results.url === "string") {
      const r = await fetch(results.url).catch(() => null);
      if (!r?.ok) return NextResponse.json({ ok: true, status: "running" });
      image = `data:${r.headers.get("content-type") ?? "image/jpeg"};base64,${Buffer.from(await r.arrayBuffer()).toString("base64")}`;
    }
    delete results.url;
    if (Array.isArray(results.output)) {
      const rows = (results.output as { type?: string; raw_score?: number; ui_score?: number; mask_urls?: string[] }[]).filter((o) => o.type && SKIN_TYPES.has(o.type));
      results.output = await Promise.all(rows.map(async (o) => {
        const u = o.mask_urls?.[0];
        const r = u ? await fetch(u).catch(() => null) : null;
        const mask = r?.ok ? `data:${r.headers.get("content-type") ?? "image/jpeg"};base64,${Buffer.from(await r.arrayBuffer()).toString("base64")}` : null;
        return { type: o.type, raw_score: o.raw_score, ui_score: o.ui_score, mask };
      }));
    }
    return NextResponse.json({ ok: true, status: "success", results, image });
  } catch (e) {
    const err = toErr(e);
    return fail(err.code, err.message, err.status);
  }
}

/** The client confirms it has the result; the task, its input photos and outputs are deleted at YouCam. */
export async function DELETE(req: NextRequest) {
  const h = readHandle(req.nextUrl.searchParams.get("h") ?? "");
  if (!h) return fail("bad_handle", "This task link isn't valid.", 403);
  const ok = await deleteTask(h.taskId);
  return NextResponse.json({ ok });
}
