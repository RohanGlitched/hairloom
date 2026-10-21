# Demo pipeline

These scripts made every demo image and reading on the site with the YouCam API. They are
here for transparency, and they read the key from `../keys/youcam.env`, outside the repo.

- `yc.mjs`: a tiny client that uploads, creates a task, polls and saves the result.
- `catalogue.mjs`: generates the fictional boutique's wig photos (text to image).
- `precompute.mjs`: for each demo person, makes the three-angle set, then reads the passport. It also makes the photo after hair loss, restores their own hair, tries every wig and four headwear looks.
- `precompute3.mts`: makes brows, closer shades, thinning previews, wigs on the kept photo, and Anjali's two skin check-ins.
- Outputs go to `lab/out/`, which is not committed. `scripts/export-demo.mjs` copies them into `public/demo` and `data/`.
