<p align="center"><img src="docs/cover.png" alt="Hairloom: choose your wig while you still have your hair" width="100%"></p>

<p align="center">
  <img alt="YouCam API" src="https://img.shields.io/badge/YouCam_API-9_APIs-c9a46a?style=flat-square">
  <img alt="Next.js 15" src="https://img.shields.io/badge/Next.js-15-24192a?style=flat-square">
  <img alt="On-device colour" src="https://img.shields.io/badge/hair_colour-measured_on_device-3a2b43?style=flat-square">
  <img alt="License MIT" src="https://img.shields.io/badge/license-MIT-5f4e5c?style=flat-square">
</p>

<p align="center">
  <b><a href="https://hairloom-studio.vercel.app">Live site</a></b> ·
  <b><a href="https://hairloom-studio.vercel.app/studio?p=anjali">Studio with a demo person</a></b> ·
  <b><a href="https://hairloom-studio.vercel.app/fitter#demo">Fitter desk</a></b> ·
  <b><a href="https://hairloom-studio.vercel.app/evidence">Evidence</a></b>
</p>

**Hairloom** helps people facing hair loss choose a wig while they still have their hair, and keep choosing after. It keeps a *hair passport* before treatment: curl pattern, frizz, length, face shape and brows from the YouCam API, plus a wig shade code measured on the device. Later it puts that hair, any wig, a headscarf or rebuilt brows back on the person's own photo, even after hair loss. The shortlist goes to their wig fitter in an end-to-end sealed link.

About 65% of people having chemotherapy lose hair. Hair usually starts to fall out two to three weeks after the first cycle, and cancer charities advise matching a wig *before* that happens. Most wig shops take returns only if the wig hasn't been worn, and some take none. That makes wigs the retail category where trying on before buying matters most, and where it is hardest to do. Sources are listed on the [evidence page](https://hairloom-studio.vercel.app/evidence#sources).

## Try it in a minute

1. Open the [studio with Anjali](https://hairloom-studio.vercel.app/studio?p=anjali). Anjali is a demo person, and every image is precomputed YouCam output, so nothing costs units.
2. **Keep:** read her hair passport and watch her colour being measured in your browser.
3. **Try:** pick wigs, ranked by how close each one is to the hair she kept. Then press *My own hair*, or recolour a wig to a shade closer to hers. A recolour runs live and costs 1 unit.
4. **Brows & headwear**, then **Share:** create a sealed link and open it as the fitter.

Or choose *Use my own photos*. YouCam's JS Camera Kit guides you through the three angles.

## What each YouCam API does here

| YouCam API | Job in Hairloom |
|---|---|
| Hairstyle Virtual Try-On v2.1 (`hair-transfer`) | Every wig on the user's face. With the kept photo as the reference, it also puts the user's own hair back onto a week-4 photo. |
| Hair Type Detection | Curl pattern (1 to 4C) from three angles, for matching texture. |
| Hair Frizziness Detection | How much frizz the fitter should match. |
| Hair Length Detection | The user's length today. In the fitter desk it also tags stock photos. |
| Face Attribute & Ratio Analyzer | Face shape, plus brow shape, thickness and colour. |
| Makeup Virtual Try-On (eyebrows) | Brows rebuilt in the kept shape and shade, for when they thin. |
| Hair Color Virtual Try-On | Recolours a chosen wig to the stock shades nearest the kept hair. |
| AI Image Generator (image to image, text to image) | Headwear that keeps the face. It also generated the demo people and the fictional boutique's stock. |
| AI Skin Analysis v2.1 | Optional weekly skin check-ins in the journal, using raw scores and concern maps. |
| JS Camera Kit | Guided three-angle capture (`hairtype` mode). |

## What we measured

[Evidence](https://hairloom-studio.vercel.app/evidence) lists every YouCam task run while building: 118 tasks, 115 succeeded. It shows success counts and median times by API, the errors we hit, and what they taught us. Highlights:

- **Hairstyle try-on works on a bald head.** All 42 week-4 try-ons succeeded, including each person's own hair restored from their kept photo. Restored hair landed within ΔE00 0.9–2.5 of the kept colour.
- **YouCam's hair-colour field can be far off.** It read Anjali's dark brown hair as "Blonde #FAF0BE", ΔE00 73.5 from the pixels. So Hairloom measures hair colour itself, with MediaPipe's hair segmenter running in the browser, a trimmed CIELAB median and CIEDE2000 against 20 common wig shades. It shows both values.
- **Hair type and frizz need three same-size photos in a fixed order.** The order is front, then face towards the right of the picture, then towards the left. Anything else returns `error_face_angle_invalid` or `error_mismatch_image_size`.
- **Hat try-on restyles the whole outfit.** On a bald head it once added hair under a beanie. Headwear uses image-to-image with an instruction to keep the face instead.

## Privacy

- **Photos and passport** live only in the browser (IndexedDB). There are no accounts.
- **Colour** is measured on the device.
- **YouCam tasks:** every task's result is downloaded by our server, which then calls `task/delete` at YouCam. That removes the input photo too.
- **Fitter links** are encrypted with AES-GCM in the browser. The server stores only ciphertext, in a private GCS bucket reached through keyless workload identity federation. Shares are deleted after 60 days. The key lives in the URL fragment, which never reaches a server.

## Architecture

```
browser                                   server (Next.js on Vercel)                YouCam API v2
──────────────────────────────            ───────────────────────────               ─────────────
Camera Kit / upload → resize       ──▶   /api/try  whitelist of 10 task kinds ──▶  file upload → task
MediaPipe hair mask → Lab → ΔE00          unit floor + per-visitor budget            poll → result
MediaPipe face crop (skin)         ◀──   download result, then task/delete   ◀──
IndexedDB passport + renders
AES-GCM seal  ─────────────────────▶   /api/share  ciphertext only ──▶ GCS (WIF, no keys)
```

- `lib/kinds.ts`: the whitelist. The server builds every request body, so no arbitrary feature or prompt can pass through.
- `lib/youcam.ts`: upload, task, poll, delete and live unit balance.
- `lib/hairColor.ts`, `lib/color.ts`: on-device hair colour, CIELAB and CIEDE2000.
- `lib/seal.ts`, `app/api/share`: sealed fitter links.
- `components/studio/*`: Keep, Try, Brows & headwear, Share.
- `components/fitter/*`: the fitter desk and stock auto-tagging.
- `components/journal/*`: the treatment timeline (with .ics export) and skin check-ins.

## Run it

```bash
npm install
echo "YOUCAM_API_KEY=sk-..." > .env.local   # from the YouCam API console
npm run dev                                   # http://localhost:3141
```

- **Demo people** work without a key.
- **Live runs** keep `UNIT_FLOOR` units (default 120) in reserve.
- **Shares** are written to `.data/` locally. Set `GCS_BUCKET` and `GCS_WIF_AUDIENCE` for production.

**Scripts:**
- `scripts/export-demo.mjs` refreshes demo data from the lab runs.
- `scripts/measure.cjs` re-measures demo hair colours in a real browser.
- `scripts/e2e.cjs <url>` runs the end-to-end check (1 unit).

## Limits

- Hairloom is about appearance, not medical care. It never diagnoses, and the journal's skin scores are YouCam's raw 1–100 scores, not clinical measurements.
- Wig shade codes are a loose convention that varies by brand; our hex values approximate typical swatches.
- The boutique, its stock and the demo people are fictional, generated with the YouCam Image Generator.

## License

MIT
