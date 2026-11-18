# wind-farm

A wind farm analysis from the wind to the money: an energy model checked against a real farm's
reported output, a project-finance model built in Excel and matched in tested code, and an
interactive site that presents both.

Status (2026-11-16): the site's first screen is built; the energy model is built and checked
against the farm's reported output; the finance model is in progress.

- Design: `docs/superpowers/specs/2026-11-14-wind-farm-design.md`
- Finance plan: `docs/superpowers/plans/2026-11-14-finance-side.md`

- Energy plan: `docs/superpowers/plans/2026-11-14-energy-side.md`
- Site design: `docs/superpowers/specs/2026-11-14-site-design.md`

## Site

An Astro static site in `site/`. Everything it calculates is a tested pure function in
`site/src/lib/`; the model math will come from `core/`.

```bash
cd site
npm install
npx playwright install chromium   # once, for the browser tests
npm run dev                       # work on it
npm run check && npm test && npm run build && npm run e2e && npm run budget && npm run lighthouse   # the gate
```

## Energy

A Python model in `energy/` of Black Oak Getty, a 39-turbine, 78 MW wind farm in Minnesota: hourly
wind to hub height, air density, the turbine's power curve, and a hand-written Jensen wake model.
It is checked against what the farm reported each month for 2018 to 2025. The same turbine and
wake math is ported to TypeScript in `core/src/energy/` for the site's tools. How it works, with
sources: `docs/notes/energy.md`.

Two results, both published as measured (run of 2026-11-16):

- **Blind prediction:** 24.92% below the farm's reported output over 96 months, using no number
  from the farm and a fixed 13.19% of assumed losses.
- **Calibrated on the farm's earlier years, tested on a held-out year:** one factor fitted on 2018
  to 2024, then tested on 2025: 1.46% above the farm for the year, 5.53% average monthly error.
  This is not a from-scratch prediction.

```bash
uv sync                          # once
uv run python -m energy.run      # public data (cached in data/raw/) -> validation -> data/results/
uv run pytest energy             # the tests; they never use the network
cd core && npm ci && npm test && npm run check    # the TypeScript version matches the Python
```

### Data and credits

All sources are free and need no key. Licences and what each obliges are in `docs/data-sources.md`.

- **Turbines:** United States Wind Turbine Database, U.S. Geological Survey, American Clean Power
  Association and Lawrence Berkeley National Laboratory, <https://doi.org/10.5066/F7TX3DN0>. Public
  domain.
- **Reported generation:** Source: U.S. Energy Information Administration, Form EIA-923, years 2018
  to 2025, downloaded November 2026. Public domain.
- **Wind:** [Weather data by Open-Meteo.com](https://open-meteo.com/), under
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). The data was changed: scaled to hub
  height and corrected for air density. Behind it is ERA5: generated using Copernicus Climate
  Change Service information; Hersbach et al. (2023), <https://doi.org/10.24381/cds.adbb2d47>.
- **Power curve and assumed losses:** System Advisor Model (SAM), <https://github.com/NREL/SAM>,
  BSD 3-Clause, Copyright (c) 2017, 2022 Alliance for Energy Innovation, LLC. The notice is in
  `data/turbines/NOTICE.md`. The losses are the tool's general defaults, not figures for this farm.
- **Thrust:** contains information from the Open Energy Platform wind turbine library, © Reiner
  Lemoine Institut, made available under the Open Database License (ODbL) 1.0. Only one fitted
  number is taken from it; none of its rows are in this repository.

The farm and the turbine are named as facts. This project is not affiliated with or endorsed by
the farm's owner, Vestas, or any of the agencies and projects above.

Educational model. Not investment, tax or engineering advice.
