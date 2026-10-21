import Link from "next/link";
import { EmbedFrame } from "@/components/EmbedFrame";
import { FittingRoom } from "@/components/FittingRoom";
import { Mirror } from "@/components/Mirror";
import { Passport } from "@/components/Passport";
import { Reveal } from "@/components/Reveal";
import { PERSONAS, persona } from "@/lib/demo";
import { API_COUNT_WORD, TOTALS, byApi } from "@/lib/evidence";
import { BOUTIQUE, WIGS } from "@/lib/catalogue";
import { measured } from "@/lib/colours";
import { demoBrief } from "@/lib/brief";
import { capSize } from "@/lib/match";
import s from "./home.module.css";

const anjali = persona("anjali");

const STEPS = [
  {
    title: "Keep",
    img: anjali.kept,
    body: "Three photos, front and both sides, while your hair is still yours. Hairloom records curl pattern, frizz, length, face shape and brows, and measures your colour on your own device.",
    apis: "Hair Type, Hair Frizziness, Hair Length detection · Face Attribute Analyzer",
  },
  {
    title: "Try",
    img: anjali.wigs.june,
    body: "Any wig in the boutique on your own face. It works after hair loss too, and your kept photo can put your own hair back on today's photo.",
    apis: "Hairstyle Virtual Try-On · Hair Color Try-On",
  },
  {
    title: "Cover",
    img: anjali.headwear.turban,
    body: "Turbans, silk scarves, beanies and sleep caps on your face for the days without a wig, and brows rebuilt in your own shape and colour for when they thin.",
    apis: "Image Generator (image to image) · Makeup Virtual Try-On",
  },
  {
    title: "Share",
    img: "/catalogue/thumb/asha.jpg",
    body: "Send your passport and shortlist to your wig fitter in an encrypted link. They prepare the right wigs, shades and cap size before you arrive.",
    apis: "Fitter desk · end-to-end encrypted link",
  },
];

const FACTS = [
  { big: "2–3 weeks", body: "after the first chemotherapy cycle is when hair usually starts to fall out.", src: [["American Cancer Society", "https://www.cancer.org/cancer/managing-cancer/side-effects/hair-skin-nails/hair-loss/coping-with-hair-loss.html"], ["Cancer Research UK", "https://www.cancerresearchuk.org/about-cancer/treatment/cancer-drugs/side-effects/hair-loss-and-thinning"]] },
  { big: "Before", body: "is when cancer charities say to match a wig, while a fitter can still see your colour and style. They also say to keep photos and a lock of hair.", src: [["ACS", "https://www.cancer.org/cancer/managing-cancer/side-effects/hair-skin-nails/hair-loss/choosing-and-wearing-wig.html"], ["CRUK", "https://www.cancerresearchuk.org/about-cancer/coping/physically/changes-appearance/hair-loss/wigs-other-ways"], ["Macmillan", "https://www.macmillan.org.uk/cancer-information-and-support/impacts-of-cancer/hair-loss/wigs-for-cancer-treatment"]] },
  { big: "Unworn", body: "is the condition most wig shops require for a return. Some take none back at all, for hygiene.", src: [["Wigs.com", "https://www.wigs.com/pages/returns-made-simple"], ["Wig Studio 1", "https://www.wigstudio1.com/pages/international-returns"], ["Live in the Light", "https://liveinthelight.co.uk/pages/refunds"]] },
];

const APIS = [
  ["Hairstyle Virtual Try-On v2.1", "Every wig on your face, and your own hair back from your kept photo"],
  ["Hair Type Detection", "Curl pattern from three angles, for matching texture"],
  ["Hair Frizziness Detection", "How much frizz the fitter should expect to match"],
  ["Hair Length Detection", "Your length today, for like-for-like or deliberate change"],
  ["Face Attribute & Ratio Analyzer", "Face shape and brow shape, thickness and colour"],
  ["Makeup Virtual Try-On", "Brows rebuilt in your own shape and shade"],
  ["Hair Color Virtual Try-On", "Stock shades on the wig you like"],
  ["Hair Volume Virtual Try-On", "Fuller lengths for thinning hair; a fitter shows toppers for the crown"],
  ["Hair Extension Virtual Try-On", "Clip-in length on your kept photo"],
  ["AI Image Generator", "Headwear that keeps your face; demo people and boutique stock"],
  ["AI Skin Analysis", "Optional skin check-ins in the journal, once per treatment cycle"],
];

export default function Home() {
  const apis = byApi().filter((a) => a.group === "studio");
  const brief = demoBrief();
  return (
    <>
      {/* Hero */}
      <section className={`night ${s.hero}`} aria-labelledby="hero-title">
        <div className="wrap">
          <div className={s.heroText}>
            <h1 id="hero-title" className="h-hero">Choose your wig while you still have your hair.</h1>
            <p className="lede">
              Hairloom keeps a record of your hair before treatment. Later it puts that hair, any wig or a headscarf back on your own photo, so you can choose before it&rsquo;s gone and still choose after.
            </p>
            <div className={s.ctas}>
              <Link href="/studio" className="btn btn-ivory">Open the studio</Link>
              <a href="#fitting" className="btn btn-ghost">Try a demo fitting</a>
            </div>
          </div>
          <div className={s.mirrors}>
            <Mirror src={anjali.withHair.june ?? anjali.kept} alt="Anjali before treatment, trying a wavy ash-brown wig on her own photo" caption="Trying wigs" note="Before treatment, with her hair" priority />
            <div className={s.centre}>
              <Reveal before={anjali.week4} after={anjali.own} beforeAlt="Anjali at week 4, bald" afterAlt="Anjali at week 4 with her own hair restored from her kept photo" beforeLabel="Week 4" afterLabel="Her hair" label="Compare Anjali at week 4 with and without her own hair" initial={50} />
              <p className={s.capC}>Her hair, back</p>
              <p className={s.noteC}>Week 4 photo, her kept photo as the reference</p>
            </div>
            <Mirror src={anjali.headwear.turban} alt="Anjali at week 4 wearing a dusty rose jersey turban" caption="For the evenings" note="Jersey turban, dusty rose" priority />
          </div>
          <p className={s.disclose}>
            Anjali is a demo person made with the YouCam Image Generator, as are her week-4 photos. Every image on this page is real YouCam API output, unretouched.
          </p>
        </div>
        <div className={s.shelf} aria-hidden="true" />
      </section>

      {/* Why before */}
      <section className={`paper sec`} aria-labelledby="why-title">
        <div className="wrap">
          <p className="kicker">Why before</p>
          <h2 id="why-title" className="h-sec">The best time to choose a wig is before you need one.</h2>
          <div className={s.facts}>
            {FACTS.map((f) => (
              <div key={f.big} className={s.fact}>
                <p className={s.big}>{f.big}</p>
                <p>{f.body}</p>
                <p className="src">{f.src.map(([n, u], i) => <span key={u}>{i > 0 && " · "}<a href={u} target="_blank" rel="noreferrer">{n}</a></span>)}</p>
              </div>
            ))}
          </div>
          <p className={s.wide}>
            About 65% of people having chemotherapy lose hair, and a dermatology review reports that fear of it leads some to refuse treatment.{" "}
            <a className="src" href="https://pmc.ncbi.nlm.nih.gov/articles/PMC6186204" target="_blank" rel="noreferrer">JAAD review, 2019</a>
          </p>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="night sec" aria-labelledby="how-title">
        <div className="wrap">
          <p className="kicker">How it works</p>
          <h2 id="how-title" className="h-sec">Keep, try, cover, share.</h2>
          <ol className={s.steps}>
            {STEPS.map((st, i) => (
              <li key={st.title}>
                <div className={s.stepImg}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={st.img} alt="" loading="lazy" />
                </div>
                <p className={s.stepN}>{i + 1}</p>
                <h3 className="h-sub">{st.title}</h3>
                <p>{st.body}</p>
                <p className={s.stepApi}>{st.apis}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Fitting room demo */}
      <section id="fitting" className="deep sec" aria-labelledby="fit-title">
        <div className="wrap">
          <div className={s.secHead}>
            <div>
              <p className="kicker">The fitting room</p>
              <h2 id="fit-title" className="h-sec">{WIGS.length} wigs, {PERSONAS.length} people, after hair loss.</h2>
            </div>
            <p className="lede">
              Pick a person and a wig. Each render puts a wig from {BOUTIQUE.name}, our demo boutique, onto that person&rsquo;s photo after hair loss, and ranks it against the hair they kept: length, texture and measured colour.
            </p>
          </div>
          <FittingRoom personas={PERSONAS} />
        </div>
      </section>

      {/* Passport */}
      <section className="paper sec" aria-labelledby="pass-title">
        <div className={`wrap ${s.passWrap}`}>
          <div className={s.passText}>
            <p className="kicker">The hair passport</p>
            <h2 id="pass-title" className="h-sec">A record a wig fitter can work from.</h2>
            <p className="lede">
              Charities advise keeping photos and a lock of hair. Hairloom keeps the photos and reads them: curl pattern, frizz, length, face shape and brows from YouCam, and colour as a common wig shade code.
            </p>
            <ul className={s.ticks}>
              <li>Three angles, from YouCam&rsquo;s guided camera, which shows face position, facing and light as you shoot, or from photos you upload.</li>
              <li>Head size and parting, measured at home with a soft tape, so the fitter can have the right cap ready.</li>
              <li>Colour measured from the hair pixels on your device and matched to common wig shade codes.</li>
              <li>Stays on your device until you choose to share it.</li>
            </ul>
            <Link href="/studio" className="btn btn-ink">Start your hair passport</Link>
          </div>
          <Passport p={anjali} lab={measured("anjali/kept")} />
        </div>
      </section>

      {/* Fitters */}
      <section className="night sec" aria-labelledby="fitter-title">
        <div className={`wrap ${s.split}`}>
          <div>
            <p className="kicker">For wig fitters</p>
            <h2 id="fitter-title" className="h-sec">The fitting starts before the client walks in.</h2>
            <p className="lede">
              A client sends a link. The fitter sees the passport, the wigs they liked on their own face, their shade code and a note that heads can shrink by up to a size during treatment. A fitter&rsquo;s AI assistant can do the same through Hairloom&rsquo;s MCP server: rank stock, give the pull list and plan dates.
            </p>
            <div className={s.ctas}>
              <Link href="/fitter" className="btn btn-ivory">Open the fitter desk</Link>
              <Link href="/fitter#assistant" className="btn btn-ghost">Ask your AI assistant</Link>
            </div>
          </div>
          <div className={s.brief}>
            <p className={s.briefHead}><span>Fitting brief</span><span>{brief.name} · Wed 28 Oct, 11:00</span></p>
            <div className={s.briefRow}>
              {brief.looks.slice(0, 3).map((l) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={l.key} src={l.src} alt={`Anjali: ${l.label}`} />
              ))}
            </div>
            <ul>
              <li><span>Shortlist</span>{brief.looks.slice(0, 3).map((l) => l.label).join(", ")}</li>
              <li><span>Her shade</span>{brief.colour ? `${brief.colour.code}, ${brief.colour.name.toLowerCase()}` : "—"}</li>
              <li><span>Cap</span>{brief.cap?.cm ? `${capSize(brief.cap.cm)}, ${brief.cap.cm} cm, ${brief.cap.parting} parting` : "—"}</li>
              <li><span>Note</span>{brief.note}</li>
            </ul>
            <Link href="/fitter#demo" className="btn btn-ghost btn-sm" style={{ marginTop: 16 }}>Open the full brief</Link>
          </div>
        </div>
      </section>

      {/* Business */}
      <section className="deep sec" aria-labelledby="biz-title">
        <div className={`wrap ${s.split}`}>
          <div>
            <p className="kicker">For retailers and wig banks</p>
            <h2 id="biz-title" className="h-sec">About $2 of YouCam units per client fitted.</h2>
            <p className="lede">
              A full fitting, with passport, eight wigs, own hair, three shades, headwear and brows, is 41 YouCam units. Boutiques pay per client brief, wig brands embed a widget, and hospitals and wig banks sponsor passports. Patients never pay.
            </p>
            <div className={s.ctas}>
              <Link href="/business" className="btn btn-ivory">See the business case</Link>
              <Link href="/business#embed" className="btn btn-ghost">The retailer widget</Link>
            </div>
          </div>
          <EmbedFrame wig="tara" className={s.embed} />
        </div>
      </section>

      {/* Evidence */}
      <section className="paper sec" aria-labelledby="ev-title">
        <div className="wrap">
          <div className={s.secHead}>
            <div>
              <p className="kicker">Evidence</p>
              <h2 id="ev-title" className="h-sec">What we measured, including what failed.</h2>
            </div>
            <p className="lede">
              {TOTALS.runs} YouCam tasks run while building Hairloom, {TOTALS.ok} succeeded, {TOTALS.real.runs} of them on real photographs. Failures taught us the rules the studio now follows, like the three-photo order hair-type detection expects.
            </p>
          </div>
          <div className={s.evTable} role="table" aria-label="YouCam tasks by API">
            <div role="row" className={s.evHead}><span role="columnheader">API</span><span role="columnheader">Runs</span><span role="columnheader">Succeeded</span><span role="columnheader">Median time</span></div>
            {apis.map((a) => (
              <div role="row" key={a.api}>
                <span role="cell">{a.api}{a.scope ? <span style={{ color: "var(--ink-soft)", fontSize: 13 }}>, {a.scope}</span> : null}</span>
                <span role="cell" className="num">{a.runs}</span>
                <span role="cell" className="num">{a.ok}</span>
                <span role="cell" className="num">{a.ok ? `${a.medianS.toFixed(1)} s` : "—"}</span>
              </div>
            ))}
          </div>
          <Link href="/evidence" className="btn btn-ghost" style={{ marginTop: 28 }}>Read the full notes</Link>
        </div>
      </section>

      {/* Privacy */}
      <section className="night sec" aria-labelledby="priv-title">
        <div className="wrap">
          <p className="kicker">Privacy</p>
          <h2 id="priv-title" className="h-sec">Your photos are yours.</h2>
          <div className={s.privacy}>
            <div><h3 className="h-sub">On your device</h3><p>Your passport and try-ons are kept in your browser. There is no account and no server copy.</p></div>
            <div><h3 className="h-sub">Deleted at YouCam</h3><p>Each photo goes to YouCam only for the step that needs it, and the task is deleted there, with its photo, as soon as your browser has the result.</p></div>
            <div><h3 className="h-sub">Sealed when shared</h3><p>A fitter link is encrypted in your browser. The key travels in the link itself and never reaches our server.</p></div>
          </div>
        </div>
      </section>

      {/* APIs */}
      <section className="deep sec" aria-labelledby="api-title">
        <div className="wrap">
          <p className="kicker">Built on the YouCam API</p>
          <h2 id="api-title" className="h-sec">{API_COUNT_WORD} YouCam APIs, each doing one job.</h2>
          <ul className={s.apis}>
            {APIS.map(([n, d]) => <li key={n}><b>{n}</b><span>{d}</span></li>)}
          </ul>
        </div>
      </section>

      {/* Close */}
      <section className={`night ${s.close}`} aria-labelledby="close-title">
        <div className="wrap">
          <h2 id="close-title" className="h-sec">Keep your hair today. Choose whenever you&rsquo;re ready.</h2>
          <div className={s.ctas} style={{ justifyContent: "center" }}>
            <Link href="/studio" className="btn btn-ivory">Open the studio</Link>
            <Link href="/journal" className="btn btn-ghost">Plan around your treatment</Link>
          </div>
          <p className="small" style={{ marginTop: 18 }}>{WIGS.length} wigs, 4 headwear styles and {PERSONAS.length} demo people ready to try without a photo of your own.</p>
        </div>
      </section>
    </>
  );
}
