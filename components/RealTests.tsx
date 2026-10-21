import real from "@/data/real.json";
import { measured } from "@/lib/colours";
import { labToHex, nearestShades } from "@/lib/color";
import s from "./RealTests.module.css";

type Run = { name: string; ok: boolean; error: string | null; ms: number | null };
type Photo = {
  id: string; by: string; kind: "hair" | "bald"; fit: string; note: string; url: string;
  images: Record<string, string>; runs: Run[]; length: string | null;
  eye?: string; labelOk?: boolean; colourNote?: string;
  face: { faceshape?: string; color?: { hair_color_name?: string }; quality?: { frontal?: string; faceangle?: string } } | null;
};
const PHOTOS = real as unknown as Photo[];

const LABEL: Record<string, string> = {
  wig_nora: "Nora wig", wig_zuri: "Zuri wig", wig_kai: "Kai wig", wig_arjun: "Arjun wig",
  head_turban: "Turban", brows: "Brows", length: "Length", face: "Face, default strictness", face_flexible: "Face, flexible",
};

/** Results of running the studio's YouCam calls on real photographs (Unsplash License). The images are not published: see the note in the summary. */
export function RealTests() {
  const tryons = PHOTOS.flatMap((p) => p.runs.filter((r) => r.name.startsWith("wig_")));
  const baldTry = PHOTOS.filter((p) => p.kind === "bald").flatMap((p) => p.runs.filter((r) => r.name.startsWith("wig_")));
  const readings = PHOTOS.filter((p) => p.kind === "hair");
  const lenOk = readings.filter((p) => p.runs.find((r) => r.name === "length")?.ok).length;
  const faceDefault = readings.filter((p) => p.runs.find((r) => r.name === "face")?.ok).length;
  const faceFlex = readings.filter((p) => p.runs.find((r) => r.name === "face_flexible")?.ok).length;
  const labelled = readings.filter((p) => p.face?.color?.hair_color_name);
  const labelFit = labelled.filter((p) => p.labelOk).length;

  return (
    <div className={s.wrap}>
      <div className={s.stats}>
        <div><b className="num">{tryons.filter((r) => r.ok).length}/{tryons.length}</b><span>wig try-ons succeeded on real photos</span></div>
        <div><b className="num">{baldTry.filter((r) => r.ok).length}/{baldTry.length}</b><span>of them on shaved heads</span></div>
        <div><b className="num">{faceDefault}/{readings.length} → {faceFlex}/{readings.length}</b><span>face readings at default strictness, then &ldquo;flexible&rdquo;</span></div>
        <div><b className="num">{lenOk}/{readings.length}</b><span>length readings on everyday, slightly turned portraits</span></div>
      </div>

      <ul className={s.summary}>
        <li>
          <b>Hair colour label.</b> YouCam returned a label for {labelled.length} of {readings.length} hair photos, and it fit the hair by eye on {labelFit} of {labelled.length}: {labelled.map((p) => `${p.face?.color?.hair_color_name} for ${p.eye}`).join(", ")}. No label came back for the other {readings.length - labelled.length}. We have no reference swatch yet, so this is a judgement by eye.
        </li>
        <li><b>Brows.</b> All four shaved-head photos still have brows, so the rebuilt brows barely change them. The brow rebuild is untested on a face that has lost its brows.</li>
        <li><b>Why there are no pictures here.</b> The people in these photos agreed to Unsplash&rsquo;s licence, not to appearing with wigs and turbans in a hair-loss product, so we show the results and keep the edited images out of the site and the repository.</li>
        <li><b>Easy photos.</b> These are lit, sharp, uncovered heads. None is a hard case such as glasses, dim phone light or patchy loss.</li>
      </ul>

      <div className={s.grid}>
        {PHOTOS.map((p) => {
          const lab = p.kind === "hair" ? measured(`real/${p.id}`) : null;
          const shade = lab ? nearestShades(lab, 1)[0] : null;
          return (
            <article key={p.id} className={s.card}>
              <p className={s.note}>{p.note}</p>
              <ul className={s.runs}>
                {p.runs.filter((r) => !r.name.startsWith("wig_") && !r.name.startsWith("head_") && r.name !== "brows").map((r) => (
                  <li key={r.name} data-ok={r.ok}>{LABEL[r.name] ?? r.name}: {r.ok ? (r.name === "length" ? p.length : r.name === "face_flexible" ? `${p.face?.faceshape ?? "read"}${p.face?.quality?.frontal === "notgood" ? ", flagged as turned" : ""}` : "read") : r.error}</li>
                ))}
                {p.kind === "hair" && (
                  <li data-ok={true}>
                    Colour: {shade ? <><i style={{ background: labToHex(lab!) }} aria-hidden="true" /> shade {shade.code}, {shade.name.toLowerCase()}</> : "—"}
                    {p.face?.color?.hair_color_name ? ` (YouCam label: ${p.face.color.hair_color_name})` : " (YouCam returned no label)"}
                    {p.colourNote ? <em> {p.colourNote}</em> : null}
                  </li>
                )}
              </ul>
              <p className={s.credit}>Tested on a photo by <a href={p.url} target="_blank" rel="noreferrer">{p.by}</a> on Unsplash; {Object.keys(p.images).length} try-on images kept privately.</p>
            </article>
          );
        })}
      </div>
    </div>
  );
}
