<p align="center"><img src="docs/cover.png" alt="Hairloom: choose your wig while you still have your hair" width="100%"></p>

<p align="center">
  <img alt="YouCam API" src="https://img.shields.io/badge/YouCam_API-11_APIs-c9a46a?style=flat-square">
  <img alt="CI" src="https://github.com/RohanGlitched/hairloom/actions/workflows/ci.yml/badge.svg">
  <img alt="Next.js 15" src="https://img.shields.io/badge/Next.js-15-24192a?style=flat-square">
  <img alt="On-device colour" src="https://img.shields.io/badge/hair_colour-measured_on_device-3a2b43?style=flat-square">
  <img alt="License MIT" src="https://img.shields.io/badge/license-MIT-5f4e5c?style=flat-square">
</p>

<p align="center">
  <b><a href="https://hairloom-studio.vercel.app">Live site</a></b> ·
  <b><a href="https://hairloom-studio.vercel.app/studio?p=anjali">Studio with a demo person</a></b> ·
  <b><a href="https://hairloom-studio.vercel.app/fitter#demo">Fitter desk</a></b> ·
  <b><a href="https://hairloom-studio.vercel.app/business">For retailers</a></b> ·
  <b><a href="https://hairloom-studio.vercel.app/evidence">Evidence</a></b>
</p>

**Hairloom** helps people facing hair loss choose a wig while they still have their hair, and keep choosing after. It keeps a *hair passport* before treatment: curl pattern, frizz, length, face shape and brows from the YouCam API, plus a wig shade code measured on the device. Later it puts that hair, any wig, a headscarf or rebuilt brows back on the person's own photo, even after hair loss. The shortlist goes to their wig fitter in an end-to-end sealed link.

About 65% of people having chemotherapy lose hair. Hair usually starts to fall out two to three weeks after the first cycle, and cancer charities advise matching a wig *before* that happens. Most wig shops take returns only if the wig hasn't been worn, and some take none. That makes wigs the retail category where trying on before buying matters most, and where it is hardest to do. Sources are listed on the [evidence page](https://hairloom-studio.vercel.app/evidence#sources).

## Try it in a minute

1. Open the [studio with Anjali](https://hairloom-studio.vercel.app/studio?p=anjali). Anjali is a demo person, and every image is precomputed YouCam output, so nothing costs units. Nia (alopecia), Margaret and Ravi are there too.
2. **Keep:** read her hair passport, with curl, frizz, length, face shape, brows, head size and her colour as a wig shade code.
3. **Try:** pick wigs on her photo before hair loss, then switch to week 4. Wigs are ranked by how close each is to the hair she kept. You can drag across the mirror to compare, recolour a wig to a closer shade, or preview a topper for thinning hair.
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
| Hair Volume Virtual Try-On | Shows how a topper's worth of volume looks, for thinning rather than lost hair. |
| Hair Extension Virtual Try-On | Shows clip-in length on the kept photo. |
| AI Image Generator (image to image, text to image) | Headwear that keeps the face. It also generated the demo people and the fictional boutique's stock. |
| AI Skin Analysis v2.1 | Optional weekly skin check-ins in the journal, using raw scores and concern maps. |
| JS Camera Kit | Guided three-angle capture (`hairtype` mode). |

## What we measured

[Evidence](https://hairloom-studio.vercel.app/evidence) lists every YouCam task run while building, including the image generation that made the demo, with success counts, median times, the errors we hit and what they taught us. Highlights:

- **Hairstyle try-on works on a bald head.** All 64 try-ons on bald demo photos succeeded, including each person's own hair restored from their kept photo. These bald photos are generated edits, so tests on real people are next.
- **Hair colour comes back from YouCam as a named category.** A wig fitter needs a shade code, so Hairloom measures colour from the hair pixels: MediaPipe's hair segmenter running in the browser, then a trimmed CIELAB median and CIEDE2000 against 20 common wig shades. YouCam's label is kept beside it. For one demo person, the label said "Blonde" for dark brown hair.
- **`task/delete` really deletes.** Afterwards the result URL returns 404 and the input file can't be reused (403).
- **Hair type and frizz need three same-size photos in a fixed order.** The order is front, then face towards the right of the picture, then towards the left. Anything else returns `error_face_angle_invalid` or `error_mismatch_image_size`.
- **Hat try-on restyles the whole outfit.** On a bald head it once added hair under a beanie. Headwear uses image-to-image with an instruction to keep the face instead.

## For a fitter's AI assistant (MCP)

Hairloom is also an MCP server (Streamable HTTP) at `https://hairloom-studio.vercel.app/api/mcp`. Add it to Claude or another assistant that supports remote MCP servers.

| Tool | What it does |
|---|---|
| `match_wigs` | Ranks stock against a client's passport and gives a pull list in the client's shade, with a cap note. |
| `shade_for_colour` | Turns a hair colour hex into common wig shade codes, using CIEDE2000. |
| `list_stock` | Browses the boutique's wigs, with shades measured from the product photos. |
| `show_on_demo_person` | Returns a precomputed YouCam try-on of a wig on a demo person. |
| `fitting_plan` | Gives the dates to plan around treatment, from ACS, CRUK and Macmillan guidance. |
| `fitting_cost` | Gives the YouCam units and dollars for a fitting. |

The server never sees client photos. For live try-ons, pair it with YouCam's hosted MCP servers (`/mcp/fashion`, `/mcp/beauty`). `node scripts/mcp-check.mjs <url>` runs a smoke test.

## For retailers and wig banks

[The business page](https://hairloom-studio.vercel.app/business) covers who pays and what a fitting costs.

- **Who pays:**
  - Patients never pay.
  - Boutiques pay per client brief.
  - Wig brands embed [a widget](https://hairloom-studio.vercel.app/embed?wig=asha).
  - Hospitals and wig banks sponsor passports.
- **What it costs:** a typical fitting is 41 YouCam units, about $2.
- **Also on the page:** an ROI model for a boutique, with its assumptions labelled, and an eight-week pilot plan for India.

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

- `lib/kinds.ts`: the whitelist. The server builds every request body and validates options before anything is uploaded.
- `lib/guard.ts`: spend controls.
  - Units are reserved before any await and released on failure.
  - A global daily cap applies.
  - Task handles are HMAC-signed, so polls only reach YouCam for tasks this server started.
- `lib/youcam.ts`: upload, task, poll, delete and live unit balance.
- `lib/hairColor.ts`, `lib/color.ts`: on-device hair colour, CIELAB and CIEDE2000.
- `lib/seal.ts`, `app/api/share`: sealed fitter links. A decrypted share is validated with zod before rendering, and the fitter desk runs under a strict Content Security Policy.
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
- `npm test` runs:
  - CIEDE2000 against the Sharma reference pairs;
  - the whitelist and option validation;
  - handle signing and unit reservations;
  - share validation.
- `lab/` holds the scripts that generated the demo with the YouCam API.

## Limits

- Hairloom is about appearance, not medical care. It never diagnoses, and the journal's skin scores are YouCam's raw 1–100 scores, not clinical measurements.
- Wig shade codes are a loose convention that varies by brand; our hex values approximate typical swatches.
- The boutique, its stock and the demo people are fictional, generated with the YouCam Image Generator. Tests with real, consenting people are the next step.
- The closeness ranking weighs length, texture and colour by hand. It hasn't yet been checked against what fitters and clients choose.
- On-device hair segmentation and face detection use MediaPipe (Apache 2.0).

## License

MIT
