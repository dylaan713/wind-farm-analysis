# Site design

Date: 2026-11-14 · Status: **direction and outline approved by Dylan 2026-11-14; this written
design awaits his read-through** · Parent: `2026-11-14-wind-farm-design.md` (section 8)

Reference mockup, live and interactive: `docs/design/first-screen-mockup.html` (open it in a
browser). It shows the idea and the palette, not final type, spacing or copy.

## What Dylan decided

- Someone should be **shocked by how interactive and how well made** the site is.
- White, orange, bright. Cooler rather than warm. It should embrace clean energy.
- First screen: idea A in its landscape form — a sky of moving air the visitor pushes, a low sun,
  hills, three turbines, a live energy meter, chapters that fill as energy is made. He tried a
  more abstract version and came back to the landscape.
- The rest-of-page outline below. Working name "wind-farm" and headline "Made of moving air." are
  fine for now.
- Dylan builds most of the site. No AI log.

Everything else in this document is **Claude's call** on the instruction "build it the best way",
made with Dylan's `web-design-craft` method. Each is his to change.

## 1. Lane

No footage or photography exists, so the lane is **one idea drawn in code: you are the wind.**
The page is moving air; the visitor's pointer, finger and scrolling push it, and that wind turns
the turbines, feeds the meter and flows through every chapter.

The one thing a visitor remembers: *the page moved before I clicked anything, and I made the
energy.*

## 2. Palette as roles

| Role | Token | Hex | Its one job |
|---|---|---|---|
| Ground | `--ground` | `#FFFFFF` | The sky and the page. Most of every screen |
| Ink | `--ink` | `#0C1014` | Text, the near turbine, the ground line |
| Surface | `--surface` | `#F1F5F9` | The far hill; panels behind tools |
| Signal | `--signal` | `#FF5B14` | **Energy.** The sun, captured wind, wakes, the meter, filled chapters. Nothing else |
| Third | `--third` | `#667080` | Secondary text and labels; a cool grey that keeps white from going flat |
| Signal, text weight | `--signal-deep` | `#C2410C` | Orange for small text only, where the signal fails contrast |

Decorative, never text: air streaks `rgb(70 92 120)` at low opacity; far turbines `#8794A5`.

Contrast, computed by script on 2026-11-14 (WCAG ratio; 4.5 passes for text, 3 for text 24px and up):

| Text on ground | Ratio | Verdict |
|---|---|---|
| ink on ground | 19.09 | pass |
| ink on surface | 17.43 | pass |
| third on ground | 5.01 | pass |
| third on surface | 4.57 | pass |
| ink on signal | 6.14 | pass |
| signal on ground | 3.11 | **large text only** (headline word, meter number) |
| ground on signal | 3.11 | **large text only**; prefer ink on signal |
| signal-deep on ground | 5.18 | pass |
| signal-deep on surface | 4.73 | pass |
| signal on surface | 2.84 | **banned for text** |
| third on signal | 1.61 | **banned for text** |

One file is the source of truth (`site/src/lib/palette.ts`, mirrored in `tokens.css`). A unit test
computes these pairs and fails if any used pair drops below its threshold or the two files drift.
Text that sits over the moving air is tested against the flat ground token; the streaks stay pale
enough that this holds, and any text block that proves hard to read gets a ground-coloured backing.

## 3. Type

- **Display:** Mona Sans (variable: weight 200–900, width 75–125; free, OFL). Heavy and slightly
  narrow for headlines; tracking tightens as size grows (about −0.05em at the largest). Its
  weight and width axes are what the big numbers animate.
- **Text:** Mona Sans at regular weight.
- **Numerals and labels:** Geist Mono (variable; free, OFL), tabular figures, zero-padded
  readings with units (`07.4 m/s`).
- Sentence case everywhere. A label exists only when it carries information.
- Fonts are self-hosted and subset to Latin. Availability of both packages is confirmed at install
  time; if either is missing, stop and pick again rather than substituting silently.

## 4. Reactive layer

One system for the whole page, wired through data attributes. Declared set: `data-press`,
`data-count`, `data-reveal`, `data-magnetic`. No tilt, no cursor follower: the wind already
follows the pointer.

**Touch first** (recruiters open links on phones):
- Dragging a finger across the sky pushes the wind. Vertical scrolling still works
  (`touch-action: pan-y`), and **scrolling itself is a gust**: scroll speed pushes the air.
- Press-down scale on every control. No vibration; every confirmation is visual.

**Fine pointer:** pointer velocity pushes the wind; magnetic pull on the few plain buttons; hover
states on everything clickable.

**Inside the tools** (dragging turbines, moving sliders) the visitor is doing a task: targets are
at least 44px, turbines snap back inside the site boundary, sliders show their value while moving,
every tool has a reset. No magnetic pull or momentum on anything that sets a value.

The wind field is the centrepiece and is separate from this layer.

## 5. Chrome and arrival

- **Arrival, once, on the first screen:** the sun rises over the horizon while the headline comes
  in line by line and the air starts to move. About 1.2 seconds. If loading ever takes over a
  second, it becomes a loader with a real percentage.
- **After that, motion answers input.** The one ambient state is the air itself: slow, pale,
  paused when offscreen, replaced by a still image under reduced motion.
- **Top bar, always present:** the name on the left; on the right a live reading, **"your wind has
  made 0.00 kWh"**. It is computed from the chosen turbine's real power curve at the wind speed
  the visitor is producing, and is labeled as a demo.
- **The sun tracks scroll.** It climbs from the horizon on the first screen to high in the sky by
  the farm chapter. It never sets; the page stays bright to the end.

## 6. The page

One page, one continuous scene. As you scroll the view changes: the sky, one turbine close up,
the farm from above, then the money.

| # | Chapter | What you do | It ends on one big number |
|---|---|---|---|
| 00 | First screen | Push the wind; turbines spin; the meter runs; chapters fill | — |
| 01 | The wind | Turn a wind rose of the real site; see where the wind comes from and how often | Mean wind speed |
| 02 | One turbine | Scrub the real power curve; change height and air density | One turbine's yearly energy |
| 03 | The farm | Drag turbines on the real layout; orange wakes show losses; turn the wind; reset to the real layout | Farm yearly energy and wake loss |
| 04 | How sure are we | Modelled against reported, month by month, held-out year marked, error stated as measured; slide between P50, P90, P99 | The held-out error |
| 05 | The money | Move power price, loan terms and wind case; tax credit on or off; download the workbook | Loan size, then return |
| 06 | How we built it | Who did what, methods, sources and attributions, disclaimer, link to the code | "While you were here, the real farm made about X" |

- **Big numbers** (idea C): each fills the screen in display type, can be slid left and right to
  change its main input, and its weight and width follow the value. `data-count` drives them.
- **Chapter 03** is idea B, running `farmPowerKw` from `core/src/energy`. Chapter 05 runs
  `runFinance` from `core/src/finance`. Chapters 01, 02 and 04 read the files in `data/results/`.
- **Three labels on every chapter**, from one data file: who owned it · how AI was used · how it
  was checked.
- **Closing line** uses the real farm's modelled average output and the time spent on the page. It
  is labeled a model estimate.

**Layout, phone first.** Text measure 34 to 38 characters on a phone, 68 at most on desktop.
Gutters 16px on a phone, 48px on desktop. Breakpoints at 640px and 1024px. On a phone every
control sits in the lower 40% of the screen, in thumb reach, with its result above it. Heights use
`svh`/`dvh`, never `vh`, because the link will be opened inside LinkedIn's and other in-app
browsers. Nothing needs a sensor permission.

## 7. Fallbacks

- **Reduced motion:** the air is a still image drawn once; turbines do not spin; numbers appear
  at their final value; the sun sits at its position for the current scroll. Every tool still works.
- **No JavaScript:** everything is visible. The first screen is a static drawing made at build
  time. Each tool is rendered at build time in its default state with its real default result.
  The meter is hidden, not left at zero.
- **Print:** not designed. The page is not a document people save; the workbook download is.

## 8. Ship gate, as commands

| Check | Command | Passes when |
|---|---|---|
| Types | `npm run check` | 0 errors |
| Unit tests | `npm test` | all pass, including the palette contrast test |
| Browser tests | `npm run e2e` | pass at phone and desktop sizes, with reduced motion, and with JavaScript off; no accessibility violations (axe) |
| JavaScript size | `npm run budget` | first screen 60 KB gzipped or less; whole site 150 KB or less, each tool a separate lazy chunk |
| Lighthouse, mobile | `npm run lighthouse` | performance 90+, accessibility 95+ |
| Data files | part of `npm run budget` | each under 200 KB |

Tooling proposed, all free, **to be installed only with Dylan's approval**: Astro, `@astrojs/check`,
TypeScript, Vitest, Playwright with its Chromium, `@axe-core/playwright`, Lighthouse, and the two
font packages. No animation or smooth-scroll library in the first pass; springs and tweens are
small local utilities, and a library is added only if one earns its bytes.

## How it is built

- `site/` is an Astro project, static output, deployed to GitHub Pages by GitHub Actions.
- It imports the math from `core/src` through a path alias, not a workspace, so the finance
  partner's `core/` package and lockfile are left alone.
- All copy and every fact live in one file, `site/src/content/site.ts`. Nothing is stated that the
  results files, the workbook or the two owners did not say.
- Drawing functions are pure and shared between build time (the no-JavaScript state) and the
  browser. Tool math lives only in `core/`.
- Performance techniques carried from the portfolio: smooth canvas layers painted at reduced
  resolution; every canvas paused offscreen; each tool loaded when it nears the screen; native
  scrolling on touch.

## Honesty rules for this site

- The first-screen turbines and the top-bar meter are a **demo** and say so. They use the real
  turbine's power curve, but the wind is the visitor's.
- Sample figures in the mockup (output, dollars, "phone charges") do not ship. Every number on the
  site comes from `data/results/`, the workbook, or `core/`. An everyday comparison such as phone
  charges ships only with a cited source.
- Chapter 04 shows the held-out error as measured, and lists every excluded month with its reason.
- Not investment, tax or engineering advice; stated in chapter 06 and the footer.

## Ask the owner to check

These need people, so they are not in the gate.

- Show the first screen to five people for ten seconds. Do they say some version of "I moved the
  wind"?
- A real phone, inside the LinkedIn app's browser: does scrolling feel right, and is dragging the
  sky discoverable without the hint?
- Is the orange right on your own screens? `#FF5B14` was picked on a mockup, not on a brand.
- Does the finance partner's wording for chapter 05 sound like him?

## Open

- Final name and headline (placeholders are fine for now).
- Whether the far turbines should match the real farm's turbine count or stay at three.
- Found on the mockup at phone width and to fix in the build: the top bar wraps to three lines,
  and the chapter label overlaps the ground line.

## Order of work

The site waits on nothing to start: the first screen needs only the palette, type and the wind
field. Chapter 05 can be built now against the finance contract (`core/src/finance/types.ts`).
Chapters 01 to 04 need the energy results, so they are built against sample files with the same
shape and switched to real results when `energy-contract.json` exists.

1. Project, tokens, contrast test, type, top bar, ship-gate scripts.
2. First screen: wind field, scene, meter, arrival, fallbacks.
3. Chapter 05 against the finance contract.
4. Chapters 01 to 04 against sample-shaped files, then real results.
5. Chapter 06, labels, closing line, deploy.

Each step ends with the gate run and shown, then stops for Dylan.
