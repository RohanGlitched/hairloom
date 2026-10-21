import type { Metadata } from "next";
import Link from "next/link";
import { KINDS, type KindName } from "@/lib/kinds";
import { Roi } from "@/components/Roi";
import s from "./business.module.css";

export const metadata: Metadata = {
  title: "For retailers and wig banks",
  description: "Who pays for Hairloom, what a fitting costs in YouCam API units, an ROI model for wig boutiques, a retailer widget and an India pilot plan.",
};

const USD = { sub: 0.048, payg: 0.055 };

const FITTING: [KindName, number, string][] = [
  ["hairType", 1, "Curl pattern"],
  ["hairFrizz", 1, "Frizz"],
  ["hairLength", 1, "Length"],
  ["face", 1, "Face shape and brows (optional)"],
  ["wig", 8, "Wig try-ons"],
  ["ownHair", 1, "Own hair, restored"],
  ["hairColor", 3, "Recolour to closer shades"],
  ["headwear", 3, "Headwear"],
  ["brows", 1, "Rebuilt brows"],
];

const BUYERS = [
  { who: "People facing hair loss", pays: "Free", body: "They bring the need and the photos. Charging them at the hardest moment is wrong, and they are the reason shops and hospitals pay." },
  { who: "Wig boutiques and fitters", pays: "Per client brief", body: "A passport, the shortlist on the client's face and the cap size arrive before the first visit. Draft pilot price: ₹300 a client, against about ₹175 of API cost." },
  { who: "Wig brands and online shops", pays: "Per try-on, via the widget", body: "A “see it after hair loss” panel beside each product, and a door into the full studio. It is the same try-on that Perfect Corp's 800+ beauty brands already buy." },
  { who: "Hospitals, wig banks and CSR", pays: "Sponsored passports", body: "Oncology centres and donated-hair wig programmes give every patient a passport at diagnosis. Indian company CSR budgets fund patient-support programmes like this." },
];

const PILOT = [
  ["Weeks 1–2", "One oncology centre's wig bank or boutique in Pune or Mumbai. Staff trained on the fitter desk; consent wording reviewed with the centre."],
  ["Weeks 3–6", "Passports offered at the first chemotherapy appointment, before hair loss. Fitter briefs used for every fitting."],
  ["Weeks 7–8", "Compare with the previous two months: fitting visits per client, minutes per fitting, wigs worn at four weeks, and how clients felt about choosing."],
];

export default function Business() {
  const units = FITTING.reduce((n, [k, times]) => n + KINDS[k].units * times, 0);
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
          <p className="small" style={{ marginTop: 20 }}>Insurers are a later step: in the US, a “cranial prosthesis” prescription can be reimbursed by some private plans, and a passport is useful paperwork. Prices here are drafts for a pilot, not offers.</p>
        </div>
      </section>

      <section className="night sec">
        <div className={`wrap ${s.costWrap}`}>
          <div>
            <h2 className="h-sec">What one fitting costs</h2>
            <p className="lede" style={{ marginTop: 12 }}>
              Unit costs from YouCam&rsquo;s price list (${USD.sub} a unit on a subscription, ${USD.payg} pay as you go), for the typical client we designed for.
            </p>
            <p className={s.total}>
              <b className="num">{units} units</b>
              <span className="num">${(units * USD.sub).toFixed(2)}–{(units * USD.payg).toFixed(2)} a client</span>
            </p>
            <p className="small">A lighter passport (curl, frizz, length only) is {lite} units. Skin check-ins in the journal are {KINDS.skin.units} units each, so we suggest one per treatment cycle, not one a week.</p>
          </div>
          <table className={s.table}>
            <thead><tr><th>Step</th><th>YouCam API</th><th>Times</th><th>Units</th></tr></thead>
            <tbody>
              {FITTING.map(([k, times, label]) => (
                <tr key={k}><td>{label}</td><td>{KINDS[k].api}</td><td className="num">{times}</td><td className="num">{KINDS[k].units * times}</td></tr>
              ))}
            </tbody>
            <tfoot><tr><td colSpan={3}>Total</td><td className="num">{units}</td></tr></tfoot>
          </table>
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
            <p className="lede" style={{ marginTop: 12 }}>The widget shows the wig on people after hair loss and opens the studio for the shopper&rsquo;s own photo. It works today for the demo stock.</p>
            <pre className={s.code}><code>{`<iframe src="https://hairloom-studio.vercel.app/embed?wig=asha"
  title="See this wig after hair loss"
  width="560" height="300" style="border:0"></iframe>`}</code></pre>
          </div>
          <iframe src="/embed?wig=asha" title="Hairloom widget for the Asha wig" className={s.frame} loading="lazy" />
        </div>
      </section>

      <section className="paper sec">
        <div className="wrap">
          <h2 className="h-sec">An eight-week pilot in India</h2>
          <ol className={s.pilot}>
            {PILOT.map(([w, t]) => <li key={w}><b>{w}</b><span>{t}</span></li>)}
          </ol>
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
