import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy", description: "Where your photos go in Hairloom, and where they don't." };

const ROWS = [
  ["Your photos and passport", "Stored only in this browser (IndexedDB). There are no accounts and no server copy. “Erase my photos” in the studio clears everything."],
  ["Hair colour", "Measured in your browser by a hair mask (MediaPipe). That photo is never uploaded for colour."],
  ["Try-ons and readings", "Each one sends the needed photo through our server to YouCam. When the result is back, we delete the task at YouCam with its input photo, and return the result only to you. Our server keeps no copy."],
  ["Fitter links", "Encrypted in your browser with AES-GCM. The server stores only ciphertext. The key is the part of the link after #, which browsers never send to a server. Anyone you give the full link to can open it."],
  ["Skin check-ins", "Cropped to your face in your browser, read by YouCam Skin Analysis, then deleted at YouCam. Scores and maps stay in this browser."],
  ["Analytics and cookies", "None."],
];

export default function Privacy() {
  return (
    <section className="night sec">
      <div className="wrap" style={{ maxWidth: 900 }}>
        <p className="kicker">Privacy</p>
        <h1 className="h-hero">Your photos are yours.</h1>
        <p className="lede" style={{ marginTop: 14 }}>Hairloom is built for a vulnerable moment, so it keeps as little as possible, for as short a time as possible.</p>
        <dl style={{ marginTop: 40, display: "grid", gap: 0 }}>
          {ROWS.map(([k, v]) => (
            <div key={k} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(0,2fr)", gap: 24, padding: "18px 0", borderTop: "1px solid var(--line)" }}>
              <dt style={{ fontFamily: "var(--serif)", fontSize: 21 }}>{k}</dt>
              <dd style={{ margin: 0, color: "var(--mist)" }}>{v}</dd>
            </div>
          ))}
        </dl>
        <p className="small" style={{ marginTop: 28 }}>Hairloom helps with appearance, not medical care, and never diagnoses anything. Talk to your care team about treatment, hair loss or your scalp.</p>
      </div>
    </section>
  );
}
