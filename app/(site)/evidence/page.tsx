import type { Metadata } from "next";
import { PERSONAS } from "@/lib/demo";
import { TOTALS, byApi } from "@/lib/evidence";
import { measured } from "@/lib/colours";
import { labToHex, nearestShades } from "@/lib/color";
import { RealTests } from "@/components/RealTests";
import s from "./evidence.module.css";

export const metadata: Metadata = { title: "Evidence", description: "Every YouCam task we ran while building Hairloom, what failed, and what we measured." };

const NOTES = [
  { t: "Hair type and frizz need three same-size photos, in one order", b: "Front, then the face turned towards the right of the picture, then towards the left. Any other order, or different sizes, returns error_face_angle_invalid or error_mismatch_image_size. The studio crops all three to the front photo's size and orders the side photos itself from face landmarks, so a swapped upload still reads." },
  { t: "Hair colour comes back as a named category", b: "Face Attribute Analyzer and Facial Color Tones Analyzer return one of a few named swatches. That suits a beauty quiz, but a wig fitter needs a shade code, so Hairloom measures colour from the hair pixels and keeps YouCam's label beside it. Where they disagree is listed below." },
  { t: "Hairstyle try-on works on a bald head", b: "The docs list error_hair_too_short, so we expected failures after hair loss. All 64 try-ons on bald demo photos succeeded, and so did all 8 on real photos of people who are really bald." },
  { t: "Face reading is strict about angle by default", b: "At the default strictness, Face Attribute Analyzer rejected all five of our real, everyday portraits (error_face_not_forward_facing, error_face_angle_left_tilt, error_face_angle_downward). At face_angle_strictness_level \u201cflexible\u201d all five read, and face_quality still flags a turned face, which the passport passes on. Hair length has no such setting and failed on three slightly turned portraits, which is why the studio leads with YouCam's guided camera." },
  { t: "Hairstyle try-on can change more than hair", b: "On one real photo of a man with a full beard, both wig try-ons removed the beard, and on a black-and-white portrait the try-ons came back in colour. Hairloom's mirror lets you drag back to the original to spot this, and a fitter should always see the real person." },
  { t: "Hat try-on restyles the whole person", b: "Hat and scarf try-on generate a new outfit and background, and on a bald head the beanie came back with long hair under it. For headwear Hairloom uses image-to-image with an instruction to keep the face, clothes and background, at 1 unit." },
  { t: "Readings can differ between runs", b: "The same front photo read the left brow tail as \u201cAverage\u201d on one run and \u201cSparse\u201d on another. The passport keeps the reading with the photo it came from rather than presenting one run as fact." },
  { t: "Density detection is strict about angle", b: "Front-facing and generated head-down photos were rejected with error_face_angle_invalid. It needs YouCam's camera guide in hairdensity mode, so it is left out of the upload flow." },
  { t: "Skin analysis needs a close-up", b: "The face must fill most of the frame. The journal finds the face on the device and crops to it before sending, which turns a normal selfie into an accepted one." },
  { t: "task/delete really deletes", b: "Tested on Oct 21: after task/delete the result URL returns 404, and starting a new task with the same input file fails with a 403. Hairloom deletes each task as soon as the browser has the result." },
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
  const apis = byApi();
  const cross = PERSONAS.map((p) => {
    const mine = measured(`${p.id}/kept`);
    const label = p.readings.face?.color?.hair_color_name ?? null;
    const shade = mine ? nearestShades(mine, 1)[0] : null;
    return { name: p.name, label, hex: p.readings.face?.color?.hair_color ?? null, mine: mine ? labToHex(mine) : null, shade, agrees: label && shade ? family(shade.code) === label.toLowerCase() : null };
  });

  return (
    <>
      <section className="night" style={{ padding: "64px 0 56px" }}>
        <div className="wrap">
          <p className="kicker">Evidence</p>
          <h1 className="h-hero" style={{ maxWidth: "18ch" }}>What we measured, including what failed.</h1>
          <p className="lede" style={{ marginTop: 14 }}>
            {TOTALS.runs} YouCam tasks were run while building Hairloom and its demo, and {TOTALS.ok} succeeded. That includes the image generation that made the demo people and stock. Times are wall-clock from creating the task to having the result, polled every few seconds.
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

          <h2 id="real" className="h-sec" style={{ marginTop: 72 }}>Real photographs</h2>
          <p className="lede" style={{ marginTop: 12 }}>
            The demo people are generated, so we ran the same YouCam calls on nine real portraits from Unsplash, used under the Unsplash License. Four of them are of people who are really bald. These are models in stock photos, not patients.
          </p>
          <RealTests />

          <h2 className="h-sec" style={{ marginTop: 72 }}>Hair colour: YouCam&rsquo;s label and the measured shade</h2>
          <p className="lede" style={{ marginTop: 12 }}>
            For each demo person, the colour label YouCam&rsquo;s Face Attribute Analyzer returned for the kept photo, and the shade Hairloom measured from the hair pixels of the same photo.
          </p>
          <div className={s.cross}>
            {cross.map((c) => (
              <div key={c.name} className={s.crossCard}>
                <h3 className="h-sub">{c.name}</h3>
                <div className={s.pair}>
                  <figure><span style={{ background: c.hex ?? "transparent" }} /><figcaption>YouCam label<br /><b>{c.label ?? "Not returned"}</b></figcaption></figure>
                  <figure><span style={{ background: c.mine ?? "transparent" }} /><figcaption>Measured<br /><b>{c.shade ? `Shade ${c.shade.code}, ${c.shade.name.toLowerCase()}` : "—"}</b></figcaption></figure>
                </div>
                <p>{c.agrees == null ? "Nothing to compare." : c.agrees ? "They agree." : "They disagree, so the passport uses the measured shade."}</p>
              </div>
            ))}
          </div>

          <h2 className="h-sec" style={{ marginTop: 72 }}>Not proven yet</h2>
          <ul className={s.open}>
            <li>The real-photo tests use stock portraits, not people living with hair loss. A pilot with consenting clients and a wig fitter is the next step.</li>
            <li>YouCam&rsquo;s guided camera has been built in but not yet run on a phone by a real user.</li>
            <li>The closeness ranking weighs length, texture and colour by hand. It hasn&rsquo;t been checked against what fitters and clients actually choose.</li>
            <li>Shade codes vary by brand, and our hex values approximate typical swatches without white balance, so a fitter still checks against real swatches.</li>
          </ul>
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
