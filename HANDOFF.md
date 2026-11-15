# Handoff

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
