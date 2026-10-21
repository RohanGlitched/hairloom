import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy", description: "Where your photos go in Hairloom, and where they don't." };

const ROWS = [
  ["Your photos and passport", "Stored only in this browser (IndexedDB). There are no accounts and no copy of them on our server. “Erase my photos” in the studio clears everything."],
  ["Hair colour", "Measured in your browser by a hair mask (MediaPipe). That photo is never uploaded for colour."],
  ["Try-ons and readings", "Each one sends the needed photo through our server to YouCam (Perfect Corp). Our server passes it on from memory and writes it nowhere. As soon as your browser has the result, we ask YouCam to delete the task and its input photo. If you close the tab first, the browser sends that delete request as the page closes; if even that can't get through, the task stays at YouCam under its own retention rules until it expires. Demo people are prepared in advance and send nothing."],
  ["Fitter links", "Encrypted in your browser with AES-GCM before anything is sent. Our server stores only the ciphertext and a random link id, in a private Google Cloud Storage bucket that deletes it after 60 days. The key is the part of the link after #, which browsers never send to a server, so we can't read a shared link. Anyone you give the full link to can open it."],
  ["Skin check-ins", "Cropped to your face in your browser, read by YouCam Skin Analysis, then deleted at YouCam. Scores and maps stay in this browser."],
  ["What our server does keep", "No photos and no readable health information. It keeps a count of YouCam units used each day, to cap spending, and, in memory only, a short hourly tally of units and new links per connection address, to stop abuse. That tally is lost when the server restarts. Our host, Vercel, keeps its standard request logs."],
  ["Consent", "Before your first upload, the studio explains all of this and asks you to confirm you're an adult and the photos are of you."],
  ["Health data", "Using Hairloom can reveal a diagnosis. That's why there are no accounts, nothing readable is kept on our server, and shared links are encrypted end to end."],
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
