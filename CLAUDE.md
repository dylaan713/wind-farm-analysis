# wind-farm

A wind farm analysis from the wind to the money, built by two people: an energy model checked
against a real farm's reported output, a project-finance model built in Excel and matched in
tested code, and an interactive site. **Read `HANDOFF.md` first.**

- Design: `docs/superpowers/specs/2026-11-14-wind-farm-design.md`
- Finance plan: `docs/superpowers/plans/2026-11-14-finance-side.md`
- Energy plan: `docs/superpowers/plans/2026-11-14-energy-side.md`
- Site design: `docs/superpowers/specs/2026-11-14-site-design.md` (mockup: `docs/design/first-screen-mockup-colour.html`)
- Site plan, part 1: `docs/superpowers/plans/2026-11-14-site-foundation-and-first-screen.md`

Status 2026-11-14: the site's first screen is built (`site/`), the finance contract exists
(`core/`), and the energy and finance models are not started.

## Commands
- **Site** (`cd site`): `npm run dev` · `npm run check` · `npm test` · `npm run build` · `npm run e2e`
  (Playwright, laptop and phone) · `npm run budget` · `npm run lighthouse`
- **Core** (`cd core`): `npm test` · `npm run check`
- e2e needs Playwright's Chromium (`npx playwright install chromium`, free). Lighthouse needs Chrome installed.

## Definition of done for site changes
All six pass, and the output is shown: `check` 0 errors · `test` · `build` · `e2e` · `budget` (first
screen 60 KB gzipped JavaScript, whole site 150 KB) · `lighthouse` (mobile performance 90,
accessibility 95). Measured 2026-11-14 on `site/polish` after the audit fixes: check 0 errors; test 84
  passed; e2e 94 passed, 15 skipped (single-layout tests); budget 7.4 KB; Lighthouse mobile 100 / 100.

## Site rules
- Colour comes only from `site/src/lib/palette.ts`; a test fails on any other hex value in `site/src`.
- All copy and facts live in `site/src/content/site.ts`. The `ai` and `checked` labels are written
  by the chapter's owner, never by an agent.
- Anything calculated is a pure function in `site/src/lib/` with a test beside it; `scripts/hero.ts`
  only reads input and draws. Tool math comes from `core/` through the `@core` alias.
- The first-screen meter and turbines are a demo and are labeled so. No sample figures ship.
- Per-frame drawing is kept cheap on purpose (see the layer comment in `scripts/hero.ts`): the
  first version scored 71 on Lighthouse mobile until the hills were made static, the air canvas
  dropped to one pixel per CSS pixel, and the top bar's backdrop blur was removed.
- `index.astro` carries `noindex` while the repo is private. Remove it at launch.
- **Text over the scene sits in a calm zone** (`data-calm`): no air is drawn behind it and the sky tint
  is erased there. The orange headline word is only 3.11:1 on pure white, so anything behind it fails
  it. `e2e/audit.spec.ts` samples the canvas behind each piece of text and fails if contrast drops.
- The air fades by mixing toward white plus one whole level a frame (`lib/zones.ts`), so nothing is
  left behind. A plain percentage fade leaves a visible residue.
- `e2e/audit.spec.ts` holds one test per defect the 2026-11-14 audits found. Keep it passing.

## Hard rules
- Free only. No paid tiers, trials needing a card, or metered API keys.
- **Dylan manages this repo and does all merging.** Everyone else, and any agent working for them,
  works on a branch, pushes it, opens a pull request and stops there. Never merge a pull request,
  never push or commit to `main`, never force-push, never delete a branch you did not create, and
  never change repo settings. If something is blocked waiting on a merge, say so in the pull
  request and wait. (Dylan, 2026-11-14. GitHub does not enforce this while the repo is private,
  so it is on each person and agent to keep it.)
- Pull requests get a review from the other person before Dylan merges.
- Only the finance partner edits `finance/model.xlsx`.
- The repo will be public. Commit with a GitHub noreply email. No secrets; `.env` stays untracked.
- Nothing is published that its owner cannot explain, and no skill is credited to someone who
  did not use it. The validation error is published as measured, and described as "calibrated
  on earlier years, tested on a held-out year" — never as a from-scratch prediction.
- Educational model: not investment, tax or engineering advice.

## Capability
Six project-scoped skills in `.claude/skills/` (Python, TypeScript, accessibility, Playwright,
verification). The site's quality bar is Dylan's global `web-design-craft` skill, not copied here.
The installed set, the deferred set and the rejected set with reasons are in `.claude/CAPABILITY.md`.
