# wind-farm

A wind farm analysis from the wind to the money: an energy model checked against a real farm's
reported output, a project-finance model built in Excel and matched in tested code, and an
interactive site that presents both.

Status: the site's first screen is built; the energy and finance models are in progress.

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

Educational model. Not investment, tax or engineering advice.
