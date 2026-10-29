# Demo pipeline

These scripts made every demo image and reading on the site with the YouCam API. They are here for
transparency. Each reads the API key from a `keys/youcam.env` file next to the folder it runs from,
which is never committed; no key, token or auth header is written in any of them. They were run from the
hackathon folder one level above this repository, so their relative paths (`./out/`, `../hairloom/...`)
assume that layout. Raw outputs go to `lab/out/`, which is not committed because the task results carry
signed URLs; `scripts/export-demo.mjs` copies images into `public/demo` and `data/demo.json`, and
`scripts/export-runs.mjs` turns every saved task into a row of `data/lab-runs.json` (the evidence ledger).

| Script | What it made | Ledger rows (`name` prefix) |
|---|---|---|
| `yc.mjs` | The small client the others use: upload, create a task, poll, save. | — |
| `catalogue.mjs` | The fictional boutique's wig photos (text to image), `public/catalogue/`. | `cat/` |
| `precompute.mjs` | Each demo person's three angles, their passport readings, the photo after hair loss, own hair restored, every wig and four headwear looks. | `demo/<id>/` |
| `precompute3.mts` | Brows, closer shades, thinning previews, wigs on the kept photo, Anjali's two skin check-ins. | `demo/<id>/` |
| `precompute4.mts` | Margaret's photo of thinning hair and every volume and clip-in template on it; Nia's topper and clip-ins. | `demo/margaret/thin_*`, `demo/nia/thin_*` |
| `precompute5.mts` | Wren (grey-blonde wig) on every person, Nia's first patch photo with a topper and clip-ins, Ravi's flat cap and bandana. | `demo/<id>/wig_wren`, `demo/nia/unused/*`, `demo/ravi/head_*` |
| `precompute6.mts` | Nia's patches again (kept as `demo/nia/unused/thinning*`, shown on /evidence as the Oct 21 patch photo). | `demo/nia/unused/*` |
| `tpl.mjs` | Lists the hair-volume and hair-extension templates (a free GET; no task). | — |
| `round2.mjs` | Oct 30: Anjali's regrowth photos and the Hair Type + Hair Length re-read (`data/regrowth.json`, `public/demo/anjali/regrow*.jpg`); Nia's patch photo and the Zuri try-on on it (`public/demo/nia/patchy*.jpg`); two crown photos for density (rejected). | `r2/` |
| `round3.mjs` | Oct 30: Margaret's light shades at colour intensity 100 and 90; two 45° selfies for density (rejected). | `r3/` |
| `round4.mts` | Oct 30: Margaret's light shades with the colour lifted by the measured shortfall (`lib/kinds.ts` `compensated`), now the demo's renders. | `r4/margaret_shade_*` |
| `realtest.mjs` | The nine Unsplash real-photo tests (results only are published, `data/real.json`). | `real/` |
