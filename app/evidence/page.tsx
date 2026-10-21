import type { Metadata } from "next";
import { PERSONAS } from "@/lib/demo";
import { TOTALS, byApi } from "@/lib/evidence";
import { measured } from "@/lib/colours";
import { deltaE00, hexToLab, labToHex, nearestShades } from "@/lib/color";
import s from "./evidence.module.css";

export const metadata: Metadata = { title: "Evidence", description: "Every YouCam task we ran while building Hairloom, what failed, and what we measured." };

const NOTES = [
  { t: "Hair type and frizz need three same-size photos, in one order", b: "The order is front, then the face turned towards the right of the picture, then towards the left. Any other order, or photos of different sizes, returns error_face_angle_invalid or error_mismatch_image_size. The studio resizes all three to the front photo's size and labels each slot." },
  { t: "The hair-colour field can be far off", b: "Face Attribute Analyzer and Facial Color Tones Analyzer both returned “Blonde #FAF0BE” for Anjali's dark brown hair. Hairloom measures hair colour itself with an on-device hair mask and shows the YouCam value beside it, rather than hiding the disagreement." },
  { t: "Hairstyle try-on works on a bald head", b: "The docs list error_hair_too_short, so we expected failures after hair loss. Every one of our 42 week-4 try-ons succeeded, including each person's own hair restored from their kept photo." },
  { t: "Hat try-on restyles the whole person", b: "Hat and scarf try-on generate a new outfit and background, and on a bald head the beanie came back with long hair under it. For headwear we use image-to-image with an instruction to keep the face, clothes and background, at 1 unit." },
  { t: "Readings can differ between runs", b: "The same front photo read the left brow tail as “Average” on one run and “Sparse” on another. The passport keeps the reading with the photo it came from and doesn't present one run as fact." },
  { t: "Density detection is strict about angle", b: "Front-facing and generated head-down photos were all rejected with error_face_angle_invalid. It needs YouCam's camera guide in hairdensity mode, so Hairloom leaves density out of the uploaded-photo flow." },
  { t: "Skin analysis needs a close-up", b: "The face must fill most of the frame. The journal finds the face on-device and crops to it before sending, which turns a normal selfie into an accepted one." },
  { t: "Failed tasks are free; delete finished ones", b: "Units are charged only on success. Hairloom calls task/delete after every result, which removes the input photo at YouCam too." },
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

export default function Evidence() {
  const apis = byApi();
  const cross = PERSONAS.map((p) => {
    const mine = measured(`${p.id}/kept`);
    const own = measured(`${p.id}/own`);
    const api = p.readings.face?.color?.hair_color;
    return {
      name: p.name,
      api: api ? { hex: api, name: p.readings.face?.color?.hair_color_name ?? "" } : null,
      mine: mine ? { hex: labToHex(mine), shade: nearestShades(mine, 1)[0] } : null,
      gap: mine && api ? deltaE00(mine, hexToLab(api)) : null,
      ownGap: mine && own ? deltaE00(mine, own) : null,
    };
  });

  return (
    <>
      <section className="night" style={{ padding: "64px 0 56px" }}>
        <div className="wrap">
          <p className="kicker">Evidence</p>
          <h1 className="h-hero" style={{ maxWidth: "18ch" }}>What we measured, including what failed.</h1>
          <p className="lede" style={{ marginTop: 14 }}>
            {TOTALS.runs} YouCam tasks were run while building Hairloom and its demo, and {TOTALS.ok} succeeded. Times are wall-clock from creating the task to having the result, polled every few seconds.
          </p>
        </div>
      </section>

      <section className="paper sec">
        <div className="wrap">
          <h2 className="h-sec">Tasks by API</h2>
          <div className={s.table} role="table" aria-label="YouCam tasks by API">
            <div role="row" className={s.th}><span role="columnheader">API</span><span role="columnheader">Runs</span><span role="columnheader">Succeeded</span><span role="columnheader">Median</span><span role="columnheader">Errors seen</span></div>
            {apis.map((a) => (
              <div role="row" key={a.api}>
                <span role="cell">{a.api}</span>
                <span role="cell" className="num">{a.runs}</span>
                <span role="cell" className="num">{a.ok}</span>
                <span role="cell" className="num">{a.ok ? `${a.medianS.toFixed(1)} s` : "—"}</span>
                <span role="cell" className={s.errs}>{a.errors.join(", ") || "None"}</span>
              </div>
            ))}
          </div>

          <h2 className="h-sec" style={{ marginTop: 72 }}>Hair colour: YouCam&rsquo;s field against an on-device measurement</h2>
          <p className="lede" style={{ marginTop: 12 }}>
            For each demo person, the hair colour YouCam&rsquo;s Face Attribute Analyzer returned, the colour our hair mask measured from the same photo, and the CIEDE2000 difference. Under about 3 is hard to tell apart; above 10 is a different colour. The last column checks the restored-hair render against the kept photo.
          </p>
          <div className={s.cross}>
            {cross.map((c) => (
              <div key={c.name} className={s.crossCard}>
                <h3 className="h-sub">{c.name}</h3>
                <div className={s.pair}>
                  <figure><span style={{ background: c.api?.hex }} /><figcaption>YouCam field<br /><b>{c.api ? `${c.api.name} ${c.api.hex}` : "Not returned"}</b></figcaption></figure>
                  <figure><span style={{ background: c.mine?.hex }} /><figcaption>Measured<br /><b>{c.mine ? `${c.mine.hex}, shade ${c.mine.shade.code}` : "—"}</b></figcaption></figure>
                </div>
                <p className="num">Difference: <b>{c.gap != null ? `ΔE ${c.gap.toFixed(1)}` : "no YouCam value to compare"}</b></p>
                <p className="num small">Restored hair vs kept: {c.ownGap != null ? `ΔE ${c.ownGap.toFixed(1)}` : "—"}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="notes" className="night sec">
        <div className="wrap">
          <h2 className="h-sec">API notes we learned the hard way</h2>
          <div className={s.notes}>
            {NOTES.map((n) => (
              <article key={n.t}><h3 className="h-sub">{n.t}</h3><p>{n.b}</p></article>
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
        </div>
      </section>
    </>
  );
}
