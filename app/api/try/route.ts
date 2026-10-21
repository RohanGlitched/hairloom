import { NextResponse, type NextRequest } from "next/server";
import { KINDS, isKind, readOptions, validate } from "@/lib/kinds";
import { readPhoto, type Photo } from "@/lib/image";
import { YouCamError, createTask, deleteTask, pollTask, unitsLeft, upload } from "@/lib/youcam";
import {
  dailyAllows, endOf, held, hold, laneOf, markEnd, pollAllowed, readHandle, refundDay, reserve, signHandle, today, track, untrack, visitorAllowed, type Handle,
} from "@/lib/guard";

export const runtime = "nodejs";
export const maxDuration = 60;

// Units kept back so the account never runs dry during judging. The judge lane may go lower.
const FLOOR = Number(process.env.UNIT_FLOOR ?? 120);
const JUDGE_FLOOR = Number(process.env.JUDGE_UNIT_FLOOR ?? 20);
const JUDGE_PER_HOUR = 150;
// Skin analysis also returns a resized source image; only the concern maps are passed on.
const SKIN_TYPES = new Set(["moisture", "redness", "texture", "radiance"]);

const visitor = (req: NextRequest) => (req.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
const fail = (code: string, message: string, status = 400) => NextResponse.json({ ok: false, code, message }, { status });
const ended = () => fail("ended", "This task has finished. Start the step again if you need it.", 410);
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
  // navigator.sendBeacon can only POST: `?h=…&_method=DELETE` is the delete sent as a tab closes.
  if (req.nextUrl.searchParams.get("_method") === "DELETE") return DELETE(req);
  let body: { kind?: unknown; images?: unknown; opt?: unknown };
  try { body = await req.json(); } catch { return fail("bad_request", "The request could not be read."); }
  if (!isKind(body.kind)) return fail("bad_kind", "Unknown step.");
  const name = body.kind;
  const kind = KINDS[name];
  const images = Array.isArray(body.images) ? body.images : [];
  // The bytes are checked before any unit is reserved: a real JPEG or PNG, a photo's size and dimensions.
  const photos = images.map((s) => readPhoto(s, kind.jpegOnly));
  if (photos.length !== kind.images || photos.some((p) => typeof p === "string")) {
    const why = photos.find((p) => typeof p === "string");
    return fail("bad_images", `This step needs ${kind.images} ${kind.jpegOnly ? "JPEG" : "JPEG or PNG"} photo${kind.images > 1 ? "s" : ""} under 2 MB each${why ? ` (${why})` : ""}.`);
  }
  const opt = readOptions(body.opt);
  if (!opt) return fail("bad_option", "Options must be a small object of text and numbers.");
  // Options are checked before anything is uploaded, so a bad request never leaves a photo at YouCam.
  const bad = validate(name, opt);
  if (bad) return fail("bad_option", bad);
  const lane = laneOf(req.headers.get("x-judge-code"));
  if (!lane) return fail("bad_judge_code", "That judge code isn't right. Check it, or clear it to use the public allowance.", 403);

  // Reserve synchronously, before any await, so parallel requests can't all pass the same check.
  const release = lane === "judge" ? reserve(`judge:${visitor(req)}`, kind.units, JUDGE_PER_HOUR) : reserve(visitor(req), kind.units);
  if (!release) return fail("visitor_limit", "You've used this hour's share of live units. The demo people stay free to explore, or come back in an hour.", 429);
  const unhold = hold(kind.units);
  let started = false;
  let charged = false;
  try {
    const left = await unitsLeft();
    if (left - held() < (lane === "judge" ? JUDGE_FLOOR : FLOOR)) return fail("resting", "The live studio is resting to save units for judging. Everything still works with the demo people.", 503);
    const day = await dailyAllows(kind.units, lane);
    charged = day.charged;
    if (!day.ok) return fail("resting", "Today's live allowance is used up. Everything still works with the demo people, and live runs return at 05:30 IST.", 503);

    const files: string[] = [];
    for (const [i, p] of (photos as Photo[]).entries()) {
      files.push(await upload(p.bytes, `hairloom-${i}.${p.type === "image/png" ? "png" : "jpg"}`, p.type));
    }
    if (kind.ref) {
      const ref = await catalogue(kind.ref(opt), req);
      if (!ref) return fail("bad_option", "That catalogue item couldn't be loaded.");
      files.push(await upload(ref, "reference.jpg"));
    }
    const taskId = await createTask(kind.path, kind.body({ files, opt }));
    started = true;
    track(taskId, release);
    return NextResponse.json({ ok: true, handle: signHandle(name, taskId, lane), units: kind.units, api: kind.api });
  } catch (e) {
    const err = toErr(e);
    return fail(err.code, err.message, err.status);
  } finally {
    unhold();
    if (!started) {
      release();
      if (charged) await refundDay(kind.units, lane, today());
    }
  }
}

/** Catalogue photos, fetched once per instance from a fixed origin rather than the request's Host. */
const refs = new Map<string, { at: number; bytes: Uint8Array }>();
async function catalogue(path: string, req: NextRequest): Promise<Uint8Array | null> {
  const hit = refs.get(path);
  if (hit && Date.now() - hit.at < 3_600_000) return hit.bytes;
  const prod = process.env.VERCEL_ENV === "production" && process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const origin = process.env.SITE_URL ?? (prod ? `https://${prod}` : req.nextUrl.origin);
  const r = await fetch(new URL(path, origin)).catch(() => null);
  if (!r?.ok) return null;
  const bytes = new Uint8Array(await r.arrayBuffer());
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  refs.set(path, { at: Date.now(), bytes });
  return bytes;
}

/** YouCam failed the task and charged nothing, so the day's units and the visitor's share come back. */
async function refund(h: Handle) {
  untrack(h.taskId)?.();
  if (isKind(h.kind)) await refundDay(KINDS[h.kind].units, h.lane, h.day);
}

/** Polls a task by its signed handle. The task is NOT deleted here: the client confirms receipt with DELETE. */
export async function GET(req: NextRequest) {
  const handle = req.nextUrl.searchParams.get("h") ?? "";
  const h = readHandle(handle);
  if (!h || !isKind(h.kind)) return fail("bad_handle", "This task link isn't valid. Start the step again.", 403);
  if (!pollAllowed(handle) || !visitorAllowed(visitor(req))) return NextResponse.json({ ok: true, status: "running" });
  // An ended task is answered here, without calling YouCam.
  if (await endOf(h.taskId)) return ended();
  const kind = KINDS[h.kind];
  try {
    const st = await pollTask(kind.path, h.taskId);
    if (st.status === "running") return NextResponse.json({ ok: true, status: "running" });
    if (st.status === "error") {
      if (await markEnd(h.taskId, "gone")) await refund(h);
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
    await markEnd(h.taskId, "done");
    untrack(h.taskId);
    return NextResponse.json({ ok: true, status: "success", results, image });
  } catch (e) {
    const err = toErr(e);
    // The task no longer exists at YouCam: stop forwarding polls for it.
    if (err.code === "InvalidTaskId" || err.message.includes("InvalidTaskId")) await markEnd(h.taskId, "gone");
    return fail(err.code, err.message, err.status);
  }
}

/** The client confirms it has the result, or gives up; the task, its photos and outputs are deleted at YouCam. */
export async function DELETE(req: NextRequest) {
  const handle = req.nextUrl.searchParams.get("h") ?? "";
  const h = readHandle(handle);
  if (!h) return fail("bad_handle", "This task link isn't valid.", 403);
  if (!pollAllowed(`del:${handle}`, 5000) || !visitorAllowed(visitor(req))) return fail("busy", "This task is already being deleted.", 429);
  if ((await endOf(h.taskId)) === "gone") return ended();
  const ok = await deleteTask(h.taskId);
  if (ok) await markEnd(h.taskId, "gone");
  return NextResponse.json({ ok });
}
