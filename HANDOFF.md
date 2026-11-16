# Handoff

## For the finance partner: the energy contract is ready (2026-11-16)
- **Where:** `data/results/energy-contract.json`, on branch `energy/results` (pull request #13) until Dylan merges #8 to #13. To read it now: `git fetch origin && git switch energy/results`. To rebuild it: `uv sync`, then `uv run python -m energy.run`.
- **What goes into the workbook** (finance plan Task 5 Step 3, the three energy placeholders, and `capacity_mw`):

  | Workbook input | Contract field | Value |
  |---|---|---|
  | `energy_p50_mwh` | `energy_mwh.p50` | 298,292 |
  | `energy_p90_mwh` | `energy_mwh.p90` | 273,674 |
  | `energy_p99_mwh` | `energy_mwh.p99` | 253,298 |
  | `capacity_mw` | `farm.capacity_mw` | 78.0 |

  These are the one-year figures. `energy_mwh_10yr` holds the ten-year averages (P50 298,662, P90 282,739, P99 269,617).
- **What the numbers are.** They are net energy at the farm's meter: the model's output scaled by one factor (1.1583) fitted to what the farm reported in 2018 to 2024. So P50 sits at the farm's own average (it reported between 272,706 and 333,060 MWh a year from 2018 to 2025). Do not take losses off again.
- **Read this before sizing debt on P90 or P99.** How far they sit below P50 comes from two spreads: the wind from year to year (5.43%, from 2000 to 2025) and the model's error (3.83%). The 3.83% is the scaled model's worst year of the eight it was compared with (2023), never taken as less than 3%. Dylan widened this on 2026-11-16; the plan first used the held-out year 2025 alone (1.46%, so the 3% floor), which only showed the scaling held that once. Even 3.83% does **not** say the model is accurate: with no scaling and the assumed losses taken off, the model was 24.92% below what the farm reported, most likely because the wind data reads low at this site. The scaled model's yearly error ranged from −2.89% to +3.83%, drifting upward (the farm made a little less each year relative to the model), and seven of the eight years were used to fit the factor. So these P90 and P99 describe **this farm, given its own operating record**. They are tighter than anything that could have been claimed before it was built.
- Educational model: not investment, tax or engineering advice.

## Pick up here (paused 2026-11-15)
- **Done:** farm chosen (Black Oak Getty, MN), energy plan Tasks 0 to 3 built. Two pull requests are open and wait on the finance partner's review, then Dylan's merge: **#8** (`energy/setup` into `main`) and **#9** (`energy/turbine` into `energy/setup`; merge #8 first). Working tree clean, everything pushed. `uv run pytest energy`: 57 passed. No due date: steady work.
- **Next:** energy plan **Task 4, geometry and the wake** (`energy/geometry.py`, `energy/wake.py`), on a new branch from `energy/turbine`; it does not need the merges. Open, none blocking Task 4: both display names in `site/src/content/site.ts`; the turbine database's acknowledgment wording, to copy in a browser from `https://energy.usgs.gov/uswtdb/`; the ERA5 credit wording, to confirm on the dataset's own page; the data credits in `docs/data-sources.md` on the site before `noindex` comes off, including the Open Energy Platform credit wherever the 0.78 thrust figure is shown; how many hours at this farm fall between the two cut-out speeds (19.98 and 21 m/s); the effect of the light-wind thrust shortfall on wake loss.
- **Site, to fix later (Dylan, 2026-11-15):** a white box shows behind the headline word "air." where no wind passes through it. Cause, read from the code and not yet reproduced in a test: that word is a calm zone (`data-calm` in `site/src/components/Hero.astro`, cleared in `site/src/scripts/hero.ts`), put there on purpose because the orange is only 3.11:1 on white and fails contrast with air behind it. A fix has to make the cleared area less visible as a box (a soft edge, or a shape that follows the letters) while `e2e/audit.spec.ts` still passes its contrast check. The hint line and the readouts are calm zones too; check whether they show the same box.

## State update (2026-11-16, model sigma widened)
- **Done:** Dylan chose to widen the model's error behind P90 and P99. `sigma_model` is now the calibrated model's worst yearly error over every year compared, floor 3%: **0.0383** (2023), was 0.03. Code, tests, the plan and the result files updated; `uv run pytest energy`: 124 passed. **One year, MWh: P50 298,292, P75 285,340, P90 273,674, P99 253,298. Ten years: P50 298,662, P75 290,268, P90 282,739, P99 269,617.** These replace the figures in the Task 7 entry below. Validation numbers are unchanged. On branch `energy/results`, pull request #13.
- **Next:** energy plan Task 8, the TypeScript version in `core/src/energy/`. The finance partner uses the figures in the note at the top of this file.

## State update (2026-11-16, energy task 7)
- **Done:** energy plan Task 7 built: `energy/uncertainty.py`, `energy/export.py`, `energy/run.py`, with tests. `uv run pytest energy`: 122 passed. `uv run python -m energy.run` now goes from the cached downloads to all five files in `data/results/` and `data/fixtures/energy-cases.json` (largest 25 KB), and reproduces the Task 6 numbers exactly. Long-term series 2000 to 2025: year-to-year sigma 0.0543, model sigma 0.03 (the floor). **One year, MWh: P50 298,395, P75 286,237, P90 275,221, P99 256,190. Ten years: P50 298,603, P75 291,730, P90 285,484, P99 274,664.** Wake loss over 2000 to 2025: 5.59%. **Not committed yet** (this entry and the diagnosis entry below included).
- **Next:** committed and pushed as pull request #13; pull request #12's wording corrected. The model sigma was then widened (entry above). Then energy plan Task 8, the TypeScript version in `core/src/energy/`.

## State update (2026-11-16, why the model runs low: diagnosis only, nothing changed)
- **Done:** read-only checks on the −24.92% blind error; no model code changed. **Correction to the entry below and to pull request #12: before losses the model is 13.5% below the reported total (reported is 15.8% above modelled), not "16% low".** Sizes, each alone: removing every wake leaves it 8.5% low; removing the shear correction leaves it 8.0% low; reversing the wind direction changes the total by nothing, so direction is not the cause (and the total cannot test the convention). Wind speed 8% higher (about 0.5 m/s at hub height) closes the gap before losses. The shortfall is seasonal: reported ÷ modelled is 1.24 to 1.26 in May to July and 1.09 to 1.10 in December and January. Wind is served from the ERA5 point at 45.75 N 95.00 W, 11 km north of the farm centre. Most likely cause: the ERA5 wind is too low here; one published comparison found about −1 m/s at a site in Oklahoma (Wind Energy Science, 7, 487, 2022). Not established for this site.
- **Next:** Dylan decides whether to test the wind data against an independent free source (its licence read first), or leave the finding as a stated limitation. Either way the blind result stays as measured. Then plan Task 7.

## State update (2026-11-16, energy task 6, real farm run)
- **Done:** losses fixed and committed first (`abff603` on branch `energy/validate`, not pushed), then the real farm was run, 2018 to 2025, 96 months, none excluded. **As measured: blind error −24.92%** (the model is below what the farm reported, with assumed losses of 13.19%); **calibration factor 1.1583** from 2018 to 2024; **held-out 2025: annual error +1.46%, monthly mean absolute error 5.53%, R² 0.913.** Wake loss over the period 5.50%; modelled waked capacity factor 37.5%. Reported ÷ modelled by year runs from 1.116 to 1.193. Nothing was adjusted. The run used a throwaway script; `energy/run.py` (plan Task 7) will make it one command.
- **Next:** Dylan approves the push and pull request for Task 6, with these numbers in its description as measured. The blind error is just inside the plan's 25% line for the Step 4 checks; the quick ones (39 turbines, 78 MW, centre 45.65 N 95.01 W, 70,128 wind hours with none missing, units checked on parse) found nothing wrong. Worth understanding before launch why the model runs about 16% low before any losses (the wind data, the shear exponent and the power curve are the candidates). Then plan Task 7, uncertainty and the result files.

## State update (2026-11-16, energy task 6, steps 1 and 2)
- **Done:** `energy/validate.py` and 18 tests in `energy/tests/test_validate.py`, on synthetic series only. `uv run pytest energy`: 104 passed. **Not committed, and the real farm has not been run**: the plan needs the assumed losses fixed and committed first. A source with per-category figures was found: SAM's default wind inputs (`deploy/runtime/defaults/Wind Power_Single Owner.json` in `github.com/NREL/SAM`, read 2026-11-16) give availability 5.50%, electrical 2.01%, turbine performance 3.95%, environmental 2.40% (13.19% together) and a separate 2.80% for curtailment. The plan's 3 / 2 / 2 / 2 (8.70%) has no per-category source yet.
- **Decided (Dylan, 2026-11-16):** SAM's four categories, 13.19%. Written into `energy/validate.py`, its test, the plan and `docs/data-sources.md`. `uv run pytest energy`: 104 passed. Still not committed; the real farm still not run.
- **Next:** Dylan approves creating branch `energy/validate` and committing this, so the history shows the losses were fixed first. Then run the real farm (plan Task 6 Step 3b) and report the numbers as they come out.

## State update (2026-11-16, energy task 5)
- **Done:** energy plan Task 5 built on branch `energy/farm` (on top of `energy/wake`): `energy/farm.py` (waked speed at each turbine, farm power, the 72 × 61 direction and speed table, hourly lookup, monthly energy and coverage) and 14 tests in `energy/tests/test_farm.py`. `uv run pytest energy`: 86 passed. The real farm's table (39 turbines) builds in 0.78 s against the plan's 60 s limit. **Not committed yet.**
- **Next:** Dylan approves the commit, push and pull request for Task 5. Then energy plan Task 6, calibrate and test on a held-out year. The open items listed above are unchanged.

## State update (2026-11-16, energy task 4)
- **Done:** energy plan Task 4 built: `energy/geometry.py` (local metres, downwind and crosswind distances) and `energy/wake.py` (Jensen deficit, two-circle overlap, root-sum-square), 15 new tests at the plan's values. `uv run pytest energy`: 72 passed. **Not committed yet**; proposed branch `energy/wake` from `energy/turbine`.
- **Next:** Dylan approves the branch, commit and pull request for Task 4. Then energy plan Task 5, the farm (direction × speed table). The open items listed above are unchanged.

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
