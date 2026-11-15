# Wind farm project: design

Date: 2026-11-14 · Status: **approved in outline by Dylan 2026-11-14, with two changes: no AI log; Dylan builds most of the site** · Working name: "wind-farm" (real name is open)

People: **Dylan** (mechanical engineering; owns the energy side and teaches the AI workflow) and
**the finance partner** (strong in Excel modeling; learning AI use on this project). Both have agreed
to their real names appearing on the public site (Dylan, 2026-11-14). Names stay out of this doc.

## 1. Intent

Build a public, interactive website that presents a wind farm analysis from the wind to the money,
and that both people can put on a resume. The site has two jobs:

1. Show a real piece of engineering-plus-finance work: predict a real wind farm's energy output,
   quantify the uncertainty, and size the financing a lender would give it.
2. Show that both people can **direct AI to do technical work and verify what it produces**, in
   engineering and in finance.

## 2. Goals, non-goals, anti-goals

**Goals**
- The energy model's prediction for a real US wind farm is compared against that farm's reported
  generation, and the error is published whatever it turns out to be.
- The finance model exists as the partner's Excel workbook and as tested code that matches it.
- Visitors can change inputs and see results update live (turbine layout, power price, loan terms).
- Every section of the site says who owned it, how AI was used, and how the result was checked.
- Works well on a phone; recruiters open links on phones.
- Costs nothing to build or host.

**Non-goals**
- Not a commercial tool, not investment or tax advice, no user accounts, no data collected.
- Not a site-selection or permitting tool. One farm, studied properly.
- No real-time data. All data is historical and public.

**Anti-goals (would make it a failure even if it works)**
- It reads as "the AI did it and they watched."
- Anything is on the site that its named owner cannot explain out loud in an interview.
- A skill or contribution is credited to someone who did not do it.
- The validation result is tuned, cherry-picked or hidden to look better.

## 3. Constraints

- **Free only.** No paid tiers, no trials needing a card, no metered API keys. All sources below are free.
- **Honesty rule** (carried from Dylan's portfolio): nothing is published that is not true and
  supportable. Tools are labeled as models; assumptions are listed next to results.
- **Secrets:** any data-service key lives in an untracked `.env`; the repo ships `.env.example` only.
- **Commits:** both people use GitHub noreply emails; the repo will be public.
- **Disclaimer:** "educational model, not investment, tax or engineering advice" on the site and README.
- **No employer material** from either person's job.

## 4. Approaches considered

| | What | Verdict |
|---|---|---|
| 1. Results explorer | All work offline; site only displays precomputed scenarios | Rejected: not really interactive; Excel never becomes anything else, so the partner's AI story is thin |
| **2. Hybrid** | Heavy work offline in Python; small tested TypeScript versions of the core math run live in the browser; Excel is the finance reference the code must match | **Picked by Dylan, 2026-11-14** |
| 3. Everything in the browser | Whole model incl. Monte Carlo runs on the visitor's device | Rejected: most work, large downloads on phones, no role for Excel |

Dylan also said: build it the best way, not limited by how earlier projects were built. The calls
in sections 5 to 9 are **Claude's calls on that basis**, not things Dylan specified.

## 5. Architecture

```
/energy      Python. Data download, turbine + farm model, validation, uncertainty   (Dylan)
/finance     model.xlsx (the reference) + fixture extractor                         (partner)
/core        TypeScript. Small pure-math versions of the pieces that run live       (energy: Dylan · finance: partner)
/site        Astro site. Story, drawings, interactive tools                         (Dylan)
/data        Small committed result files (JSON). Raw downloads are git-ignored
/docs        Specs, plans, study notes, farm-selection memo
```

**Flow**

```
public data → /energy (Python) → results JSON ─┬→ /site (shown, and used as defaults)
                                               └→ /finance model.xlsx (annual energy, P-values)
model.xlsx → Scenarios sheet → fixtures JSON → tests for /core finance code
/energy    → fixtures JSON                  → tests for /core energy code
/core (TypeScript) → runs live in /site
```

**The two contracts** (agree these first; they let both people work in parallel)
1. *Energy → finance:* one JSON file: net annual energy at P50, P75, P90, P99 (1-year and 10-year),
   a 12-month production shape, capacity, turbine count, and the assumptions used.
2. *Reference → code:* fixture files of input/output cases. `/core` must reproduce Python results
   within 0.5% and Excel results to the cent.

**Stack calls (Claude's)**
- Python 3.12+, managed with `uv`; numpy, pandas, pytest. Notebooks allowed for exploration only;
  anything a result depends on lives in tested modules.
- Site: Astro, TypeScript, static output. Chosen on merit: the site is mostly a scrolling story with
  a few interactive tools, which is what Astro is best at. Drawings in canvas/SVG, written by hand
  or with small D3 modules; no heavy chart or 3D library.
- Tests: pytest, vitest, Playwright (desktop and phone), axe for accessibility.
- Hosting: GitHub Pages deployed by GitHub Actions from the shared repo, so neither person's
  personal hosting account owns the site.
- Budgets: 150 KB gzipped JavaScript total, each tool lazy-loaded; each data file under 200 KB;
  Lighthouse mobile performance 90+, accessibility 95+; WCAG AA.
- Every tool renders its default result at build time, so the page is complete without JavaScript.

## 6. Energy side (Dylan)

1. **Wind resource.** Hourly wind at or near hub height for the farm's location, for years that
   **overlap the farm's reported generation**. Candidates: ERA5 reanalysis (free, 1940 to present,
   100 m winds, coarse grid) and the WIND Toolkit from the lab formerly called NREL, renamed the
   National Laboratory of the Rockies in December 2025 (finer grid, limited years; current download
   location must be confirmed). Builder picks after proving access to both.
2. **One turbine.** Height adjustment (shear), air-density correction, manufacturer power curve.
3. **The farm.** Real turbine positions and model from the US Wind Turbine Database (USGS). Wake
   losses with a hand-written Jensen/Park model. Then availability and electrical losses.
4. **Validation.** Compare modeled monthly net generation with EIA Form 923 for the same months.
   Loss assumptions are set using some years and **tested on a held-out year**. Publish the error.
5. **Uncertainty.** Monte Carlo over year-to-year wind variability and model error, producing the
   P-values in contract 1.
6. **Live version in `/core`.** Annual energy from a binned wind rose (speed × direction table) plus
   the wake model. This is the standard industry shortcut and is cheap enough for a phone.

**Farm selection criteria** (wave 0 memo, Dylan approves the choice): flat terrain; one turbine
model; at least four full operating years in EIA data; no known repowering or long outage in those
years; between roughly 20 and 150 turbines.

**Stretch:** derive the power curve from blade geometry with blade element momentum theory and
compare with the manufacturer's curve; layout optimizer that reports the dollar value of reduced
wake losses.

## 7. Finance side (partner)

- **`model.xlsx` is the reference.** Only the partner edits it (binary files do not merge).
- Contents: construction and operating costs (from the lab's Annual Technology Baseline and the
  LBNL Land-Based Wind Market Report, both free, cited in the workbook); revenue from a fixed-price
  power contract; debt sized so loan payments are covered with a cushion on low-wind (P90/P99)
  output; investor return (IRR); lifetime cost of energy (LCOE); sensitivity table.
- **Tax credit scenario toggle.** Under the July 2025 law, wind projects that did not begin
  construction by 4 July 2026 must be in service by end of 2027 to get the credit, so a farm
  started today effectively gets none. The model shows "with credit (how existing farms were
  financed)" against "without (current rules for a new project)". Re-verify before publishing;
  a June 2026 court action was reported and the rules may have moved.
- **Scenarios sheet:** about 10 input cases with Excel's own computed outputs. A small Python
  script reads the saved values into fixture JSON. No Excel automation needed.
- **Port to `/core`:** the partner, with AI and Dylan teaching, writes the TypeScript cash-flow and
  debt-sizing code. It must match every scenario to the cent. The workbook is downloadable on the site.

## 8. The site

- **Story order:** the wind → one turbine → the farm → how sure are we (validation, P50/P90) →
  the money → how we built it.
- **Live tools:** (a) drag turbines, see wake losses and annual energy change; (b) move power price,
  loan terms and wind case, see loan size, IRR and LCOE change; (c) validation chart, modeled
  against reported, month by month.
- **Three labels on every section**, from one data file (`site/src/content/credits.ts`):
  *who owned it · how AI was used · how it was checked.*
- **No AI log** (dropped by Dylan, 2026-11-14). The three labels carry the AI story.
- **Dylan builds most of the site.** The partner supplies the finance math in `/core`, the
  workbook, and the wording for the finance sections.
- **Study notes** per module (`docs/notes/`): the owner's own explanation of the method. A section
  ships only when its owner can explain it without the notes.
- **Look and feel is not designed here.** It gets its own design round with mockups before wave 3:
  same craft as Dylan's portfolio, its own identity (Dylan, 2026-11-14).

## 9. Working together

- Free GitHub organization, both as owners. Repo private until wave 3 ships, then public.
- `main` protected; work on branches; the other person reviews every pull request.
- The partner works through Claude Code too. His first pull requests are small on purpose: the
  workbook, then the Scenarios sheet, then the finance port.
- Issues and a project board; a short weekly check-in.

## 10. Waves

Each wave ends with something to show, then stops for Dylan's go-ahead.

| Wave | Energy (Dylan) | Finance (partner) | Ends with |
|---|---|---|---|
| 0. Setup | Repo, CI, prove access to each data source, farm-selection memo | GitHub + Claude Code set up; workbook skeleton | Chosen farm; both can open a pull request |
| 1. First models | Turbine + farm model; first comparison with reported generation | Excel model v1 on a placeholder energy number | Validation chart; working workbook |
| 2. Join them | Uncertainty → contract 1; `/core` energy code matching Python | Consumes contract 1; Scenarios sheet; `/core` finance code matching Excel | One command runs wind → money; all match tests green |
| 3. The site | Design round, then story, tools, labels | Reviews the finance sections and supplies their wording | Public site and public repo |
| 4. Stretch | Blade theory power curve; layout optimizer | Dollar value of layout gains | Added sections |

## 11. Open, for Dylan and the partner

1. A real name for the project and the GitHub organization.
2. Is there a date this needs to be showable by (an application deadline, a career fair)?
3. ~~Does the partner have a GitHub account and access to Claude Code yet?~~ Yes to both (Dylan, 2026-11-14).

## 12. Left to the builder

Choice between ERA5 and the WIND Toolkit; exact loss values; Monte Carlo design; file formats
inside the contracts; drawing technique for each tool; test case selection.

## 13. Facts to re-check at build time

- Where the WIND Toolkit download and API now live after the lab's rename.
- Current wind tax-credit rules and the outcome of the June 2026 court action.
- That the chosen farm's EIA data has no unexplained gaps.
