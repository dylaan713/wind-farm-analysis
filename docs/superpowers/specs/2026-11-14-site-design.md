# Site design

Date: 2026-11-14 · Status: **direction and outline approved by Dylan 2026-11-14; this written
design awaits his read-through** · Parent: `2026-11-14-wind-farm-design.md` (section 8)

Reference mockup, live and interactive: **`docs/design/first-screen-mockup-colour.html`** (open it
in a browser). It shows the idea, the palette and the reactions, not final type, spacing or copy.
The earlier grey-and-orange version is kept beside it as `first-screen-mockup.html`.

## What Dylan decided

- Someone should be **shocked by how interactive and how well made** the site is.
- White, orange, bright. Cooler rather than warm. It should embrace clean energy.
- First screen: idea A in its landscape form — a sky of moving air the visitor pushes, a low sun,
  hills, three turbines, a live energy meter, chapters that fill as energy is made. He tried a
  more abstract version and came back to the landscape.
- **Lean into colour theory, be more creative, reactivity matters** (2026-11-14). He approved the
  blue-and-orange mockup that followed.
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

> **Changed 2026-11-16, decided by Dylan from rendered candidates** (screenshots of the real first
> screen in each palette and scene; kept on Dylan's machine, not in the repo).
> Where this note and the text below it disagree, this note is what is built.
>
> - **The colours are tuned, not replaced.** Blue is still air and orange is still energy.
>   Air `#0684F9`, signal `#F54E00`, surface `#EFF5FB`, third `#5A687D`, small orange text
>   `#BD3C00`, far turbines `#34506F` (darker, by request). Two new roles: sky `#E4F1FE` (the air
>   colour at 11% over the ground, the deepest the sky gets) and far hill `#C8E4FE` (22%).
> - **There is no sun.** "The sun is the only warm thing on the page" no longer holds. Orange now
>   appears only where energy is: the wake behind each rotor, the hubs, the energy travelling
>   along the cable, the filled chapter links, and the headline word.
> - **Less white.** The sky is tinted from the top down to the foot of the scene, the far hill
>   and the ground are filled, and the ground fades to the page's white at the bottom.
> - **No grass.** The ridge carries a cable from the near turbine to the left edge, with the
>   energy shown as orange dots travelling along it.
> - **More wind**: 520 streaks on a phone and 1,200 on a laptop (were 340 and 680), each with a
>   longer trail. 700 on a phone scored 76 on Lighthouse mobile; 520 scores 100.
> - **Wakes widen.** Air that crossed a rotor above the hub drifts up, below it drifts down, at
>   four times the farm model's rate so it can be seen. The code says so.
> - **Text sits on the moving air itself: no boxes.** Nothing is erased behind text and no air is
>   held back from it. The hint line and the two readings are all in the dark text colour (grey
>   and orange cannot sit on the air), and the air's colours are blended so that no streak is
>   darker than the plain blue. A side effect: a wake fading from orange back to blue passes
>   through pink-violet where it used to pass through a dull purple. During the demonstration
>   gust the hint's bold words are underlined; they used to turn orange.
> - **The top bar is unchanged**: a soft pale backing, and the one remaining patch where no air is
>   drawn, behind the meter, whose number is orange. A solid bar was tried and rejected.
> - **The headline word is no longer a calm zone.** The air runs up to its letters. Because
>   orange and the air are equally bright, each letter is outlined 5 px outside its edge in the
>   colour of the sky behind it, which hides the air only where it would touch a letter. The
>   audit test for this word changed with it: it used to check every canvas pixel behind the
>   word's box; it now reads a real screenshot and checks the pixels beside each letter, still
>   at 3:1, still while the wind is pushed across it.
> - **The meter's number uses the deep orange at every size**, because it sits on the sky.
>
> Contrast, computed by script on 2026-11-16 from `site/src/lib/palette.ts`:
>
> | Pair | Ratio |
> |---|---|
> | ink on ground | 18.75 |
> | ink on surface | 17.07 |
> | ink on sky | 16.35 |
> | third on ground | 5.66 |
> | third on surface | 5.15 |
> | third on sky | 4.93 |
> | ink on signal | 5.33 |
> | ink on air | 5.07 |
> | airDeep on ground | 5.90 |
> | airDeep on surface | 5.37 |
> | airDeep on sky | 5.15 |
> | signalDeep on ground | 5.51 |
> | signalDeep on surface | 5.02 |
> | signalDeep on sky | 4.81 |
> | signal on ground | 3.52 |
> | signal on sky | 3.07 |
> | air on ground | 3.70 |
> | signal on air | 1.05 |
>
> Signal on air (1.05) stays banned for text and thin shapes.

**The scheme is a complementary pair: blue and orange, opposite each other on the colour wheel**
(approved by Dylan from the second mockup, 2026-11-14). Three rules follow from that choice.

- **Blue is air, orange is energy.** Wind arrives blue. Passing through a rotor it turns orange and
  slows, because the turbine took its energy, then fades back to blue. The colour change is the
  physics, and it is the same wake the farm model calculates.
- **Warm light, cool shadows.** The sun is the only warm thing on the page. Sky, far hill and cast
  shadows lean blue. Opposites side by side make each other look stronger, so the page reads
  brighter without any dark area.
- **One scale for every chart:** blue through white to orange. It shows wake loss, and where the
  model ran under or over the real farm. It passes through white and darkens toward both ends, so
  it still reads without colour vision.

| Role | Token | Hex | Its one job |
|---|---|---|---|
| Ground | `--ground` | `#FFFFFF` | The page; most of every screen |
| Ink | `--ink` | `#0A1220` | Text, the near turbine, the ground line. A blue-black, so it sits with the air colour |
| Surface | `--surface` | `#E6F1FC` | The far hill; panels behind tools |
| Air | `--air` | `#1890FF` | **Wind that still has its energy.** Streaks, sky tint, shadows, the cool end of charts |
| Signal | `--signal` | `#FF5B14` | **Energy.** The sun, captured wind, wakes, the meter, filled chapters, the warm end of charts |
| Third | `--third` | `#5C6B80` | Secondary text and labels |
| Text-weight blue | `--air-deep` | `#0B62C4` | Blue for small text and links |
| Text-weight orange | `--signal-deep` | `#C2410C` | Orange for small text |

Far turbines are `#7FA6CC`, decorative only.

Contrast, computed by script on 2026-11-14 (WCAG ratio; 4.5 passes for text, 3 for text 24px and up):

| Pair | Ratio | Verdict |
|---|---|---|
| ink on ground | 18.75 | pass |
| ink on surface | 16.38 | pass |
| third on ground | 5.43 | pass |
| third on surface | 4.74 | pass |
| ink on signal | 6.03 | pass |
| ink on air | 5.78 | pass |
| air-deep on ground | 5.90 | pass |
| air-deep on surface | 5.16 | pass |
| signal-deep on ground | 5.18 | pass |
| signal-deep on surface | 4.53 | pass |
| signal on ground | 3.11 | **large text only** (headline word, meter number) |
| air on ground | 3.24 | **large text only** |
| ground on signal, ground on air | 3.11, 3.24 | **large text only**; prefer ink on both |
| signal on surface | 2.72 | **banned for text** |
| signal on air | 1.04 | **banned**: the two are almost the same brightness, so orange text or thin orange shapes on solid blue (or the reverse) vanish. They may meet only as moving streaks and as chart ends separated by white |

One file is the source of truth (`site/src/lib/palette.ts`, mirrored in `tokens.css`). A unit test
computes these pairs and fails if any used pair drops below its threshold or the two files drift.

**Corrected 2026-11-14 after the UI audit.** The first build tested text against the flat ground
token, and that was wrong: a 13% sky tint behind the headline pulled the orange word from 3.11 to
about 2.9, and moving streaks took the hint line under 4.5. Text over the scene now sits in a **calm
zone**: no air is drawn behind it and the tint is erased there, with a soft edge. A browser test
samples the canvas behind each piece of text, still and mid-sweep, and fails below 3.0 for the
orange word or 4.5 for small text.

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

**What answers the wind, everywhere on the page** (all shown in the mockup):
- The headline leans. Each letter bends in the wind the visitor makes and springs back. Only the
  visitor's wind moves type; the background breeze never does, so text at rest is still.
- Press, hold and let go anywhere to charge a gust and send a ring of wind across the screen. A
  ring fills around the finger while it charges, so the gesture explains itself.
- Grass on the ridge bends with the air above it.
- The sun glows brighter the more the farm is making.
- Air turns from blue to orange through every rotor.
- **Left alone for 2.5 seconds, the page sends one gust by itself** from under the hint line and
  lights up the words "press and hold", so a first-time visitor sees what is possible. It never
  happens once the visitor has touched anything. (Added after the audit: the air already moves on
  its own, so nothing told a phone visitor they could push it.)
- A gust needs a hold of about 0.3 seconds; an ordinary tap does nothing.
- With reduced motion or JavaScript off, the hint line is replaced by one saying it is a still view.

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
| 04 | How sure are we | Two results side by side: the blind prediction (losses assumed in advance) and the model calibrated on earlier years and tested on a held-out year. Modelled against reported, month by month, held-out year marked; slide between P50, P90, P99 | The blind error, then the held-out error |
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
- Chapter 04 shows both validation results as measured, and lists every excluded month with its reason.
- **The wording is fixed:** "calibrated on the farm's earlier years, tested on a held-out year". The
  site never says the model "predicted the farm within X%" about the calibrated result; only the
  blind result is called a prediction. The calibration factor is shown as a calibration factor,
  with one sentence on what it absorbs, and is never labeled "losses".
- Not investment, tax or engineering advice; stated in chapter 06 and the footer.

## Ask the owner to check

These need people, so they are not in the gate.

- Show the first screen to five people for ten seconds. Do they say some version of "I moved the
  wind"?
- A real phone, inside the LinkedIn app's browser: does scrolling feel right, and is dragging the
  sky discoverable without the hint?
- Are the orange and the blue right on your own screens? `#FF5B14` and `#1890FF` were picked on a
  mockup, not on a brand.
- Is press-and-hold discoverable on a phone, and does it ever fight with scrolling or text selection?
- Does the finance partner's wording for chapter 05 sound like him?

## Open

- Final name and headline (placeholders are fine for now).
- Whether the far turbines should match the real farm's turbine count or stay at three.
- Not built yet, deferred to the chapter work: the sun climbing as the page scrolls (section 5),
  and the six chapter stubs reworked into a compact index.
- No keyboard way to send a gust. Keyboard scrolling does push the air. A visible "send a gust"
  control is a candidate if this matters.
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
