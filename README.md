# Core 16 — Interactive Sea-Ice Explorer

A static, interactive 3D explorer for a 165 cm sea-ice core, built from the CT-scanned sections A1–E. It shows how **porosity**, **density** and **brine** change with depth.

## What it does

- **3D core** (Three.js): drag to rotate, click a section to zoom in, `←` / `→` to step through sections.
- **Colour modes**: CT voids (illustrative), porosity, density, brine.
- **Tabs**: an Overview plus one tab per section, each with summary statistics, a generated plain-language description, and a depth profile with uncertainty bands. Hovering a profile marks that depth on the 3D core.
- **Geochemistry**: a *Geochem* tab explains GI-1, GI-2 and integrated habitat potential with a full-depth chart, and each section tab adds its own samples. The core can be coloured by GI-1, GI-2 or habitat potential.
- Optional **CT video** per section: drop `videos/<ID>.mp4` (e.g. `videos/A1.mp4`). If the file is missing the video block is hidden.
- Optional **researcher notes**: fill the `notes` field of a section in `js/app.js` and it appears as a highlighted box on that tab.

| Section | Depth (cm) |
|---|---|
| A1 | 0–20 |
| A2 | 20–40 |
| B1 | 40–60 |
| B2 | 60–80 |
| C1 | 80–100 |
| C2 | 100–120 |
| D | 120–140 |
| E | 140–165 |

## Data

`Core16_Density.csv` (1 cm rows, depth = row centre) and `geochemistry_model_data.csv` (5 cm samples, depth = sample top) are read. Physical columns used:

- `dl_porosity_percent`, `void_lower`, `void_upper` — porosity and its bounds
- `dl_density_kg_m3`, `dl_density_lower_kg_m3`, `dl_density_upper_kg_m3` — density and its bounds
- `dl_brine_percent`, `brine_lower`, `brine_upper` — brine and its bounds

Rows deeper than 165 cm are ignored.

Geochemical columns used: `Microbial_Index` (GI-1, the mean of `Ba_Ca_norm`, `Mn_Fe_norm`, `Cu_Zn_norm`), `Enrichment_Index` (GI-2, the mean of the four `*_star_norm` columns) and `Activity_Index` (shown as integrated habitat potential). Indices are empty above ~40 cm and the page marks the saline transition zone at ~42 cm. `ICP_data.csv` stays in the repository but is not read.

**Note on the CT view:** the pores drawn in "CT voids" mode are generated procedurally from the measured porosity profile (count scales with porosity; size and colour are random). They illustrate the profile and are *not* the segmented CT volumes.

## Run locally

Browsers block `fetch` from `file://`, so serve the folder:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`. Three.js and fonts load from CDNs, so an internet connection is needed.

## Deploy

`.github/workflows/static.yml` publishes the repository root to GitHub Pages on every push to `main` (Settings → Pages → Source: GitHub Actions). Large videos are not part of the repository; keep them under GitHub's file limits or host them elsewhere and point the `src` in `segmentHTML` at the new URL.

## Structure

```text
index.html
css/style.css
js/app.js
videos/        (optional, A1.mp4 … E.mp4)
Core16_Density.csv
```
