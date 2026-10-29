import { NextResponse, after, type NextRequest } from "next/server";
import { KINDS, batchOf, bodyIn, isKind, readOptions, validate, type KindName } from "@/lib/kinds";
import { readPhoto, type Photo } from "@/lib/image";
import { YouCamError, createTask, unitsLeft, upload, type Call } from "@/lib/youcam";
import {
  dailyAllows, endOf, floorOf, handleSecret, held, hold, laneOf, markEnd, pollAllowed, readHandle, refundDay, reserve, signHandle, today, track, untrack, visitorAllowed,
} from "@/lib/guard";
import { addPending, finish, look, maybeSweep, partsOf, settle, touch } from "./tasks";

export const runtime = "nodejs";
export const maxDuration = 60;

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
  InvalidTaskId: "This task is no longer at YouCam. Start the step again.",
  ended: "This reading has already finished. Start the step again if you need it.",
};
const friendly = (st: { error: string; message?: string }) => FRIENDLY[st.error] ?? st.message ?? "YouCam couldn't process this photo.";
const paused = (lane: string) => lane === "judge"
  ? fail("resting", "Live runs are paused: the judges' allowance for today is used up. The demo people still work, and live runs return at 05:30 IST.", 503)
  : fail("resting", "Live runs are paused for today to protect the shared allowance. If you're judging, enter your judge code on the studio's start screen. The demo people still work.", 503);

/** Runs after the response (on Vercel, waitUntil). Outside a request, as in tests, the sweep settles instead. */
const later = (task: () => Promise<unknown>) => { try { after(() => task().catch(() => undefined)); } catch { /* no request scope */ } };

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
  try { handleSecret(); } catch (e) { return fail("not_configured", (e as Error).message, 503); }
  // The named kind, plus any readings that share its upload (`opt.also`, checked against a whitelist by validate).
  const batch = batchOf(name, opt) as KindName[];
  const units = batch.reduce((n, k) => n + KINDS[k].units, 0);

  // Reserve synchronously, before any await, so parallel requests can't all pass the same check.
  // One reservation per task, so a failed part can be given back on its own.
  const releases: (() => void)[] = [];
  for (const k of batch) {
    const r = lane === "judge" ? reserve(`judge:${visitor(req)}`, KINDS[k].units, JUDGE_PER_HOUR) : reserve(visitor(req), KINDS[k].units);
    if (!r) { releases.forEach((f) => f()); return fail("visitor_limit", "You've used this hour's share of live units. The demo people stay free to explore, or come back in an hour.", 429); }
    releases.push(r);
  }
  const t0 = Date.now();
  const call: Call = { lane, wait: 8000 };
  const unhold = hold(units);
  const ids: string[] = [];
  let charged = false;
  const day = today();
  try {
    const [left, floor] = await Promise.all([unitsLeft(call), floorOf(lane)]);
    if (left - held() < floor) return paused(lane);
    const d = await dailyAllows(units, lane, day);
    charged = d.charged;
    if (!d.ok) return paused(lane);

    // A catalogue wig's photo is read first (cached per instance), so a missing one fails before anything
    // reaches YouCam. It is still uploaded for every try-on: task/delete removes a task's input files (a
    // deleted task's source photo is refused with a 403), so a file_id cached across try-ons would break
    // once the first one is cleaned up. ref_file_url is documented, but only paired with src_file_url.
    const ref = kind.ref ? await catalogue(kind.ref(opt), req) : null;
    if (kind.ref && !ref) return fail("bad_option", "That catalogue item couldn't be loaded.");
    // Each photo is uploaded once, however many readings use it, and all uploads run side by side.
    const files = await Promise.all([
      ...(photos as Photo[]).map((p, i) => upload(p.bytes, `hairloom-${i}.${p.type === "image/png" ? "png" : "jpg"}`, p.type, call)),
      ...(ref ? [upload(ref, "reference.jpg", "image/jpeg", call)] : []),
    ]);
    for (const k of batch) {
      try {
        ids.push(await createTask(KINDS[k].path, bodyIn(name, k, files, opt), call));
      } catch (e) {
        if (!ids.length) throw e;
        break; // the parts already started still run; the rest are given back below
      }
    }
    const ran = batch.slice(0, ids.length);
    ids.forEach((id, i) => track(id, releases[i]));
    const h = { kind: ran.join("+"), taskId: ids.join("~"), lane, day };
    await addPending(h);
    later(() => settle(h, t0 + 55_000));
    later(() => maybeSweep());
    return NextResponse.json({ ok: true, handle: signHandle(h.kind, h.taskId, lane, day), units: ran.reduce((n, k) => n + KINDS[k].units, 0), api: kind.api });
  } catch (e) {
    const err = toErr(e);
    return fail(err.code, err.message, err.status);
  } finally {
    unhold();
    // Parts that never started at YouCam give their units back.
    const unrun = batch.slice(ids.length);
    releases.slice(ids.length).forEach((f) => f());
    if (charged && unrun.length) await refundDay(unrun.reduce((n, k) => n + KINDS[k].units, 0), lane, day);
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

/** Polls a task by its signed handle. The task is NOT deleted here: the client confirms receipt with DELETE. */
export async function GET(req: NextRequest) {
  const handle = req.nextUrl.searchParams.get("h") ?? "";
  const h = readHandle(handle);
  const parts = h && partsOf(h);
  if (!h || !parts) return fail("bad_handle", "This task link isn't valid. Start the step again.", 403);
  later(() => maybeSweep());
  const running = () => NextResponse.json({ ok: true, status: "running" });
  if (!pollAllowed(handle) || !visitorAllowed(visitor(req))) return running();
  touch(h.taskId);
  // An ended task is answered here, without calling YouCam.
  if ((await Promise.all(parts.map((p) => endOf(p.id)))).every(Boolean)) return ended();
  try {
    // Over the rate limit, a poll is answered "running" rather than queued.
    const seen = await look(h, parts, { wait: 0 });
    if (!seen) return running();
    const ok = seen.filter((x) => x.st.status === "success");
    if (!ok.length) {
      await finish(h, parts);
      const errs = seen.map((x) => x.st as { error: string; message?: string });
      return NextResponse.json({ ok: true, status: "error", code: errs[0].error, message: [...new Set(errs.map(friendly))].join(" ") });
    }
    // Fetch result files now so the browser never depends on 2-hour signed URLs.
    // If any download fails, report "running" and try again on the next poll; nothing is lost.
    const out: Record<string, { results: Record<string, unknown>; image?: string } | { error: string; message: string }> = {};
    for (const { part, st } of seen) {
      if (st.status === "error") out[part.kind] = { error: st.error, message: friendly(st) };
      if (st.status !== "success") continue;
      const got = await collect(st.results);
      if (!got) return running();
      out[part.kind] = got;
    }
    await Promise.all(ok.map((x) => markEnd(x.part.id, "done")));
    ok.forEach((x) => untrack(x.part.id));
    if (parts.length === 1) return NextResponse.json({ ok: true, status: "success", ...out[parts[0].kind] });
    // A batch: each reading's results, or its error, by kind. Units are the parts YouCam charged for.
    const each = Object.fromEntries(Object.entries(out).map(([k, v]) => [k, "results" in v ? v.results : v]));
    return NextResponse.json({ ok: true, status: "success", results: { parts: each }, units: ok.reduce((n, x) => n + KINDS[x.part.kind].units, 0) });
  } catch (e) {
    const err = toErr(e);
    if (err.code === "rate_limited") return running();
    return fail(err.code, err.message, err.status);
  }
}

/** A task's results with the result image and skin maps downloaded; null if a download failed. */
async function collect(raw: Record<string, unknown>): Promise<{ results: Record<string, unknown>; image?: string } | null> {
  let image: string | undefined;
  const results: Record<string, unknown> = { ...raw };
  if (typeof results.url === "string") {
    const r = await fetch(results.url).catch(() => null);
    if (!r?.ok) return null;
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
  return { results, image };
}

/** The client confirms it has the result, or gives up; the task, its photos and outputs are deleted at YouCam. */
export async function DELETE(req: NextRequest) {
  const handle = req.nextUrl.searchParams.get("h") ?? "";
  const h = readHandle(handle);
  const parts = h && partsOf(h);
  if (!h || !parts) return fail("bad_handle", "This task link isn't valid.", 403);
  if (!pollAllowed(`del:${handle}`, 5000) || !visitorAllowed(visitor(req))) return fail("busy", "This task is already being deleted.", 429);
  if ((await Promise.all(parts.map((p) => endOf(p.id)))).every((e) => e === "gone")) return ended();
  return NextResponse.json({ ok: await finish(h, parts) });
}
