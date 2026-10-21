import Link from "next/link";
import { Mark } from "./Nav";
import s from "./Footer.module.css";

const COLS = [
  { title: "Hairloom", links: [["How it works", "/#how"], ["Studio", "/studio"], ["Journal", "/journal"], ["Privacy", "/privacy"]] },
  { title: "For wig fitters", links: [["Fitter desk", "/fitter"], ["Demo boutique", "/fitter#stock"], ["Open a shared passport", "/fitter#open"]] },
  { title: "Evidence", links: [["What we measured", "/evidence"], ["API notes", "/evidence#notes"], ["Sources", "/evidence#sources"]] },
  { title: "Runs on", links: [["YouCam API", "https://yce.perfectcorp.com/ai-api"], ["MediaPipe hair segmenter", "https://ai.google.dev/edge/mediapipe/solutions/vision/image_segmenter"], ["Next.js on Vercel", "https://nextjs.org"]] },
] as const;

const CHANGES = [
  ["Oct 21", "Hair passport, fitting room and demo boutique"],
];

export function Footer() {
  return (
    <footer className={s.foot}>
      <div className="wrap"><div className={s.top}>
        <div className={s.brand}>
          <p className={s.logo}><Mark size={26} /> Hairloom</p>
          <p className={s.tag}>Choose your wig while you still have your hair, and still choose after.</p>
          <div className={s.ctas}>
            <Link href="/studio" className="btn btn-ivory btn-sm">Open the studio</Link>
            <Link href="/fitter" className="btn btn-ghost btn-sm">Fitter desk</Link>
          </div>
        </div>
        {COLS.map((c) => (
          <nav key={c.title} aria-label={c.title} className={s.col}>
            <h2>{c.title}</h2>
            {c.links.map(([label, href]) =>
              href.startsWith("http") ? <a key={href} href={href} target="_blank" rel="noreferrer">{label}</a> : <Link key={href} href={href}>{label}</Link>,
            )}
          </nav>
        ))}
      </div></div>
      <div className="wrap"><div className={s.mid}>
        <div className={s.log}>
          <h2>Changelog</h2>
          <ul>{CHANGES.map(([d, t]) => <li key={d + t}><time>{d}</time> {t}</li>)}</ul>
        </div>
        <p className={s.care}>
          Hairloom helps with appearance, not medical care. It never diagnoses anything. For questions about treatment, hair loss or your scalp, talk to your care team.
        </p>
      </div></div>
      <div className="wrap"><div className={s.base}>
        <span>Built for the YouCam API Skin AI &amp; eCommerce VTO Hackathon, 2026.</span>
        <span>People and wigs shown in demos are generated with YouCam and are not real customers or products.</span>
      </div></div>
    </footer>
  );
}
