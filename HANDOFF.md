# Handoff

## Pick up here (paused 2026-11-15)
- **Done:** farm chosen (Black Oak Getty, MN), energy plan Tasks 0 to 3 built. Two pull requests are open and wait on the finance partner's review, then Dylan's merge: **#8** (`energy/setup` into `main`) and **#9** (`energy/turbine` into `energy/setup`; merge #8 first). Working tree clean, everything pushed. `uv run pytest energy`: 57 passed. No due date: steady work.
- **Next:** energy plan **Task 4, geometry and the wake** (`energy/geometry.py`, `energy/wake.py`), on a new branch from `energy/turbine`; it does not need the merges. Open, none blocking Task 4: both display names in `site/src/content/site.ts`; the turbine database's acknowledgment wording, to copy in a browser from `https://energy.usgs.gov/uswtdb/`; the ERA5 credit wording, to confirm on the dataset's own page; the data credits in `docs/data-sources.md` on the site before `noindex` comes off, including the Open Energy Platform credit wherever the 0.78 thrust figure is shown; how many hours at this farm fall between the two cut-out speeds (19.98 and 21 m/s); the effect of the light-wind thrust shortfall on wake loss.

## State update (2026-11-15, thrust correction)
- **Done:** on branch `energy/turbine` (on top of `energy/setup`, pushed, pull request open). The plan's thrust method was measured against 36 turbines with published thrust curves and found about a third low; the model now divides by a rotor-to-grid efficiency of 0.78, fitted on 24 turbines and tested on 12 held-out Vestas ones (`energy/thrust_check.py`, plan updated under "Thrust"). The chosen turbine's thrust at 8 m/s went from 0.54 to 0.81. `uv run pytest energy`: 57 passed.
- **Next:** the finance partner reviews the pull request for `energy/turbine` (it sits on top of #8, so #8 merges first). Then energy plan Task 4, geometry and the wake. Still open: both display names in `site/src/content/site.ts`; the turbine database's acknowledgment wording, to copy in a browser; data credits on the site before launch.

## State update (2026-11-15, farm chosen, energy task 3)
- **Done:** Dylan chose **Black Oak Getty, MN**. No due date: steady work. Licences read for all four data sources and the turbine library, recorded in `docs/data-sources.md`. Single-turbine model built (`energy/turbine.py`) with the farm's power curve transcribed and its licence notice kept (`data/turbines/`). `uv run pytest energy`: 50 passed. **Not committed yet.**
- **Next:** Dylan decides where this is committed (pull request #8 or a new branch on top of it). Then energy plan Task 4, geometry and the wake, after settling the thrust question in `docs/farm-selection.md` (derived thrust is likely too low). Still open: both display names in `site/src/content/site.ts`; the turbine database's acknowledgment wording, to copy in a browser; data credits on the site before launch.

## State update (2026-11-14, energy tasks 0 to 2)
- **Done:** site and energy-plan fix merged to `main` (pull requests #4 to #7). On branch `energy/setup` (pull request #8): Python project (`uv`, Python 3.12), the three data sources confirmed and recorded in `docs/data-sources.md`, cached downloaders with tests, farm-selection rules with tests, and a shortlist of five farms in `docs/farm-selection.md`. Wind requests are pinned to ERA5 after finding the service silently switches model in 2017. `uv run pytest energy`: 25 passed.
- **Next:** **Dylan picks the farm** (recommendation: Black Oak Getty, MN). Then energy plan Task 3 onward: transcribe and check the turbine's power curve (read the library's licence first), single-turbine model, wake model, farm, validation. Still open: both display names in `site/src/content/site.ts`; a date it must be showable by; Open-Meteo's licence terms.

## State update (2026-11-14, audits and fixes)
- **Done:** correctness and UI audits run on `site/polish`; every critical and important finding fixed with a test (`site/e2e/audit.spec.ts`): the orange headline word failing contrast, text contrast over moving air, the scroll-then-move phantom gust, short-landscape, zoom and 320px layouts, the screen-reader summary, a residue in the sky, readouts inside the blades, and weak or timing-fragile tests. Added a self-starting demo gust and a larger phone headline. Gate: check 0 errors, test 84 passed, e2e 94 passed and 16 skipped, budget 7.4 KB, Lighthouse mobile 100 / 100 / 96.
- **Next:** Dylan tries it on a real phone, then merges pull request #7 (it contains #5 and #6) and #4. Deferred: the sun climbing with scroll, the chapter stubs as a compact index, a keyboard gust. Then his energy plan from Task 0. Still open: both display names in `site/src/content/site.ts`; a date it must be showable by.

## State update (2026-11-14, site wave 3)
- **Done:** site plan tasks 7-9 on branch `site/polish`: meter tests and phone layout, leaning headline, press, magnetic and reveal behaviours, the once-per-visit arrival, the size and Lighthouse gate scripts, and CI. The first screen was restructured into cheaper layers after Lighthouse mobile scored 71; it now scores 100. Gate: check 0 errors, test 71 passed, e2e 73 passed and 9 skipped, budget 5.9 KB, Lighthouse mobile 100 / 100 / 96. The site plan (part 1) is complete.
- **Next:** Dylan tries it on a laptop and a real phone, then merges the site pull request and #4. Then: his energy plan from Task 0 (the chapters need its results), both display names in `site/src/content/site.ts`, and a plan for the first chapter tool. Still open: a date it must be showable by.

## State update (2026-11-14, site waves 1 and 2)
- **Done:** site plan tasks 0-6 built on branches `site/foundation` (pull request #5) and `site/first-screen` (#6, stacked on #5): project, palette with contrast test, page shell, static drawing, wind and particle math, and the live first screen. Gate at `site/first-screen`: `npm run check` 0 errors, `npm test` 70 passed, `npm run e2e` 46 passed and 4 skipped; JavaScript 4.6 KB gzipped. Energy plan now requires a monthly-reporting farm (#4).
- **Next:** Dylan tries the first screen on a laptop and a phone (`cd site && npm run dev -- --host`), then merges #4, #5, #6 in that order. Then wave 3, plan tasks 7-9: meter tests, leaning headline, arrival, budget, Lighthouse and CI. Still open: both display names in `site/src/content/site.ts`; a date it must be showable by.

## State update (2026-11-14, validation wording and colour)
- **Done:** pull requests #1 (finance contract) and #2 (energy plan, site design, merging rule) merged. Energy plan now produces two results, a blind prediction and a model calibrated on earlier years and tested on a held-out year, with fixed wording for how to describe them. Site design updated to the approved blue-and-orange scheme and the added reactions.
- **Also done:** site build plan, part 1 (foundation and first screen), written.
- **Next:** Dylan merges pull request #3; approves the site tooling list (plan Task 0) before anything is installed; picks the farm at energy plan Task 2. Still open: a date it must be showable by.

## State update (2026-11-14, plans and site design)
- **Done:** finance partner accepted the invite and opened pull request #1 (finance contract); it was checked out and run here (`npm test` 1 passed, `npm run check` 0 errors) and matches the plan. Energy-side plan written (`docs/superpowers/plans/2026-11-14-energy-side.md`). Site direction chosen from mockups and written up (`docs/superpowers/specs/2026-11-14-site-design.md`, mockup in `docs/design/`).
- **Next:** Dylan reviews and merges pull request #1; reads the site design; picks the farm at energy plan Task 2. Then a step-by-step plan for the site build, and approval of its tooling before anything is installed. Still open: a date it must be showable by.

## State update (2026-11-14, capability install)
- **Done:** finance partner invited with write access (pending his acceptance); six project-scoped skills installed and recorded in `.claude/CAPABILITY.md`; `CLAUDE.md` added. No source exists yet, so there was no test gate to run.
- **Next:** partner starts the finance plan at Task 0; design round for the site's look, with mockups, before any site code; re-check the skill set at the first real `package.json`. Still open: a date it must be showable by.

## State update (2026-11-14, repo created)
- **Done:** design approved in outline (hybrid build; no AI log; Dylan builds most of the site); finance-side plan written; private repo created and pushed.
- **Next:** invite the finance partner (needs his GitHub username) so he can start the plan at Task 0; run project intake to propose Claude Code skills for the repo; design round for the site's look before any site code. Still open: a date it must be showable by.
