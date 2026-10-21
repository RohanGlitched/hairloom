"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LENGTH_LABEL, WIGS, inr } from "@/lib/catalogue";
import { deltaE00, matchWord, nearestShades, type Lab } from "@/lib/color";
import { measured, renderLab, wigShade } from "@/lib/colours";
import { prepare } from "@/lib/client";
import { VOLUME, EXTENSION } from "@/lib/kinds";
import { band, closeness, lengthFromTerm, lengthStep, orLonger, textureFromType, textureStep } from "@/lib/match";
import { Reveal } from "@/components/Reveal";
import type { Ctx } from "./Studio";
import { StepHead } from "./KeepStep";
import s from "./studio.module.css";

type Fit = "All" | "Women" | "Men";

export function TryStep({ ctx }: { ctx: Ctx }) {
  const { session, update } = ctx;
  const base = session.base === "today" && session.today ? "today" : "kept";
  const prefix = base === "kept" ? "hair" : "wig";
  const basePhoto = base === "kept" ? session.kept : session.today;
  const baseLabel = base === "kept" ? "With hair" : session.later ?? "Today";
  const [sel, setSel] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [secs, setSecs] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [fit, setFit] = useState<Fit>(session.fit ?? "All");
  const [keptLab, setKeptLab] = useState<Lab | null>(null);
  const [nowLab, setNowLab] = useState<Lab | null>(null);


  const keptLen = lengthFromTerm(session.readings?.length?.term);
  const keptMore = orLonger(session.readings?.length?.term);
  const keptTex = textureFromType(session.readings?.type?.mapping);
  const render = sel ? session.renders[sel] : undefined;
  const wigId = sel && /^(wig|hair|shade):/.test(sel) ? sel.split(":")[1] : null;
  const wig = wigId ? WIGS.find((w) => w.id === wigId) ?? null : null;
  const pid = session.mode === "demo" ? session.personaId ?? null : null;

  // Colour: demo people use measurements taken at build time (no model download); live sessions measure here.
  useEffect(() => {
    if (!session.kept) return;
    if (pid) return setKeptLab(measured(`${pid}/kept`));
    import("@/lib/hairColor").then(({ measureHair }) => measureHair(session.kept!)).then((r) => setKeptLab(r?.lab ?? null)).catch(() => undefined);
  }, [session.kept, pid]);
  useEffect(() => {
    setNowLab(null);
    if (!render || !sel || sel.startsWith("thin:")) return;
    const pre = pid ? renderLab(pid, sel) : null;
    if (pre) return setNowLab(pre);
    import("@/lib/hairColor").then(({ measureHair }) => measureHair(render.src)).then((r) => setNowLab(r?.lab ?? null)).catch(() => undefined);
  }, [render, sel, pid]);

  const shaded = (id: string) => !!pid && Object.keys(session.renders).some((k) => k.startsWith(`shade:${id}:`));
  const ranked = useMemo(
    // Demo people show only prepared looks: nothing on a demo screen spends units.
    () => WIGS.filter((w) => (fit === "All" || w.fit === fit) && (!pid || !!session.renders[`${prefix}:${w.id}`]))
      .map((w) => {
        const lab = pid ? renderLab(pid, `${prefix}:${w.id}`) ?? renderLab(pid, `wig:${w.id}`) : null;
        const dE = keptLab && lab ? deltaE00(keptLab, lab) : null;
        return { w, score: closeness(w, { length: keptLen, texture: keptTex, orLonger: keptMore }, dE) };
      })
      // The wig a shop sent the shopper here with comes first; then, for demo people, the wig with
      // prepared shades and other prepared looks, so nothing on the first screen needs a live run.
      .sort((a, b) => Number(b.w.id === ctx.wig) - Number(a.w.id === ctx.wig) || Number(shaded(b.w.id)) - Number(shaded(a.w.id)) || (pid ? Number(!!session.renders[`${prefix}:${b.w.id}`]) - Number(!!session.renders[`${prefix}:${a.w.id}`]) : 0) || b.score - a.score),
    [fit, pid, prefix, keptLab, keptLen, keptTex, keptMore, session.renders, ctx.wig],
  );

  // Open on her own hair back (demo, after hair loss), else the closest prepared look. Follow the
  // ranking while it settles (colour is measured after the first render) until someone picks.
  const best = ranked.find(({ w }) => session.renders[`${prefix}:${w.id}`]);
  const bestScore = Math.max(...ranked.map((r) => r.score));
  const opening = pid && base === "today" && session.renders.own && !ctx.wig ? "own" : best ? `${prefix}:${best.w.id}` : null;
  const picked = useRef(false);
  useEffect(() => { picked.current = false; }, [base]);
  useEffect(() => {
    if (!picked.current) setSel(opening);
  }, [opening]);

  async function tryOn(key: string, kind: "wig" | "ownHair" | "hairColor" | "hairVol" | "hairExt", opt: Record<string, string | number>, images: string[]) {
    picked.current = true;
    if (window.innerWidth < 900) document.getElementById("try-mirror")?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (session.renders[key]) return setSel(key);
    if (session.mode === "demo" && !window.confirm("This one isn't prepared for the demo person, so it runs live on YouCam (about 15 seconds). Go ahead?")) return;
    setBusy(key); setMsg(null); setSecs(0);
    const r = await ctx.live(kind, images, opt, key, setSecs);
    setBusy(null);
    if (!r.ok) return setMsg(r.message);
    setSel(key);
  }

  async function newToday(file?: File) {
    if (!file) return;
    const url = await prepare(file, 1024);
    update((x) => ({ ...x, today: url, base: "today", later: "Today", renders: Object.fromEntries(Object.entries(x.renders).filter(([k]) => !k.startsWith("wig:") && k !== "own")) }));
  }

  if (!session.kept || !basePhoto) {
    return (
      <div className={s.step}>
        <StepHead n={2} title="Try wigs on your own face" lede="Make your hair passport first, so every try-on can be compared with the hair you kept." />
        <button className="btn btn-ivory" onClick={() => ctx.go("keep")}>Go to step 1</button>
      </div>
    );
  }

  const dE = keptLab && nowLab ? deltaE00(keptLab, nowLab) : null;
  const inList = sel ? session.shortlist.includes(sel) : false;
  const ready = (k: string) => !!session.renders[k];
  const hasBoth = !!session.today && (session.mode === "live" || Object.keys(session.renders).some((k) => k.startsWith("hair:")));
  const shadeSource = wig ? session.renders[`${prefix}:${wig.id}`] : undefined;
  // Thinning previews run on the photo of thinning hair: the kept photo for a live session.
  const thinPhoto = ctx.persona?.thinPhoto ?? session.kept;
  const thinSel = sel?.startsWith("thin:") ? sel.slice(5) : null;
  const thinOpts = [...VOLUME.map((t, i) => ({ t, kind: "hairVol" as const, label: ["Subtle", "Natural", "Medium", "High"][i] + " volume", units: 2 })),
    ...EXTENSION.map((t, i) => ({ t, kind: "hairExt" as const, label: ["Short", "Medium", "Long"][i] + " clip-ins", units: 1 }))]
    .filter((o) => (session.mode === "live" ? session.fit !== "Men" : ready(`thin:${o.t}`)));
  const mirrorBase = thinSel ? thinPhoto! : basePhoto;
  const mirrorLabel = thinSel ? (ctx.persona?.thinPhoto ? "Thinning" : "Kept") : baseLabel;
  const title = session.mode === "demo" ? `Wigs on ${session.name}` : "Try wigs on your own face";

  return (
    <div className={s.step}>
      <StepHead n={2} title={title} lede={session.mode === "demo" ? "Pick a wig to see it on the photo. Drag across the mirror to compare." : "Each wig is placed on your photo by YouCam's hairstyle try-on. Results stay in this browser."} />

      {hasBoth && (
        <div className={s.chips} role="radiogroup" aria-label="Which photo to try wigs on">
          <button role="radio" aria-checked={base === "kept"} onClick={() => update((x) => ({ ...x, base: "kept" }))}>Before hair loss</button>
          <button role="radio" aria-checked={base === "today"} onClick={() => update((x) => ({ ...x, base: "today" }))}>{session.later ?? "Today"}, after hair loss</button>
        </div>
      )}

      <div className={s.tryGrid3}>
        <div className={s.mirrorCol} id="try-mirror">
          {render ? (
            <Reveal before={mirrorBase} after={render.src} beforeAlt={mirrorLabel} afterAlt="Try-on result" beforeLabel={mirrorLabel} afterLabel={wig ? wig.name : sel === "own" ? "Own hair" : thinSel ? (thinSel.startsWith("female_") ? "Volume" : "Clip-ins") : "Try-on"} label="Compare the try-on with the photo underneath" initial={58} size="fill" />
          ) : (
            <div className={s.frame}><div className={s.glass}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={basePhoto} alt={baseLabel} />
            </div></div>
          )}
          {busy && <p className={s.busyLine}>YouCam is fitting it… {secs} s</p>}
          <p className="small">{render ? "Drag across the mirror to compare with the photo underneath." : "Pick a wig to see it on this photo."}</p>
          {session.mode === "live" && (
            <label className="btn btn-ghost btn-sm" style={{ position: "relative" }}>
              {session.today ? "Replace the after photo" : "Add a photo from after hair loss"}
              <input type="file" accept="image/*" className={s.file} onChange={(e) => newToday(e.target.files?.[0])} />
            </label>
          )}
        </div>

        <div className={s.railCol}>
          <div className={s.chips} role="radiogroup" aria-label="Show wigs">
            {(["All", "Women", "Men"] as const).map((f) => (
              <button key={f} role="radio" aria-checked={fit === f} onClick={() => setFit(f)}>{f === "All" ? "All wigs" : `${f}'s`}</button>
            ))}
          </div>
          <div className={s.rail} aria-label="Wigs, closest to the hair you kept first">
            {base === "today" && (
              <button className={s.tile} aria-pressed={sel === "own"} disabled={!!busy || (!ready("own") && !ctx.units.live)}
                onClick={() => tryOn("own", "ownHair", {}, [session.today!, session.kept!])}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={ready("own") ? session.renders.own.src : session.kept} alt="" />
                <span><b>Own hair</b><small>Your kept hair, back</small></span>
              </button>
            )}
            {ranked.map(({ w, score }) => {
              const key = `${prefix}:${w.id}`;
              const has = ready(key);
              return (
                <button key={w.id} className={s.tile} aria-pressed={sel === key} disabled={!!busy || (!has && !ctx.units.live)}
                  onClick={() => tryOn(key, "wig", { wig: w.id }, [basePhoto])}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={has ? session.renders[key].src : `/catalogue/thumb/${w.id}.jpg`} alt="" loading="lazy" />
                  <span><b>{w.name}</b><small>{busy === key ? "Fitting…" : w.id === ctx.wig && !has ? "From the shop" : has ? band(score, bestScore) : session.mode === "demo" ? "Try live" : "Try on · 2 units"}</small></span>
                </button>
              );
            })}
          </div>
        </div>

        <div className={s.detail}>
          {wig ? (
            <>
              <h2 className="h-sub">{wig.name}{sel?.startsWith("shade:") ? `, recoloured to ${sel.split(":")[2]}` : ""}</h2>
              <p className="small">{wig.style} · {wig.cap} · {wig.fibre} · <span className="num">{inr(wig.price)}</span></p>
              <ul className={s.vsList}>
                <li><span>Length</span>{lengthStep(keptLen, wig.length, keptMore)?.word ?? LENGTH_LABEL[wig.length]}</li>
                <li><span>Texture</span>{textureStep(keptTex, wig.texture)?.word ?? wig.texture}</li>
                <li><span>Colour</span>{dE != null ? matchWord(dE) : render ? "Measuring…" : "Try it on to compare"}</li>
                <li><span>Stock shade</span><i style={{ background: wigShade(wig).hex }} aria-hidden="true" />{wigShade(wig).code}, {wigShade(wig).name.toLowerCase()}</li>
              </ul>
              {pid && !shaded(wig.id) && <p className="small">Shades are prepared for {ranked.find(({ w }) => shaded(w.id))?.w.name ?? "one wig"} in this demo. With your own photo, any wig can be recoloured.</p>}
              {shadeSource && keptLab && (!pid || shaded(wig.id)) && (
                <div className={s.shades}>
                  <p className="small">Order it in a shade closer to your own hair:</p>
                  <div>
                    {nearestShades(keptLab, 3).filter((n) => !pid || ready(`shade:${wig.id}:${n.code}`)).map((n) => {
                      const key = `shade:${wig.id}:${n.code}`;
                      return (
                        <button key={key} className={s.shadeBtn} disabled={!!busy || (!ready(key) && !ctx.units.live)} aria-pressed={sel === key}
                          onClick={() => tryOn(key, "hairColor", { hex: n.hex }, [shadeSource.src])}>
                          <i style={{ background: n.hex }} aria-hidden="true" />{n.code}<small>{ready(key) ? "" : "1 unit"}</small>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {dE != null && (
                <details className={s.more}>
                  <summary>About this match</summary>
                  <p>Colour difference from the kept hair: ΔE00 {dE.toFixed(1)} (under 3 is hard to tell apart). Measured from the hair pixels in both photos. The ranking adds length and texture against the passport.</p>
                </details>
              )}
            </>
          ) : sel === "own" ? (
            <>
              <h2 className="h-sub">{session.mode === "demo" ? `${session.name}'s own hair` : "Your own hair"}</h2>
              <p className="small">YouCam&rsquo;s hairstyle try-on with your kept photo as the reference, placed on your {(session.later ?? "later").toLowerCase()} photo. Handy for showing a fitter exactly what you&rsquo;d like back.</p>
            </>
          ) : sel?.startsWith("thin:") ? (
            <>
              <h2 className="h-sub">{thinOpts.find((o) => o.t === thinSel)?.label ?? "Thinning preview"}</h2>
              {thinSel?.startsWith("female_") ? (
                <p className="small">YouCam&rsquo;s hair volume try-on fills out the lengths and sides. It doesn&rsquo;t cover a widening parting or a thin crown; that is what a topper does, so ask your fitter to show you one.</p>
              ) : (
                <p className="small">YouCam&rsquo;s hair extension try-on adds clip-in length. Length can draw the eye away from thinner hair on top, and clip-ins can be removed at night.</p>
              )}
            </>
          ) : (
            <p className="small">Pick a wig to see it on the photo.</p>
          )}
          {render && <p className={s.apiLine}>{render.api}{render.units ? ` · ${render.units} unit${render.units > 1 ? "s" : ""} · ${(render.ms / 1000).toFixed(0)} s` : ""}</p>}
          {msg && <p className={s.err} role="alert">{msg}</p>}
          <div className={s.next}>
            {render && (
              <button className="btn btn-ivory btn-sm" onClick={() => update((x) => ({ ...x, shortlist: inList ? x.shortlist.filter((k) => k !== sel) : [...x.shortlist, sel!].slice(-4) }))}>
                {inList ? "Remove from shortlist" : "Add to shortlist"}
              </button>
            )}
          </div>
          <p className={s.cant}>A try-on shows style and colour. It can&rsquo;t show cap fit, weight or how the lace looks close up, so try real wigs with your fitter before buying.</p>
        </div>
      </div>

      {(thinOpts.length > 0 || (session.mode === "live" && session.fit === "Men")) && (
        <div className={s.thin}>
          <h2 className="h-sub">Thinning, not lost?</h2>
          {thinOpts.length > 0 ? (
            <>
              <p className="small">{session.situation === "alopecia" ? `Volume and clip-ins on ${ctx.persona?.thinPhoto ? `${session.name}'s photo with patches` : "the kept photo"}. While patches are small, a fitter may suggest a topper rather than a wig.` : ctx.persona?.thinPhoto ? `Volume and clip-ins on ${session.name}'s photo of thinning hair.` : "Volume and clip-ins can be enough while hair is thinning. Previewed on the kept photo."}</p>
              <div className={s.chips}>
                {thinOpts.map((o) => {
                  const key = `thin:${o.t}`;
                  return (
                    <button key={key} aria-pressed={sel === key} disabled={!!busy || (!ready(key) && !ctx.units.live)} onClick={() => { document.getElementById("try-mirror")?.scrollIntoView({ behavior: "smooth", block: "center" }); void tryOn(key, o.kind, { template: o.t }, [thinPhoto!]); }}>
                      {o.label}{ready(key) ? "" : ` · ${o.units} unit${o.units > 1 ? "s" : ""}`}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="small">YouCam&rsquo;s volume and clip-in templates are all styled for women today, so we don&rsquo;t offer them on men&rsquo;s photos. A fitter can show you men&rsquo;s hair systems.</p>
          )}
        </div>
      )}

      <div className={s.next}>
        <span className="small">{session.shortlist.length} on your shortlist</span>
        <button className="btn btn-ivory" onClick={() => ctx.go("look")}>Next: brows and headwear</button>
      </div>
    </div>
  );
}
