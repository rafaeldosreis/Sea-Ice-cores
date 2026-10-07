# Core 16 — Interactive Sea-Ice Profile

A static, immersive research exhibit aligning CT videos, 1 cm physical profiles, 5 cm geochemical samples, and geochemical model outputs along one 0–163 cm depth axis.

## Data contract

Place these existing repository files in the project root:

- `Core16_Density.csv` — 1 cm brine, porosity, and density profiles.
- `ICP_data.csv` — geochemistry, normally sampled every 5 cm.
- `geochemistry_model_data.csv` — geochemistry and model outputs.
- The eight 3D MP4 files already present in the repository.

The processing pipeline preserves the original 1 cm physical profiles and calculates overlap-weighted interval statistics for each geochemical sample. The final interval is forced to 155–163 cm when its top is approximately 155 cm. Missing data remain missing; coverage is exported explicitly.

## Local preview

Browsers block CSV loading from `file://`, so serve the folder locally:

```bash
python -m http.server 8000
```

Open `http://localhost:8000`.

## Validate the aggregation

```bash
python -m pip install pandas numpy
python scripts/aggregate_data.py
```

This writes:

- `aligned_profile.csv` — one row per geochemical interval.
- `profile_metadata.json` — detected columns, depth convention, row counts, and segment mapping.

The web app also performs the same aggregation in the browser as a fallback.

## Publish with GitHub Pages

1. Copy this package into the root of `rafaeldosreis/Sea-Ice-cores`.
2. Commit and push to `main`.
3. Open **Settings → Pages**.
4. Under **Build and deployment**, choose **GitHub Actions**.
5. Run **Deploy Core 16 exhibit** from the Actions tab, or push another commit.

The expected project URL is:

`https://rafaeldosreis.github.io/Sea-Ice-cores/`

The workflow checks out Git LFS objects, runs the aggregation, builds a clean `_site` artifact, and deploys it. If the combined videos exceed 850 MB, it creates smaller H.264 web copies before deployment. GitHub Pages has a 1 GB published-site limit, so externally hosted videos may be preferable if the compressed artifact still exceeds that limit.

## Controls

- Left/Right arrows: previous or next geochemical interval.
- Space: play or pause the selected CT video.
- `H`: presentation mode.
- `F`: full screen.
- `?`: methodology panel.

## Project structure

```text
index.html
css/style.css
js/data.js
js/app.js
scripts/aggregate_data.py
.github/workflows/pages.yml
.nojekyll
```

All documentation and source comments are in English. The site is static and does not transmit research data to a backend.
