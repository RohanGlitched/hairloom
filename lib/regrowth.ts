// The regrowth re-read: hair often returns curlier or a different colour after chemotherapy, so new
// growth is read with the same YouCam detections as the passport and compared with the hair kept.
import { LENGTH_LABEL, LENGTH_ORDER, TEXTURE_ORDER, WIGS, type Wig } from "./catalogue";
import { band, closeness, lengthFromTerm, orLonger, textureFromType } from "./match";

type Reading = { type?: { mapping: string; term: string } | null; length?: { term: string } | null };

export type Diff = {
  curl: { kept: string | null; now: string | null; word: string } | null;
  length: { kept: string | null; now: string | null; word: string } | null;
  summary: string;
};

/** Plain-words comparison of the kept passport and a re-read of new growth. */
export function regrowthDiff(kept: Reading, now: Reading): Diff {
  const kt = textureFromType(kept.type?.mapping), nt = textureFromType(now.type?.mapping);
  const kl = lengthFromTerm(kept.length?.term), nl = lengthFromTerm(now.length?.term);
  const curl = kept.type || now.type ? {
    kept: kept.type ? `${kept.type.mapping}, ${kept.type.term.toLowerCase()}` : null,
    now: now.type ? `${now.type.mapping}, ${now.type.term.toLowerCase()}` : null,
    word: kt && nt ? (kt === nt ? "The same texture" : TEXTURE_ORDER.indexOf(nt) > TEXTURE_ORDER.indexOf(kt) ? `Curlier: ${kt} to ${nt}` : `Straighter: ${kt} to ${nt}`) : "Not enough to compare",
  } : null;
  const length = kept.length || now.length ? {
    kept: kept.length?.term ?? null,
    now: now.length?.term ?? null,
    word: kl && nl ? (kl === nl ? "The same length" : LENGTH_ORDER.indexOf(nl) < LENGTH_ORDER.indexOf(kl) ? `Shorter: ${LENGTH_LABEL[kl].toLowerCase()} to ${LENGTH_LABEL[nl].toLowerCase()}` : `Longer: ${LENGTH_LABEL[kl].toLowerCase()} to ${LENGTH_LABEL[nl].toLowerCase()}`) : "Not enough to compare",
  } : null;
  const parts = [curl && kt && nt && kt !== nt ? (TEXTURE_ORDER.indexOf(nt) > TEXTURE_ORDER.indexOf(kt) ? "curlier" : "straighter") : null, length && kl && nl && kl !== nl ? (LENGTH_ORDER.indexOf(nl) < LENGTH_ORDER.indexOf(kl) ? "shorter" : "longer") : null].filter(Boolean);
  return { curl, length, summary: parts.length ? `New growth reads ${parts.join(" and ")} than the hair kept.` : "New growth reads like the hair kept." };
}

/**
 * Wigs to wear while new growth comes in, ranked against the new growth rather than the hair kept, so
 * a short curly crop isn't fighting a long straight wig. No colour here: regrowth often changes colour.
 */
export function bridgeFor(now: Reading, fit: Wig["fit"] = "Women", n = 2) {
  const nl = lengthFromTerm(now.length?.term), nt = textureFromType(now.type?.mapping);
  const ranked = WIGS.filter((w) => w.fit === fit).map((w) => ({ w, score: closeness(w, { length: nl, texture: nt, orLonger: orLonger(now.length?.term) }, null) })).sort((a, b) => b.score - a.score);
  const best = ranked[0]?.score;
  return ranked.slice(0, n).map((r) => ({ ...r, band: band(r.score, best) }));
}
