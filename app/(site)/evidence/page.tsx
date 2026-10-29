import type { Metadata } from "next";
import { PERSONAS } from "@/lib/demo";
import { API_COUNT, LEDGER, REJECTED, TOTALS, byApi, missingEvidence } from "@/lib/evidence";
import { greyOf, measured, shadeCheck } from "@/lib/colours";
import { WIGS } from "@/lib/catalogue";
import { greyBlend, labToHex, nearestShades } from "@/lib/color";
import { RealTests } from "@/components/RealTests";
import real from "@/data/real.json";
import s from "./evidence.module.css";

export const metadata: Metadata = { title: "Evidence", description: "Every YouCam task we ran while building Hairloom, what failed, what we measured, and what we would ask Perfect Corp for." };

/** What we learned about the YouCam API: what happened, what Hairloom does about it, and the one thing we would ask for. */
const NOTES = [
  { t: "Hair type and frizz need three same-size photos, in one order", b: "Front, then the face turned towards the right of the picture, then towards the left. Any other order, or different sizes, returns error_face_angle_invalid or error_mismatch_image_size. The studio crops all three to the front photo's size and orders the side photos itself from face landmarks, so a swapped upload still reads.", ask: "Say which photo failed, or accept any order and size." },
  { t: "Hair colour comes back as a named category", b: "Face Attribute Analyzer and Facial Color Tones Analyzer return one of a few named swatches. That suits a beauty quiz, but a wig fitter needs a shade code, so Hairloom measures colour from the hair pixels and keeps YouCam's label beside it. Where they disagree is listed below.", ask: "Return a measured hair colour with a confidence, as eyebrow_color already is." },
  { t: "Hairstyle try-on works on a bald head", b: "The docs list error_hair_too_short, so we expected failures after hair loss. All 64 try-ons on bald demo photos succeeded, and so did all 8 on real photos of shaved heads. Those are smooth scalps in good light, not patchy loss, so patchy and stubbled heads are still untested.", ask: "Document that bald and shaved sources work." },
  { t: "Face reading is strict about angle by default", b: "At the default strictness, Face Attribute Analyzer rejected all five of our real, everyday portraits (error_face_not_forward_facing, error_face_angle_left_tilt, error_face_angle_downward). At face_angle_strictness_level “flexible” all five read, and face_quality still flags a turned face, which the passport passes on. Hair length has no such setting and failed on three slightly turned portraits, which is why the studio leads with YouCam's guided camera.", ask: "Name face_angle_strictness_level in the error, and give hair length the same setting." },
  { t: "Hairstyle try-on can change more than hair", b: "On one real photo of a man with a full beard, both wig try-ons removed the beard, and on a black-and-white portrait the try-ons came back in colour. Hairloom's mirror lets you drag back to the original to spot this, and a fitter should always see the real person.", ask: "A hair-only mode that leaves beard, skin tone and background alone." },
  { t: "Hat try-on restyles the whole person", b: "Hat and scarf try-on generate a new outfit and background, and on a bald head the beanie came back with long hair under it. For headwear Hairloom uses image-to-image with an instruction to keep the face, clothes and background, at 1 unit.", ask: "A keep-identity option on hat try-on, and a head-scarf style." },
  { t: "Readings can differ between runs", b: "The same front photo read the left brow tail as “Average” on one run and “Sparse” on another. The passport keeps the reading with the photo it came from rather than presenting one run as fact.", ask: "A confidence value on shape and thickness readings." },
  { t: "Density detection is strict about angle", b: "Front-facing and generated head-down photos were rejected with error_face_angle_invalid. It needs YouCam's camera guide in hairdensity mode, so it is left out of the upload flow. For hair loss this is the reading we missed most, because the passport can say how long hair is but not how much of the scalp it covers.", ask: "A scalp-coverage readout that works on an ordinary front photo, for alopecia and thinning." },
  { t: "Volume and length templates are for women, and fill out rather than cover", b: "Every hair-volume and hair-extension template in YouCam's template list is in the “Female” category, so Hairloom doesn't offer them on men's photos. On a generated photo of thinning hair with a widening parting, all four volume templates filled out the sides and added length, but none covered the parting or a thin crown, which is what a topper is for. The three length templates changed length only.", ask: "Men's templates, and a crown or parting topper template." },
  { t: "Skin analysis needs a close-up", b: "The face must fill most of the frame. The journal finds the face on the device and crops to it before sending, which turns a normal selfie into an accepted one.", ask: "Accept a normal selfie and crop to the face on YouCam's side." },
  { t: "task/delete really deletes", b: "Tested on Oct 21: after task/delete the result URL returns 404, and starting a new task with the same input file fails with a 403. Hairloom deletes each task as soon as the browser has the result. If the tab closes first, the page sends the delete as it closes, and a daily sweep deletes anything left over.", ask: "Delete on completion as an option, so no task depends on the browser to clean up." },
];

const SOURCES = [
  ["Bray et al., GLOBOCAN 2022, CA Cancer J Clin 2024", "https://pubmed.ncbi.nlm.nih.gov/38572751/"],
  ["Wilson et al., global chemotherapy demand, Lancet Oncol 2019", "https://pubmed.ncbi.nlm.nih.gov/31078462/"],
  ["Freites-Martinez et al., hair disorders in cancer patients, JAAD", "https://pmc.ncbi.nlm.nih.gov/articles/PMC6186204"],
  ["American Cancer Society: choosing and wearing a wig", "https://www.cancer.org/cancer/managing-cancer/side-effects/hair-skin-nails/hair-loss/choosing-and-wearing-wig.html"],
  ["American Cancer Society: hair loss", "https://www.cancer.org/cancer/managing-cancer/side-effects/hair-skin-nails/hair-loss/coping-with-hair-loss.html"],
  ["Cancer Research UK: hair loss and cancer drugs", "https://www.cancerresearchuk.org/about-cancer/treatment/cancer-drugs/side-effects/hair-loss-and-thinning"],
  ["Cancer Research UK: wigs and other ways to cover", "https://www.cancerresearchuk.org/about-cancer/coping/physically/changes-appearance/hair-loss/wigs-other-ways"],
  ["Macmillan: wigs for cancer treatment", "https://www.macmillan.org.uk/cancer-information-and-support/impacts-of-cancer/hair-loss/wigs-for-cancer-treatment"],
  ["Wigs.com returns", "https://www.wigs.com/pages/returns-made-simple"],
  ["Wig Studio 1 returns", "https://www.wigstudio1.com/pages/international-returns"],
  ["Live in the Light refunds", "https://liveinthelight.co.uk/pages/refunds"],
  ["NHSBSA: wigs and fabric supports", "https://www.nhsbsa.nhs.uk/help-travel-eye-care-wigs-and-fabric-support-costs/wigs-and-fabric-supports"],
  ["Headcovers: decoding wig colours", "https://www.headcovers.com/decoding-wig-colors/"],
  ["Sharma, Wu & Dalal: the CIEDE2000 colour-difference formula", "https://doi.org/10.1002/col.20070"],
];

/** Our shade codes grouped into the plain colour words YouCam's label uses. */
function family(code: string) {
  if (["1", "1B"].includes(code)) return "black";
  if (["2", "4", "6", "8", "10", "12"].includes(code)) return "brown";
  if (["14", "16", "24", "613"].includes(code)) return "blonde";
  if (["27", "30", "33"].includes(code)) return "red";
  return "grey";
}

export default function Evidence() {
  const stock = WIGS.map((w) => ({ w, c: shadeCheck(w) })).filter((r) => r.c);
  const rows = byApi();
  const studio = rows.filter((r) => r.group === "studio");
  const left = rows.filter((r) => r.group !== "studio");
  const missing = missingEvidence();
  const cross = PERSONAS.map((p) => {
    const mine = measured(`${p.id}/kept`);
    const label = p.readings.face?.color?.hair_color_name ?? null;
    const shade = mine ? nearestShades(mine, 1)[0] : null;
    return { name: p.name, label, hex: p.readings.face?.color?.hair_color ?? null, mine: mine ? labToHex(mine) : null, shade, agrees: label && shade ? family(shade.code) === label.toLowerCase() : null };
  });
  const realLabelled = (real as { kind: string; labelOk?: boolean; face?: { color?: { hair_color_name?: string } } | null }[]).filter((p) => p.kind === "hair" && p.face?.color?.hair_color_name);
  const realFit = realLabelled.filter((p) => p.labelOk).length;
  const labels = cross.map((c) => c.label).filter((l): l is string => !!l);
  const constant = labels.length > 1 && new Set(labels).size === 1;
  const plainHits = stock.filter((r) => r.c!.got.code === r.w.code).length;
  const greyHits = stock.filter((r) => r.c!.withGrey === r.w.code).length;
  const greyWigs = stock.filter((r) => (r.c!.grey ?? 0) >= 0.15).sort((a, b) => b.c!.grey! - a.c!.grey!);
  const restMax = Math.max(...stock.filter((r) => (r.c!.grey ?? 0) < 0.15).map((r) => r.c!.grey ?? 0));
  const pct = (g: number | null | undefined) => `${Math.round((g ?? 0) * 100)}%`;
  const people = PERSONAS.map((p) => { const g = greyOf(`${p.id}/kept`); return { name: p.name, grey: g?.grey ?? null, blend: greyBlend(g?.grey, g?.base) }; });

  return (
    <>
      <section className="night" style={{ padding: "64px 0 56px" }}>
        <div className="wrap">
          <p className="kicker">Evidence</p>
          <h1 className="h-hero" style={{ maxWidth: "18ch" }}>What we measured, including what failed.</h1>
          <p className="lede" style={{ marginTop: 14 }}>
            {TOTALS.runs} YouCam tasks are in the ledger below, and {TOTALS.ok} succeeded: {TOTALS.demo.runs} made the demo people and boutique stock, {TOTALS.real.runs} ran on real photographs, and {TOTALS.research.runs} were early research. Times are wall-clock from creating the task to having the result, polled every few seconds.
          </p>
        </div>
      </section>

      <section className="paper sec">
        <div className="wrap">
          <h2 className="h-sec">Tasks by API</h2>
          <p className="lede" style={{ marginTop: 12 }}>
            The studio calls {API_COUNT} YouCam APIs{missing.length ? "" : ", and each one has at least one successful run here"}. Every row is counted from an output file we kept ({LEDGER.generated}, <code>scripts/export-runs.mjs</code>), so tasks whose output we didn&rsquo;t keep, such as early exploration and one-unit end-to-end checks, are not in it. Face and hair length are split because they behave differently on generated and real photos.
          </p>
          <div className={s.table} role="table" aria-label="YouCam tasks by API">
            <div role="row" className={s.th}><span role="columnheader">API</span><span role="columnheader">Runs</span><span role="columnheader">Succeeded</span><span role="columnheader">Real photos</span><span role="presentation" className={s.rest}><span role="columnheader">Median</span><span role="columnheader">Errors seen</span></span></div>
            {studio.map((a) => (
              <div role="row" key={a.api + a.scope}>
                <span role="cell">{a.api}{a.scope ? <em className={s.scope}>{a.scope}</em> : null}</span>
                <span role="cell" className="num">{a.runs}</span>
                <span role="cell" className="num">{a.ok}</span>
                <span role="cell" className="num">{a.real ? `${a.real.ok}/${a.real.runs}` : "—"}</span>
                <span role="presentation" className={s.rest}>
                  <span role="cell" className="num">{a.ok ? `${a.medianS.toFixed(1)} s` : "—"}</span>
                  <span role="cell" className={s.errs}>{a.errors.join(", ") || "None"}</span>
                </span>
              </div>
            ))}
          </div>

          <h3 className="h-sub" style={{ marginTop: 40 }}>Used to build the demo, or tried and left out</h3>
          <div className={s.tableR} role="table" aria-label="YouCam tasks not used by the studio">
            <div role="row" className={s.th}><span role="columnheader">API</span><span role="columnheader">Runs</span><span role="columnheader">Succeeded</span><span role="columnheader">Why it isn&rsquo;t in the studio</span></div>
            {left.map((a) => (
              <div role="row" key={a.api}>
                <span role="cell">{a.api}</span>
                <span role="cell" className="num">{a.runs}</span>
                <span role="cell" className="num">{a.ok}</span>
                <span role="cell" className={s.errs}>{REJECTED[a.api] ?? "Made the demo people and the boutique’s wigs. The studio never calls it."}{a.errors.length ? ` Errors: ${a.errors.join(", ")}.` : ""}</span>
              </div>
            ))}
          </div>

          <h2 id="real" className="h-sec" style={{ marginTop: 72 }}>Real photographs</h2>
          <p className="lede" style={{ marginTop: 12 }}>
            The demo people are generated, so we ran the same YouCam calls on nine real portraits from Unsplash. Four are shaved heads. These are Unsplash-licensed stock photos of models, credited to each photographer on its card, and the people are not patients. We publish the results, not the pictures.
          </p>
          <RealTests />

          <h2 className="h-sec" style={{ marginTop: 72 }}>Hair colour: YouCam&rsquo;s label and the measured shade</h2>
          <p className="lede" style={{ marginTop: 12 }}>
            On the real photographs above, YouCam&rsquo;s label fit the hair on {realFit} of the {realLabelled.length} photos where it returned one, and Hairloom&rsquo;s measured shade gives a code a fitter can order. Both are judged by eye, because we have no reference swatch yet, and the measured shade missed once, on backlit brown hair.
          </p>
          <p className="lede" style={{ marginTop: 12 }}>
            For each generated demo person, the colour label YouCam&rsquo;s Face Attribute Analyzer returned for the kept photo, and the shade Hairloom measured from the hair pixels of the same photo.
            {constant ? ` The label was “${labels[0]}” for all ${labels.length} generated people that got one, whether their hair was dark brown, blonde or jet black. That looks like an artefact of generated images, so where it agrees with the measurement below, that is chance, and we report it rather than rely on it.` : ""}
          </p>
          <div className={s.cross}>
            {cross.map((c) => (
              <div key={c.name} className={s.crossCard}>
                <h3 className="h-sub">{c.name}</h3>
                <div className={s.pair}>
                  <figure><span style={{ background: c.hex ?? "transparent" }} /><figcaption>YouCam label<br /><b>{c.label ?? "Not returned"}</b></figcaption></figure>
                  <figure><span style={{ background: c.mine ?? "transparent" }} /><figcaption>Measured<br /><b>{c.shade ? `Shade ${c.shade.code}, ${c.shade.name.toLowerCase()}` : "—"}</b></figcaption></figure>
                </div>
                <p>{c.agrees == null ? "Nothing to compare." : c.agrees ? (constant ? "They agree, by chance." : "They agree.") : "They disagree, so the passport uses the measured shade."}</p>
              </div>
            ))}
          </div>

          <h2 className="h-sec" style={{ marginTop: 72 }}>Wig photos: the listed shade and the measured one</h2>
          <p className="lede" style={{ marginTop: 12 }}>
            Each demo wig was generated with a shade code in its description. Measured from the product photo, {stock.filter((r) => r.c!.got.code === r.w.code).length} of {stock.length} come back as that code; the rest read darker and less red, by {Math.abs(stock.reduce((n, r) => n + r.c!.dL, 0) / stock.length).toFixed(1)} points of lightness on average, because shadowed strands pull the median down. So the studio and the fitter desk show the listed code as the stock shade, and use the measurement only to rank wigs against each other. A client&rsquo;s measured shade carries the same bias, which is why the passport and the brief ask the fitter to confirm against real swatches.
          </p>
          <div className={s.tableWrap}>
            <table className={s.shadeTable}>
              <thead><tr><th>Wig</th><th>Listed</th><th>Measured</th><th>ΔE00</th><th>Grey</th><th>With grey check</th></tr></thead>
              <tbody>
                {stock.map(({ w, c }) => (
                  <tr key={w.id}><td>{w.name}</td><td><i style={{ background: c!.listed.hex }} aria-hidden="true" />{c!.listed.code}</td><td><i style={{ background: c!.got.hex }} aria-hidden="true" />{c!.got.code}{c!.got.code === w.code ? "" : " (miss)"}</td><td className="num">{c!.dE.toFixed(1)}</td><td className="num">{pct(c!.grey)}</td><td>{c!.withGrey}{c!.withGrey === w.code ? "" : " (miss)"}</td></tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3 id="grey" className="h-sub" style={{ marginTop: 40 }}>Grey, measured on the device</h3>
          <p className="lede" style={{ marginTop: 12 }}>
            A single median colour can&rsquo;t describe grey hair, so Hairloom also counts the share of hair pixels that are light and nearly colourless (L* above 55, chroma under 8; thresholds set before measuring). On the wig photos it reads {greyWigs.map((r) => `${r.w.name} ${pct(r.c!.grey)}`).join(", ")}, and every other wig under {pct(restMax)}. From 15% grey the studio suggests a grey blend code (1B/44, 38, 44, 51, 56 or 60, or a blonde base with 60), and with that check {greyHits} of {stock.length} wigs come back as their listed code, against {plainHits} without it. Among the demo people, {people.filter((x) => x.grey != null && x.grey >= 0.05).map((x) => `${x.name} reads about ${pct(x.grey)} grey${x.blend ? ` (suggested blend ${x.blend.code})` : ""}`).join(" and ")}.
          </p>
          <p className="lede" style={{ marginTop: 12 }}>
            We also tried trimming more of the darkest pixels before taking the median (on Oct 30, with the trim option in <code>lib/hairColor.ts</code>): leaving out the darkest 30% gave 7 of 16 listed codes, and 40% gave 8 of 16. That is tuned on these same 16 photos, and the 40% trim read Margaret&rsquo;s grey-blonde hair as light grey (51), so the studio keeps the 15% trim and reports the grey share beside it.
          </p>

          <h2 className="h-sec" style={{ marginTop: 72 }}>Not proven yet</h2>
          <ul className={s.open}>
            <li>No real person with hair loss has used Hairloom from start to finish. The real-photo tests use stock portraits, and shaved heads are smoother and better lit than chemotherapy hair loss. A pilot with consenting clients and a wig fitter is the next step.</li>
            <li>YouCam&rsquo;s guided camera (Camera Kit) is built in but has not been tested on a real phone, so we can&rsquo;t yet say how well its face and light checks work. Uploading photos works without it.</li>
            <li>Everything was tested on generated wig photos from our demo boutique and on stock portraits, not on a real retailer&rsquo;s product photos.</li>
            <li>Grey is now measured, but the blend codes it suggests are a loose convention that varies by brand, and they haven&rsquo;t been checked against real swatches. Ravi&rsquo;s salt-and-pepper reads about {pct(people.find((x) => x.name === "Ravi")?.grey)} grey, under the 15% where a blend is suggested, so his shade suggestions still lean dark and a fitter judges the grey by eye.</li>
            <li>The measured hair shade has no reference swatch to check against, and it missed once on the real photos.</li>
            <li>The closeness ranking weighs length, texture and colour by hand. It hasn&rsquo;t been checked against what fitters and clients actually choose.</li>
            <li>Shade codes vary by brand, and our hex values approximate typical swatches without white balance, so a fitter still checks against real swatches.</li>
          </ul>
        </div>
      </section>

      <section id="notes" className="night sec">
        <div className="wrap">
          <h2 className="h-sec">What we learned about the YouCam API, and what we&rsquo;d ask for</h2>
          <p className="lede" style={{ marginTop: 12 }}>
            Each note is something that cost us a run, what Hairloom does about it, and the one change we&rsquo;d ask the Perfect Corp team for.
          </p>
          <div className={s.notes}>
            {NOTES.map((n) => (
              <article key={n.t}>
                <h3 className="h-sub">{n.t}</h3>
                <p>{n.b}</p>
                <p className={s.ask}><b>We&rsquo;d ask:</b> {n.ask}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="sources" className="paper sec">
        <div className="wrap">
          <h2 className="h-sec">Sources</h2>
          <ol className={s.sources}>
            {SOURCES.map(([t, u]) => <li key={u}><a href={u} target="_blank" rel="noreferrer">{t}</a></li>)}
          </ol>
          <p className="small" style={{ marginTop: 20 }}>Wig shade codes are a loose convention that varies by brand; our hex values approximate typical swatches.</p>
          <p className="small" style={{ marginTop: 10 }}>The real-photo tests use Unsplash photos, under the Unsplash License and credited to each photographer. They are not covered by the code&rsquo;s MIT licence. MediaPipe models are Apache 2.0. See the NOTICE file in the repository.</p>
        </div>
      </section>
    </>
  );
}
