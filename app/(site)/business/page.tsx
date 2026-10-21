import type { Metadata } from "next";
import Link from "next/link";
import { KINDS } from "@/lib/kinds";
import { BRIEF_INR, fitting, unitsOf, usd } from "@/lib/pricing";
import { CostTable } from "@/components/CostTable";
import { EmbedFrame } from "@/components/EmbedFrame";
import { Roi } from "@/components/Roi";
import s from "./business.module.css";

export const metadata: Metadata = {
  title: "For retailers and wig banks",
  description: "Who pays for Hairloom, what a fitting costs in YouCam API units, an ROI model for wig boutiques, a retailer widget and an India pilot plan.",
};

const FX = 88; // rupees per dollar, the same assumption as the ROI model
const rs = (dollars: string) => "₹" + Math.round(Number(dollars) * FX);
const CHEMO = unitsOf(fitting("chemo"));
const SPONSORED = unitsOf(fitting("sponsored"));
const SPONSOR_INR = 150;
const REPO = "https://github.com/RohanGlitched/hairloom";
const PILOT_ISSUE = `${REPO}/issues/new?labels=pilot&title=${encodeURIComponent("Pilot: your boutique, wig bank or hospital")}&body=${encodeURIComponent("City:\nClients fitted a month:\nWho fits wigs today:\nBest way to reach you:\n\nPlease don't include any patient details here.")}`;

const BUYERS = [
  { who: "People facing hair loss", pays: "Free", body: "They bring the need and the photos. Charging them at the hardest moment is wrong, and they are the reason shops and hospitals pay." },
  { who: "Wig boutiques and fitters", pays: "Per client brief", body: `A passport, the shortlist on the client's face and the cap size arrive before the first visit. Draft pilot price: ₹${BRIEF_INR} a client plus GST, against ${rs(usd(CHEMO, "sub"))}–${rs(usd(CHEMO, "payg"))} of API cost.` },
  { who: "Wig brands and online shops", pays: "Per studio session, via the widget", body: "A “see it after hair loss” panel beside each product, free to show, and a door into the studio with that wig first. Draft price: ₹49 for each studio session that tries wigs on the shopper's own photo." },
  { who: "Hospitals, wig banks and CSR", pays: "Sponsored passports", body: `Every patient gets a passport at diagnosis: ${SPONSORED} units, about ${rs(usd(SPONSORED, "sub"))} of API cost. At a sponsor price of ₹${SPONSOR_INR}, 500 patients cost ₹${(500 * SPONSOR_INR).toLocaleString("en-IN")}. Health care is an eligible CSR activity under section 135 of India's Companies Act.` },
];

const THRESHOLDS = [
  ["60%", "of patients offered a passport keep one before their hair falls out"],
  ["−25%", "fitting visits per client, against the two months before"],
  ["80%", "of wigs bought are still worn at four weeks"],
];

const PILOT = [
  ["Weeks 1–2", "One oncology centre's wig bank or boutique in Pune or Mumbai. Staff trained on the fitter desk; consent wording reviewed with the centre."],
  ["Weeks 3–6", "Passports offered at the first chemotherapy appointment, before hair loss. Fitter briefs used for every fitting."],
  ["Weeks 7–8", "Compare with the previous two months: fitting visits per client, minutes per fitting, wigs worn at four weeks, and how clients felt about choosing."],
];

export default function Business() {
  const lite = KINDS.hairType.units + KINDS.hairFrizz.units + KINDS.hairLength.units;
  return (
    <>
      <section className="night" style={{ padding: "64px 0 56px" }}>
        <div className="wrap">
          <p className="kicker">For retailers and wig banks</p>
          <h1 className="h-hero" style={{ maxWidth: "20ch" }}>A fitting that starts before the shop opens.</h1>
          <p className="lede" style={{ marginTop: 14 }}>
            Wigs are the one beauty product people can rarely return once worn, bought at the worst moment, matched from memory. Hairloom moves the choosing earlier and puts it on the shopper&rsquo;s own face. Here is who pays, what it costs and how we would prove it.
          </p>
          <div className={s.stats}>
            <div><b>~65%</b><span>of people on chemotherapy lose hair</span><a className="src" href="https://pmc.ncbi.nlm.nih.gov/articles/PMC6186204" target="_blank" rel="noreferrer">JAAD</a></div>
            <div><b>31.4%</b><span>of surveyed patients bought a wig</span><a className="src" href="https://www.gminsights.com/industry-analysis/hair-wig-and-extension-market" target="_blank" rel="noreferrer">GMI 2026</a></div>
            <div><b>$1.9B</b><span>medical wig segment projected by 2035</span><a className="src" href="https://www.gminsights.com/industry-analysis/hair-wig-and-extension-market" target="_blank" rel="noreferrer">GMI 2026</a></div>
            <div><b>1.46M</b><span>new cancer cases in India in 2022</span><a className="src" href="https://pubmed.ncbi.nlm.nih.gov/36510887/" target="_blank" rel="noreferrer">ICMR</a></div>
          </div>
        </div>
      </section>

      <section className="paper sec">
        <div className="wrap">
          <h2 className="h-sec">Who pays</h2>
          <div className={s.buyers}>
            {BUYERS.map((b) => (
              <article key={b.who}>
                <p className={s.pays}>{b.pays}</p>
                <h3 className="h-sub">{b.who}</h3>
                <p>{b.body}</p>
              </article>
            ))}
          </div>
          <p className="small" style={{ marginTop: 20 }}>Insurers are a later step: in the US, some private plans reimburse a wig prescribed as a “cranial prosthesis”, and a passport could support that claim with photos and measurements. Prices here are drafts for a pilot, not offers.</p>
        </div>
      </section>

      <section className="night sec">
        <div className={`wrap ${s.costWrap}`}>
          <div>
            <h2 className="h-sec">What one fitting costs</h2>
            <p className="lede" style={{ marginTop: 12 }}>
              Unit costs from YouCam&rsquo;s price list: $0.048 a unit on the 500-unit subscription ($0.046 at 10,000 a month), $0.055 pay as you go. The table is built from the same task list the studio runs, and matches the MCP server&rsquo;s fitting_cost tool.
            </p>
            <p className="small" style={{ marginTop: 14 }}>A lighter passport (curl, frizz, length only) is {lite} units. The face reading is optional and the dearest single step, at {KINDS.face.units} units. Skin check-ins in the journal are {KINDS.skin.units} units each, so we suggest one per treatment cycle.</p>
          </div>
          <CostTable />
        </div>
      </section>

      <section className="paper sec">
        <div className="wrap">
          <h2 className="h-sec">For a boutique: does it pay?</h2>
          <p className="lede" style={{ margin: "12px 0 32px" }}>Move the assumptions. Every figure that isn&rsquo;t from a price list or a source is labelled as one.</p>
          <Roi />
        </div>
      </section>

      <section id="embed" className="night sec">
        <div className={`wrap ${s.embedWrap}`}>
          <div>
            <h2 className="h-sec">For wig shops: one line on a product page</h2>
            <p className="lede" style={{ marginTop: 12 }}>The widget wipes between a demo person after hair loss and the same person in this wig, then opens the studio with that wig first, for the shopper&rsquo;s own photo. It resizes itself on phones.</p>
            <pre className={s.code}><code>{`<iframe id="hairloom" src="https://hairloom-studio.vercel.app/embed?wig=asha"
  title="See this wig after hair loss" style="border:0;width:100%;height:320px"></iframe>
<script>addEventListener("message", (e) => {
  if (e.origin === "https://hairloom-studio.vercel.app" && e.data?.hairloom === "height")
    document.getElementById("hairloom").style.height = e.data.h + "px";
});</script>`}</code></pre>
            <p className="small" style={{ marginTop: 14 }}>It works today for the demo stock. A shop&rsquo;s own catalogue needs one product photo per wig: Hairloom measures the shade from the photo and YouCam renders the wig on the demo people once, so showing the widget costs nothing per view.</p>
          </div>
          <EmbedFrame wig="asha" className={s.frame} />
        </div>
      </section>

      <section className="paper sec">
        <div className="wrap">
          <h2 className="h-sec">An eight-week pilot in India</h2>
          <ol className={s.pilot}>
            {PILOT.map(([w, t]) => <li key={w}><b>{w}</b><span>{t}</span></li>)}
          </ol>
          <h3 className="h-sub" style={{ marginTop: 40 }}>It works if, after eight weeks</h3>
          <div className={s.thresholds}>
            {THRESHOLDS.map(([n, t]) => <p key={t}><b className="num">{n}</b><span>{t}</span></p>)}
          </div>
          <div style={{ marginTop: 28 }}><a className="btn btn-ink" href={PILOT_ISSUE} target="_blank" rel="noreferrer">Ask for a pilot</a></div>
          <p className="small" style={{ marginTop: 20 }}>
            Natural partners already exist: the Tata Memorial Centre and Cherian Foundation give donated-hair wigs to patients, and Cope with Cancer in Mumbai makes free wigs for women on chemotherapy. A passport helps them match a donated wig to the person.
          </p>
        </div>
      </section>

      <section className="night sec">
        <div className="wrap">
          <h2 className="h-sec">Health data, handled like health data</h2>
          <p className="lede" style={{ marginTop: 12 }}>
            Using Hairloom can reveal a cancer diagnosis, which India&rsquo;s Digital Personal Data Protection Act and the GDPR treat with care. So there are no accounts, photos stay on the device, YouCam tasks are deleted after each result, and fitter links are encrypted end to end. A hospital deployment would add a consent record and a data-processing agreement.
          </p>
          <div className="small" style={{ marginTop: 18 }}><Link href="/privacy">Read the privacy page</Link></div>
        </div>
      </section>
    </>
  );
}
