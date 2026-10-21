import real from "@/data/real.json";
import { measured } from "@/lib/colours";
import { labToHex, nearestShades } from "@/lib/color";
import s from "./RealTests.module.css";

type Run = { name: string; ok: boolean; error: string | null; ms: number | null };
type Photo = {
  id: string; by: string; kind: "hair" | "bald"; fit: string; note: string; url: string; src: string;
  images: Record<string, string>; runs: Run[]; length: string | null;
  face: { faceshape?: string; color?: { hair_color_name?: string }; quality?: { frontal?: string; faceangle?: string } } | null;
};
const PHOTOS = real as unknown as Photo[];

const LABEL: Record<string, string> = {
  wig_nora: "Nora wig", wig_zuri: "Zuri wig", wig_kai: "Kai wig", wig_arjun: "Arjun wig",
  head_turban: "Turban", brows: "Brows", length: "Length", face: "Face, default strictness", face_flexible: "Face, flexible",
};

/** Results of running the studio's YouCam calls on real photographs (Unsplash License). */
export function RealTests() {
  const tryons = PHOTOS.flatMap((p) => p.runs.filter((r) => r.name.startsWith("wig_")));
  const baldTry = PHOTOS.filter((p) => p.kind === "bald").flatMap((p) => p.runs.filter((r) => r.name.startsWith("wig_")));
  const readings = PHOTOS.filter((p) => p.kind === "hair");
  const lenOk = readings.filter((p) => p.runs.find((r) => r.name === "length")?.ok).length;
  const faceDefault = readings.filter((p) => p.runs.find((r) => r.name === "face")?.ok).length;
  const faceFlex = readings.filter((p) => p.runs.find((r) => r.name === "face_flexible")?.ok).length;

  return (
    <div className={s.wrap}>
      <div className={s.stats}>
        <div><b className="num">{tryons.filter((r) => r.ok).length}/{tryons.length}</b><span>wig try-ons succeeded on real photos</span></div>
        <div><b className="num">{baldTry.filter((r) => r.ok).length}/{baldTry.length}</b><span>of them on people who are really bald</span></div>
        <div><b className="num">{faceDefault}/{readings.length} → {faceFlex}/{readings.length}</b><span>face readings at default strictness, then &ldquo;flexible&rdquo;</span></div>
        <div><b className="num">{lenOk}/{readings.length}</b><span>length readings on everyday, slightly turned portraits</span></div>
      </div>

      <div className={s.grid}>
        {PHOTOS.map((p) => {
          const lab = p.kind === "hair" ? measured(`real/${p.id}`) : null;
          const shade = lab ? nearestShades(lab, 1)[0] : null;
          return (
            <article key={p.id} className={s.card}>
              <div className={s.strip}>
                <figure>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.src} alt={`Original photo: ${p.note}`} loading="lazy" />
                  <figcaption>Original</figcaption>
                </figure>
                {Object.entries(p.images).map(([k, src]) => (
                  <figure key={k}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`${LABEL[k] ?? k} on the same photo`} loading="lazy" />
                    <figcaption>{LABEL[k] ?? k}</figcaption>
                  </figure>
                ))}
              </div>
              <p className={s.note}>{p.note}{p.kind === "bald" ? " · really bald" : ""}</p>
              <ul className={s.runs}>
                {p.runs.filter((r) => !r.name.startsWith("wig_") && !r.name.startsWith("head_") && r.name !== "brows").map((r) => (
                  <li key={r.name} data-ok={r.ok}>{LABEL[r.name] ?? r.name}: {r.ok ? (r.name === "length" ? p.length : r.name === "face_flexible" ? `${p.face?.faceshape ?? "read"}${p.face?.quality?.frontal === "notgood" ? ", flagged as turned" : ""}` : "read") : r.error}</li>
                ))}
                {p.kind === "hair" && (
                  <li data-ok={true}>
                    Colour: {shade ? <><i style={{ background: labToHex(lab!) }} aria-hidden="true" /> shade {shade.code}, {shade.name.toLowerCase()}</> : "—"}
                    {p.face?.color?.hair_color_name ? ` (YouCam label: ${p.face.color.hair_color_name})` : ""}
                  </li>
                )}
              </ul>
              <p className={s.credit}>Photo by <a href={p.url} target="_blank" rel="noreferrer">{p.by}</a> on Unsplash</p>
            </article>
          );
        })}
      </div>
    </div>
  );
}
