# Site Foundation and First Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A working, tested site shell with the full first screen: a sky of moving air the visitor pushes, the blue-to-orange energy conversion, the turbines, the live meter, and every fallback, passing the ship gate on a phone and a desktop.

**Architecture:** An Astro static site in `site/`. Everything that can be calculated is a pure function in `site/src/lib/` with a unit test beside it; one small controller script draws those results to two canvases. The same pure functions produce a static SVG at build time, which is what people see with JavaScript off or reduced motion on. Chapters 01 to 06 are honest stubs in this plan; each gets its own plan when its data exists.

**Tech Stack:** Astro, TypeScript, Vitest, Playwright with `@axe-core/playwright`, Lighthouse; fonts Mona Sans and Geist Mono (variable, self-hosted). All free.

**Spec:** `docs/superpowers/specs/2026-11-14-site-design.md`. Visual reference, live: `docs/design/first-screen-mockup-colour.html`. Where this plan gives a constant, it comes from that mockup.

## Scope

This plan covers steps 1 and 2 of the design's "Order of work". Not in it: the chapter tools (01 to 05), the closing line, and deployment. GitHub Pages on a free account needs a public repo, so deployment waits until the repo goes public.

## Global Constraints

- Free only. No paid tiers, trials needing a card, or metered API keys.
- **Nothing is installed until Dylan approves the list in Task 0.**
- Work on a branch, push it, open a pull request and stop. **Dylan does all merging.** Never commit or push to `main`.
- This plan touches only `site/`, `.github/workflows/ci.yml`, `README.md` and `HANDOFF.md`. `core/`, `finance/` and `energy/` belong to their own plans.
- Colours come only from `site/src/lib/palette.ts`. No hex value anywhere else in `site/src` except `tokens.css`, which a test keeps in step.
- All copy and every fact live in `site/src/content/site.ts`. Nothing is stated that the results files, the workbook or the two owners did not say. No sample figure from the mockup ships: no dollars, no "phone charges", no farm numbers.
- The first-screen turbines and meter are labeled a demo. Exact strings are in Task 2.
- Orange on blue, or blue on orange, is never used for text or thin shapes on a solid fill (contrast 1.04).
- Heights use `svh` or `dvh`, never `vh`. Nothing needs a sensor permission or vibration.
- No animation, smooth-scroll, chart or 3D library. Springs and tweens are local utilities.
- Tool math never lives in `site/`; it is imported from `core/src` through the `@core` alias.
- Ship gate (Task 9 runs all of it): `npm run check` 0 errors · `npm test` all pass · `npm run e2e` all pass at phone and desktop, with reduced motion and with JavaScript off · `npm run budget` first screen ≤ 60 KB gzipped JavaScript, whole site ≤ 150 KB · `npm run lighthouse` mobile performance ≥ 90 and accessibility ≥ 95.

## Review Focus

Conditions the design does not spell out but a real visit will hit. Each has a test in the task named.

1. **The tab is hidden and comes back.** The time step is capped at 0.05 s and the meter does not jump or count while hidden. (Tasks 6, 7)
2. **The window is resized or the phone is rotated mid-animation.** Canvases resize without blur, the scene re-lays out, letter positions are re-measured. (Task 6)
3. **Press-and-hold meets scrolling on a phone.** If the finger moves more than 10 px before release, the hold is cancelled and the page scrolls; no text selection or callout menu appears. (Task 6)
4. **Reduced motion, or JavaScript off.** The static drawing shows, nothing animates, the meter is hidden rather than stuck at zero, and every word is still on the page. (Tasks 3, 6)
5. **A slow device.** If more than half the frames in the last two seconds (at least 20 frames) took over 24 ms, the particle count halves, once. (As built; the first rule, an average over 90 frames, kept very slow devices waiting too long.) Device pixel ratio is capped at 2. (Task 6)
6. **A second finger, or the pointer leaving the window.** Only the first pointer is tracked; leaving ends any hold without firing a gust. (Task 6)

## Constants

One table, used by Tasks 3 to 8. Lengths marked × s are multiplied by `s = min(width, height) / 800` so a phone feels like a laptop.

| Name | Value | Meaning |
|---|---|---|
| Base wind | `u = 1.55 + 0.45·sin(0.011·y + 0.7·t)`, `v = 0.4·sin(0.008·x + 0.5·t + 0.005·y)` | px per step, before the visitor's wind |
| Step length | 1.7 px per frame at 60 fps | particle travel = wind × 1.7 × (dt × 60) |
| Pointer push | radius 190 × s; gain 0.3; pointer velocity smoothed 0.6 old / 0.4 new, decays × 0.95 per frame | |
| Gust ring | speed 820 px/s × s; band half-width 70 × s; gain 7; fades to 0 at radius 1.1 × width | |
| Hold to charge | 0.9 s to full; fires on release if charge > 0.33 (about 0.3 s; was 0.12, which an ordinary tap exceeded); cancelled by > 10 px of movement | |
| Wind speed shown | `m/s = hypot(u, v) × 4.5` | |
| Demo power | 0 below 3 m/s and at or above 25; else `3400 × min(1, ((m/s − 3) / 9)³)` kW | replaced by `powerKw` from `core/src/energy` when that exists |
| Wake colour | energised `e` set to 1 on crossing a rotor; decays with time constant 1.18 s; particle slowed by `1 − 0.38·e` | |
| Streak | colour is a straight mix from air to signal by `e`, each channel rounded; opacity `0.3 + 0.35·min(1, speed/5) + 0.35·e`; width `1 + 0.9·e + 0.5·min(1, speed/5)` px, where speed is `hypot(u, v)` | |
| Particles | 680 on desktop, 340 under 640 px wide | |
| Trails | each frame, mix the air canvas 8% toward white, then lighten it by one whole level (as built: a percentage alone leaves a residue; the sky tint and sun are separate layers above) | |
| Front hill | `y = H·(0.80 + 0.035·sin(0.004·x + 1) + 0.012·sin(0.011·x))`, and never less than 2% of the height below the back hill | |
| Back hill | `y = H·(0.71 + 0.05·sin(0.003·x + 2.2))` | |
| Turbines | at 0.80, 0.57, 0.94 of width; scale 1, 0.58, 0.42; first on the front hill, others on the back; tower `0.36·H·scale`; rotor radius `min(0.21·H, 0.17·W)·scale` | |
| Sun | centre (0.66·W, 0.69·H); radius `0.13·min(W, H)`; sky tint 13% air colour at the top fading to 0 at 0.72·H | |
| Chapter fill | thresholds 3, 9, 18, 30 kWh | |
| Letter lean | target `clamp(2.4 × gust_u, −15, 15)` degrees; spring stiffness 0.16, damping 0.76, per 60 fps frame | only the visitor's wind, never the base wind |

## File map

| File | Job |
|---|---|
| `site/package.json`, `astro.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `playwright.config.ts` | Project, scripts, the `@core` alias |
| `site/src/lib/palette.ts` + test | Colour roles, the contrast function, the allowed text pairs |
| `site/src/styles/tokens.css`, `global.css` | Tokens mirrored from the palette; base type and layout |
| `site/src/content/site.ts` | All copy, people, chapter list, the three labels |
| `site/src/lib/scene/layout.ts` + test | Hills, turbine positions, sun, from width and height |
| `site/src/lib/scene/svg.ts` + test | The static first-screen drawing as an SVG string |
| `site/src/lib/wind/field.ts` + test | Base wind, pointer push, gust rings |
| `site/src/lib/wind/particles.ts` + test | Moving, recycling and energising particles; streak colour |
| `site/src/lib/demo.ts` + test | Wind speed shown, demo power, meter, chapter fill |
| `site/src/lib/spring.ts` + test | The one spring used by letters and controls |
| `site/src/scripts/hero.ts` | The controller: canvases, input, the frame loop |
| `site/src/scripts/reactive.ts` | `data-press`, `data-magnetic`, `data-reveal`, the arrival |
| `site/src/components/TopBar.astro`, `Hero.astro`, `Chapter.astro`, `Footer.astro` | Markup |
| `site/src/pages/index.astro` | The page |
| `site/e2e/*.spec.ts` | Browser tests |
| `site/scripts/budget.mjs`, `lighthouse.sh` | Gate scripts |
| `.github/workflows/ci.yml` | Runs the gate on every pull request |

---

### Task 0: Approval, then the project — stops for Dylan first

- [ ] **Step 1:** Check each package exists and note its latest stable version with `npm view <name> version`: `astro`, `@astrojs/check`, `typescript`, `vitest`, `@playwright/test`, `@axe-core/playwright`, `lighthouse`, `@fontsource-variable/mona-sans`, `@fontsource-variable/geist-mono`. If either font package is missing, stop and ask; do not substitute.
- [ ] **Step 2:** Show Dylan the list with versions, plus "Playwright downloads its own Chromium, about 150 MB, free". **Wait for his yes.**
- [ ] **Step 3:** Branch `site/foundation`. Create `site/` by hand (no interactive scaffolder): `package.json` with `"type": "module"`, `"private": true`, Node `>=22.12`, and scripts `dev`, `build`, `preview`, `check` (`astro check`), `test` (`vitest run`), `e2e` (`playwright test`), `budget` (`node scripts/budget.mjs`), `lighthouse` (`bash scripts/lighthouse.sh`). Pin exact versions.
- [ ] **Step 4:** `astro.config.mjs`: static output; `base` from the environment variable `SITE_BASE`, default `/`; Vite alias `@core` → `../core/src`. `tsconfig.json`: extend Astro's strict preset; add the same alias under `paths`. `playwright.config.ts`: two projects, desktop 1440×820 and a phone (Pixel 7); web server `npm run preview` on a fixed port after `npm run build`.
- [ ] **Step 5:** Add `site/src/pages/index.astro` with a single `<h1>` and a test `site/src/lib/alias.test.ts`:

```ts
import type { FinanceInputs } from '@core/finance';
test('the core alias resolves', () => {
  const k: keyof FinanceInputs = 'capacity_mw';
  expect(k).toBe('capacity_mw');
});
```

- [ ] **Step 6:** Run `npm install`, `npx playwright install chromium`, then `npm run check`, `npm test`, `npm run build`. Expected: 0 errors; 1 passed; a `dist/index.html`.
- [ ] **Step 7:** Add `site/node_modules`, `site/dist`, `site/.astro`, `site/test-results`, `site/playwright-report` to `.gitignore` if not covered. Commit (`chore(site): astro project with the core alias`).

### Task 1: Palette, contrast and type

**Files:** Create `site/src/lib/palette.ts`, `palette.test.ts`, `site/src/styles/tokens.css`, `global.css`

**Interfaces:**
- Produces:

```ts
export const palette = {
  ground: '#FFFFFF', ink: '#0A1220', surface: '#E6F1FC', air: '#1890FF', signal: '#FF5B14',
  third: '#5C6B80', airDeep: '#0B62C4', signalDeep: '#C2410C', farTurbine: '#7FA6CC',
} as const;
export type Role = keyof typeof palette;
export function contrast(a: string, b: string): number;                 // WCAG ratio
export function rgb(hex: string): [number, number, number];
export const textPairs: { fg: Role; bg: Role; min: 4.5 | 3 }[];          // every pair the site may use for text
export const bannedPairs: [Role, Role][];
```

`textPairs`: at 4.5 — ink/ground, ink/surface, third/ground, third/surface, ink/signal, ink/air, airDeep/ground, airDeep/surface, signalDeep/ground, signalDeep/surface. At 3 (large text only) — signal/ground, air/ground. `bannedPairs`: signal/surface, signal/air, air/signal.

- [ ] **Step 1: Write the failing tests.**

```ts
test('known ratios', () => {
  expect(contrast('#0A1220', '#FFFFFF')).toBeCloseTo(18.75, 2);
  expect(contrast('#5C6B80', '#E6F1FC')).toBeCloseTo(4.74, 2);
  expect(contrast('#FF5B14', '#FFFFFF')).toBeCloseTo(3.11, 2);
  expect(contrast('#FF5B14', '#1890FF')).toBeCloseTo(1.04, 2);
  expect(contrast('#FFFFFF', '#0A1220')).toBeCloseTo(18.75, 2);          // order does not matter
});
test.each(textPairs)('$fg on $bg meets $min', ({ fg, bg, min }) => {
  expect(contrast(palette[fg], palette[bg])).toBeGreaterThanOrEqual(min);
});
test.each(bannedPairs)('%s on %s really is unusable', (fg, bg) => {
  expect(contrast(palette[fg], palette[bg])).toBeLessThan(3);
});
test('tokens.css mirrors the palette', () => {
  // read tokens.css; for every role, a custom property --<kebab-case role> has exactly that hex
});
test('no stray hex colours in site/src', () => {
  // walk site/src: only palette.ts and tokens.css may contain /#[0-9a-fA-F]{6}\b/
});
test('rgb parses', () => expect(rgb('#1890FF')).toEqual([24, 144, 255]));
```

- [ ] **Step 2:** Run `npm test`. Expected: failures.
- [ ] **Step 3:** Implement `palette.ts` and write `tokens.css` (`:root` custom properties, names in kebab case: `--ground`, `--air-deep`, …).
- [ ] **Step 4:** `global.css`: import the two variable fonts (Latin subset only); body in Mona Sans on `--ground` with `--ink`; a `.num` class in Geist Mono with tabular figures; display sizes with `clamp()` and tracking that tightens with size (−0.02em at 24 px to −0.05em at the largest); gutters 16 px, 48 px from 640 px; `.measure` max 68 characters; focus ring 2 px `--air-deep`; `@media (prefers-reduced-motion: reduce)` removes transitions.
- [ ] **Step 5:** Run `npm test` and `npm run check`. Expected: all pass, 0 errors.
- [ ] **Step 6:** Commit (`feat(site): palette with a contrast test, tokens and type`).

### Task 2: Content and the page shell

**Files:** Create `site/src/content/site.ts`, the four components, update `index.astro`, create `site/e2e/shell.spec.ts`, `site/e2e/a11y.spec.ts`

**Interfaces:**
- Produces:

```ts
export interface Credit { owner: 'dylan' | 'partner' | 'both'; ai: string; checked: string }
export interface Chapter { id: string; number: string; title: string; status: 'live' | 'in-progress'; summary: string; credit: Credit }
export const site: {
  name: string; headline: [string, string, string]; sub: string;
  people: { dylan: { name: string; role: string }; partner: { name: string; role: string } };
  meter: { label: string; unit: string; note: string };
  readouts: { wind: string; output: string };
  chapters: Chapter[]; disclaimer: string; repoUrl: string | null;
};
```

**Exact strings:** name `wind-farm`; headline `['Made of', 'moving', 'air.']` with the third in the signal colour; sub `Sweep to push the wind. Press and hold, then let go, to send a gust.`; meter label `your wind has made`, unit `kWh`, note `demo turbine, not the real farm`; readouts `wind at hub` and `demo output`; disclaimer `Educational model. Not investment, tax or engineering advice.`; chapters `01 The wind`, `02 One turbine`, `03 The farm`, `04 How sure are we`, `05 The money`, `06 How we built it`, all `in-progress` with summary `In progress.`; `repoUrl` `null` while the repo is private. People's display names: Dylan enters both; the partner's name is not written by an agent.

Each chapter's credit starts as `{ owner, ai: 'To be written by its owner.', checked: 'To be written by its owner.' }` with owners: 01–04 `dylan`, 05 `partner`, 06 `both`. **An agent never writes the `ai` or `checked` text**; the owner does, because it is a claim about what they did.

- [ ] **Step 1: Write the failing browser tests.**

```ts
// shell.spec.ts
test('every chapter and the disclaimer are on the page', ...);      // 6 chapter headings, the disclaimer text
test('one h1, headings in order', ...);
test('no horizontal scroll', ...);                                   // scrollWidth <= clientWidth, both projects
test('the top bar stays on one line on a phone', ...);               // name and meter share a row; bar height < 72 px
test('everything is readable with JavaScript off', ...);             // new context, javaScriptEnabled: false: h1, sub, 6 chapters, disclaimer visible; meter hidden
test('in-progress chapters show no numbers', ...);                   // no digit other than the chapter number inside an in-progress chapter
// a11y.spec.ts
test('no axe violations', ...);                                       // both projects, and again with JavaScript off
```

- [ ] **Step 2:** Run `npm run e2e`. Expected: failures.
- [ ] **Step 3:** Build the components from `site.ts`. `TopBar`: name left, meter right, hidden with a `no-js` rule until the script marks the page ready. `Hero`: a `100svh` section holding the headline (one `<span>` per letter, `aria-hidden`, with the full text as `aria-label` on the `<h1>`), the sub, two readouts and four chapter chips linking to chapters 01, 02, 03 and 05. `Chapter`: number, title, summary and the three labels. `Footer`: disclaimer, people, sources placeholder.
- [ ] **Step 4:** Run `npm run e2e`, `npm run check`, `npm test`. Expected: all pass.
- [ ] **Step 5:** Commit (`feat(site): content file and page shell`). Pull request for Tasks 0 to 2.

### Task 3: The scene, and the static drawing

**Files:** Create `site/src/lib/scene/layout.ts`, `layout.test.ts`, `svg.ts`, `svg.test.ts`; update `Hero.astro`

**Interfaces:**
- Produces:

```ts
export interface TurbinePose { baseX: number; baseY: number; hubY: number; radius: number; scale: number; front: boolean }
export interface Scene { w: number; h: number; s: number; sun: { x: number; y: number; r: number }; turbines: TurbinePose[] }
export function frontHill(x: number, h: number): number;
export function backHill(x: number, h: number): number;
export function layout(w: number, h: number): Scene;
export function sceneSvg(w: number, h: number): string;      // complete <svg>, no script, colours from the palette
```

- [ ] **Step 1: Write the failing tests.**

```ts
test('scale factor', () => { expect(layout(1440, 820).s).toBeCloseTo(1.025, 3); expect(layout(390, 780).s).toBeCloseTo(0.4875, 4); });
test('sun position and size', () => {
  const { sun } = layout(1440, 820);
  expect(sun.x).toBeCloseTo(950.4, 1); expect(sun.y).toBeCloseTo(565.8, 1); expect(sun.r).toBeCloseTo(106.6, 1);
});
test('three turbines, the first on the front hill', () => {
  const t = layout(1440, 820).turbines;
  expect(t).toHaveLength(3); expect(t[0]!.front).toBe(true); expect(t[0]!.baseX).toBeCloseTo(1152, 1);
  expect(t[0]!.baseY).toBeCloseTo(frontHill(1152, 820), 6);
  expect(t[0]!.hubY).toBeCloseTo(t[0]!.baseY - 0.36 * 820, 6);
  expect(t[0]!.radius).toBeCloseTo(172.2, 1);                 // min(0.21·820, 0.17·1440) = 172.2
});
test('on a narrow screen the rotor is limited by width', () => {
  expect(layout(390, 780).turbines[0]!.radius).toBeCloseTo(66.3, 1);
});
test('hills stay inside the stage', () => { /* for x in 0..w step 10: 0.6h < backHill < frontHill < h */ });
test('svg is self-contained', () => {
  const svg = sceneSvg(1440, 820);
  expect(svg.startsWith('<svg')).toBe(true); expect(svg).not.toMatch(/<script|href=|url\(http/);
  expect(svg).toContain('viewBox="0 0 1440 820"'); expect(svg).toContain('role="img"');
});
test('svg uses only palette colours', () => { /* every #hex in the string is a palette value */ });
test('svg has streaks of both colours', () => { /* at least 40 air-coloured and 8 signal-coloured stroke paths, placed by a seeded generator so the output is identical every build */ });
```

- [ ] **Step 2:** Run. Expected: failures. Implement both files. `sceneSvg` draws: sky tint, sun with its halo, back hill, far turbines, front hill, the near turbine with blades at fixed angles, grass, and still streaks (blue upwind, orange in each wake).
- [ ] **Step 3:** In `Hero.astro`, render `sceneSvg` at build time for two sizes (1440×820 and 390×780) inside a `<picture>`-style pair switched by a media query, with `aria-label` "A sun low over two hills with three wind turbines". This is what shows with JavaScript off and under reduced motion.
- [ ] **Step 4:** Add to `shell.spec.ts`: with JavaScript off, the static drawing is visible and fills the first screen; with `prefers-reduced-motion: reduce`, no `<canvas>` is visible after 2 seconds and the static drawing is.
- [ ] **Step 5:** Run `npm test`, `npm run e2e`. Expected: all pass.
- [ ] **Step 6:** Commit (`feat(site): scene layout and the static first-screen drawing`).

### Task 4: The wind

**Files:** Create `site/src/lib/wind/field.ts`, `field.test.ts`

**Interfaces:**
- Produces:

```ts
export interface Pointer { x: number; y: number; vx: number; vy: number; active: boolean }
export interface Burst { x: number; y: number; r: number; strength: number }
export interface WindState { t: number; w: number; s: number; pointer: Pointer; bursts: Burst[] }
export function baseWind(x: number, y: number, t: number): [number, number];
export function gust(x: number, y: number, st: WindState): [number, number];     // the visitor's wind only
export function wind(x: number, y: number, st: WindState): [number, number];     // base + gust
export function movePointer(p: Pointer, x: number, y: number): Pointer;          // smooths velocity 0.6 / 0.4
export function stepState(st: WindState, dt: number): WindState;                 // advances t, decays pointer velocity, grows and drops bursts
export function fireBurst(st: WindState, charge: number): WindState;             // no burst if charge <= 0.12
```

- [ ] **Step 1: Write the failing tests.** `still` is a state with `t = 0`, `w = 1000`, `s = 1`, an inactive pointer and no bursts.

```ts
test('base wind at the origin', () => { const [u, v] = baseWind(0, 0, 0); expect(u).toBeCloseTo(1.55, 6); expect(v).toBeCloseTo(0, 6); });
test('base wind always blows left to right', () => { /* u > 1.0 on a 50-px grid for t in 0..10 */ });
test('no visitor wind when nothing is happening', () => expect(gust(300, 300, still)).toEqual([0, 0]));
test('pointer push is strongest at the pointer', () => {
  const st = { ...still, pointer: { x: 200, y: 200, vx: 10, vy: 0, active: true } };
  expect(gust(200, 200, st)[0]).toBeCloseTo(3.0, 6);                          // 10 × 0.3 × 1
  expect(gust(390, 200, st)[0]).toBeCloseTo(3.0 * Math.exp(-1), 6);           // one radius away
  expect(gust(1200, 200, st)[0]).toBeLessThan(1e-9);
});
test('pointer push scales with the screen', () => {
  const st = { ...still, s: 0.5, pointer: { x: 200, y: 200, vx: 10, vy: 0, active: true } };
  expect(gust(295, 200, st)[0]).toBeCloseTo(3.0 * Math.exp(-1), 6);           // radius is 95 at s = 0.5
});
test('an inactive pointer pushes nothing', () => { /* same pointer with active: false -> [0, 0] */ });
test('a gust ring pushes outward on the ring only', () => {
  const st = { ...still, bursts: [{ x: 500, y: 300, r: 100, strength: 1 }] };
  const [u, v] = gust(600, 300, st);                                          // on the ring, due east
  expect(u).toBeCloseTo(7 * (1 - 100 / 1100), 6); expect(v).toBeCloseTo(0, 6);
  expect(gust(500, 300, st)).toEqual([0, 0]);                                 // centre: outside the band
  expect(gust(800, 300, st)).toEqual([0, 0]);                                 // far outside
  expect(gust(400, 300, st)[0]).toBeCloseTo(-7 * (1 - 100 / 1100), 6);        // west side pushes west
});
test('a ring grows, fades and is dropped', () => {
  let st = { ...still, bursts: [{ x: 0, y: 0, r: 0, strength: 1 }] };
  st = stepState(st, 0.5); expect(st.bursts[0]!.r).toBeCloseTo(410, 6);
  st = stepState(st, 2);   expect(st.bursts).toHaveLength(0);                 // past 1.15 × width
});
test('a weak hold fires nothing', () => { expect(fireBurst(still, 0.12).bursts).toHaveLength(0); expect(fireBurst({ ...still, pointer: { x: 1, y: 2, vx: 0, vy: 0, active: true } }, 0.5).bursts).toHaveLength(1); });
test('at most three rings at once', () => { /* a fourth fireBurst drops the oldest */ });
test('pointer velocity is smoothed and decays', () => {
  let p = movePointer({ x: 0, y: 0, vx: 0, vy: 0, active: true }, 10, 0); expect(p.vx).toBeCloseTo(4, 6);
  /* stepState for one 60 fps frame multiplies vx by 0.95 */
});
test('the first move after becoming active gives no velocity', () => { /* inactive -> movePointer -> vx 0, active true */ });
test('stepState is frame-rate independent', () => { /* two steps of 1/120 s leave t, ring radius and pointer velocity within 1% of one step of 1/60 s */ });
```

- [ ] **Step 2:** Run. Expected: failures. Implement from the Constants table. All functions are pure and return new objects.
- [ ] **Step 3:** Run. Expected: 13 passed. Commit (`feat(site): wind field with pointer push and gust rings`).

### Task 5: Particles, and air turning into energy

**Files:** Create `site/src/lib/wind/particles.ts`, `particles.test.ts`, `site/src/lib/demo.ts`, `demo.test.ts`, `site/src/lib/spring.ts`, `spring.test.ts`

**Interfaces:**
- Consumes: `wind`, `WindState`, `Scene`, `TurbinePose`, `palette`, `rgb`.
- Produces:

```ts
// particles.ts
export interface Particle { x: number; y: number; e: number }               // e: 0 = air, 1 = energy just taken
export function seedParticles(n: number, w: number, h: number, rand: () => number): Particle[];
export function stepParticle(p: Particle, st: WindState, scene: Scene, dt: number, rand: () => number): { p: Particle; from: [number, number] };
export function streakColour(e: number, speed: number): { r: number; g: number; b: number; a: number; width: number };
// demo.ts
export function shownSpeed(u: number, v: number): number;                    // m/s
export function demoPowerKw(ms: number): number;
export function addEnergy(kwh: number, kw: number, dt: number): number;
export function chapterFill(kwh: number): [number, number, number, number];  // each 0..1
export function particleCount(w: number): number;
// spring.ts
export interface Spring { value: number; velocity: number }
export function stepSpring(sp: Spring, target: number, dt: number, stiffness?: number, damping?: number): Spring;
export function leanTarget(gustU: number): number;
```

- [ ] **Step 1: Write the failing tests.**

```ts
// particles.test.ts
test('a particle moves with the wind', () => { /* still state, p at (100, 100): after 1/60 s, x grew by baseWind u × 1.7 */ });
test('crossing a rotor from the left energises it', () => { /* p just left of turbines[0].baseX at hub height -> e === 1 after the step */ });
test('passing above or below the rotor does not', () => { /* y = hubY - radius - 5 -> e stays 0 */ });
test('moving right to left through a rotor does not', () => { /* strong leftward pointer push -> e stays 0 */ });
test('energy fades with a 1.18 s time constant', () => { /* e = 1, away from rotors, 1.18 s of steps -> e within 0.01 of 1/Math.E */ });
test('energised air is slower', () => { /* same place and wind: distance with e = 1 is 0.62 × distance with e = 0 */ });
test('leaving the stage recycles the particle upwind as plain air', () => { /* x > w + 6 -> x === -4, e === 0, 0 <= y <= 0.8h */ });
test('particles never go below the ground line', () => { /* y > 0.86h recycles */ });
test('streak colour runs from air to signal', () => {
  expect(streakColour(0, 0)).toMatchObject({ r: 24, g: 144, b: 255 });
  expect(streakColour(1, 0)).toMatchObject({ r: 255, g: 91, b: 20 });
  expect(streakColour(0.5, 0)).toMatchObject({ r: 140, g: 118, b: 138 });      // rounded midpoint
  expect(streakColour(0, 0).a).toBeCloseTo(0.3, 6); expect(streakColour(1, 5).a).toBeCloseTo(1, 6);
});
test('seeding is repeatable', () => { /* same seeded rand -> identical arrays */ });
// demo.test.ts
test('shown speed', () => expect(shownSpeed(1.55, 0)).toBeCloseTo(6.975, 6));
test('demo power', () => {
  expect(demoPowerKw(2.99)).toBe(0); expect(demoPowerKw(3)).toBe(0); expect(demoPowerKw(7.5)).toBeCloseTo(425, 6);
  expect(demoPowerKw(12)).toBeCloseTo(3400, 6); expect(demoPowerKw(20)).toBeCloseTo(3400, 6); expect(demoPowerKw(25)).toBe(0);
});
test('energy adds up', () => expect(addEnergy(0, 3600, 1)).toBeCloseTo(1, 9));     // 3600 kW for one second is 1 kWh
test('a long gap adds at most 0.05 s', () => expect(addEnergy(0, 3600, 30)).toBeCloseTo(0.05, 9));
test('negative or NaN input adds nothing', () => { expect(addEnergy(2, -5, 1)).toBe(2); expect(addEnergy(2, NaN, 1)).toBe(2); });
test('chapter fill', () => {
  expect(chapterFill(0)).toEqual([0, 0, 0, 0]); expect(chapterFill(3)).toEqual([1, 0, 0, 0]);
  expect(chapterFill(6)).toEqual([1, 0.5, 0, 0]); expect(chapterFill(99)).toEqual([1, 1, 1, 1]);
});
test('fewer particles on a phone', () => { expect(particleCount(390)).toBe(340); expect(particleCount(640)).toBe(680); });
// spring.test.ts
test('lean target is clamped', () => { expect(leanTarget(1)).toBeCloseTo(2.4, 6); expect(leanTarget(100)).toBe(15); expect(leanTarget(-100)).toBe(-15); });
test('the spring settles on its target', () => { /* 3 s of 60 fps steps toward 10 -> |value - 10| < 0.01 and |velocity| < 0.01 */ });
test('the spring overshoots once, a little', () => { /* max value on the way to 10 is between 10 and 12 */ });
test('the spring is frame-rate independent', () => { /* 120 fps and 60 fps agree within 3% after 0.25 s */ });
test('a spring at rest stays at rest', () => { /* value 0, velocity 0, target 0 -> unchanged */ });
```

- [ ] **Step 2:** Run. Expected: failures. Implement the three modules from the Constants table.
- [ ] **Step 3:** Run `npm test` and `npm run check`. Expected: all pass. Commit (`feat(site): particles, demo readings and the spring`).

### Task 6: The first screen, live

**Files:** Create `site/src/scripts/hero.ts`, `site/e2e/hero.spec.ts`; update `Hero.astro`

**Interfaces:**
- Consumes: everything from Tasks 3 to 5.
- Produces: `startHero(root: HTMLElement): () => void` (returns a stop function). For tests only, when the page URL has `?debug`, it also sets `window.__hero = { state(): { kwh: number; particles: number; speedMs: number; bursts: number; running: boolean } }`.

**How it draws** (two canvases stacked over the static drawing, which is hidden once the first frame is painted):
- *Air canvas:* a background image (white, sky tint, sun and halo) is drawn once to an offscreen canvas at half resolution; each frame it is painted over the air canvas at 8% opacity, then each particle's streak is drawn.
- *Land canvas:* cleared each frame; the sun's reactive glow (`0.10 + 0.38 × min(1, total kW / 10200)` opacity), gust rings, back hill, far turbines, front hill, the near turbine's blue shadow, grass, the near turbine, the orange pulses on the ground, and the charge ring around the finger.
- Rotor speed: each turbine's angle advances by `min(shown m/s, 20) × 0.0075 / sqrt(scale)` per 60 fps frame.

- [ ] **Step 1: Write the failing browser tests** (all load `/?debug`):

```ts
test('the air moves on its own', ...);                 // two screenshots of the air canvas 500 ms apart differ
test('sweeping raises the wind speed', ...);           // speedMs before < 9; sweep 300 px in 8 steps across the near hub; speedMs within 300 ms > 12
test('hold and release sends one gust', ...);          // mouse down 950 ms then up -> bursts === 1; then 0 again within 4 s
test('a short tap sends nothing', ...);                // down 60 ms, up -> bursts === 0
test('moving during a hold cancels it', ...);          // down, move 40 px, wait 950 ms, up -> bursts === 0
test('leaving the window cancels a hold', ...);        // down, dispatch pointerleave, wait -> bursts === 0
test('a second finger is ignored', ...);               // two touch points: state follows the first only
test('hidden tabs do not run', ...);                   // emulate visibility hidden for 3 s: kwh grows by less than 0.05 s worth; running false while hidden
test('resizing keeps it sharp', ...);                  // set viewport 900×700: canvas.width === round(900 × dpr), turbines re-laid out
test('it pauses offscreen', ...);                      // scroll the first screen out of view -> running === false
test('reduced motion shows the still drawing', ...);   // no canvas visible, __hero undefined
test('it drops particles on a slow device', ...);      // CDP CPU throttle 6×: particles === half the starting count within 4 s
test('long press shows no selection or menu', ...);    // phone project: 950 ms touch hold -> window.getSelection().toString() === ''
```

- [ ] **Step 2:** Run `npm run e2e`. Expected: failures.
- [ ] **Step 3:** Implement `hero.ts`. Pointer events only, first `pointerId` tracked. The stage has `touch-action: pan-y`, `user-select: none`, `-webkit-touch-callout: none`, and blocks `contextmenu`. One `requestAnimationFrame` loop; `dt = min(0.05, elapsed)`; an `IntersectionObserver` and `visibilitychange` set `running`. Device pixel ratio capped at 2. A `ResizeObserver` re-lays out. The script does not start when `prefers-reduced-motion: reduce` matches, and stops if that changes while running. Scroll speed also pushes the wind: on `scroll`, feed `movePointer` a horizontal velocity of `0.35 × scroll px per frame`, at the centre of the screen.
- [ ] **Step 4:** In `Hero.astro`, load the script with a module import that starts on `DOMContentLoaded`; it is part of the first-screen budget.
- [ ] **Step 5:** Run `npm run e2e`, `npm test`, `npm run check`. Expected: all pass. Open the page next to the mockup and compare by eye at both sizes; note any difference for Dylan rather than tuning silently.
- [ ] **Step 6:** Commit (`feat(site): live first screen`). Pull request for Tasks 3 to 6.

### Task 7: The meter, readouts and chapters

**Files:** Update `hero.ts`, `TopBar.astro`, `Hero.astro`; add to `hero.spec.ts`

- [ ] **Step 1: Write the failing browser tests.**

```ts
test('the meter starts at 0.00 and climbs', ...);                  // text matches /^\d+\.\d\d$/; larger after 2 s
test('the meter is labeled a demo', ...);                          // the note text from site.ts is visible beside it
test('readouts are zero-padded with units', ...);                  // wind matches /^\d\d\.\d m\/s$/, output matches /^[\d,]+ kW$/
test('pushing the wind makes the meter climb faster', ...);        // gain over 2 s while sweeping > 1.5 × gain over 2 s idle
test('chapter chips fill in order', ...);                          // chip 1 fill > 0 before chip 2; widths match chapterFill(kwh) within 2%
test('chips are links that work without the animation', ...);      // each has an href to its chapter; activating scrolls there
test('screen readers are not flooded', ...);                       // the meter has aria-live="off"; a visually hidden summary updates at most every 10 s
```

- [ ] **Step 2:** Run. Expected: failures. Implement: the controller writes text only when the rounded value changes; numbers use the `.num` class; the output total is the three turbines' `demoPowerKw` summed.
- [ ] **Step 3:** Run the full gate so far (`check`, `test`, `e2e`). Expected: all pass. Commit (`feat(site): demo meter, readouts and chapter fill`).

### Task 8: The reactive layer and the arrival

**Files:** Create `site/src/scripts/reactive.ts`, `site/e2e/reactive.spec.ts`; update components to carry the data attributes

**Interfaces:**
- Produces: `startReactive(root: HTMLElement): () => void`, wiring four attributes:
  - `data-press`: scale to 0.96 on pointer down, spring back on release.
  - `data-magnetic`: fine pointers only; the element follows the pointer by up to 6 px within 80 px.
  - `data-reveal`: fades and rises 12 px when 15% in view, once.
  - `data-lean`: on the headline's letter spans; the controller sets each one's lean from `gust` at its centre through `stepSpring`.

- [ ] **Step 1: Write the failing browser tests.**

```ts
test('letters lean when the wind passes and return upright', ...);   // sweep across the headline: some letter's transform is non-empty; all empty again within 2 s
test('letters do not move in the base wind', ...);                   // 3 s idle: every letter's transform stays empty
test('pressing a chip scales it', ...);
test('magnetic pull is off on touch', ...);                          // phone project: no transform on hover-less devices
test('the arrival runs once', ...);                                  // html has class "arrived" within 1.5 s; reload with sessionStorage set skips straight to it
test('reveal does not hide content without JavaScript', ...);        // JS off: every [data-reveal] element is visible
test('reduced motion: no lean, no arrival, no magnetic', ...);
```

- [ ] **Step 2:** Run. Expected: failures. Implement. The arrival, about 1.2 s: the sun rises from behind the hill, the headline's three lines come in 90 ms apart, the air starts. Letter positions are measured after fonts load and on every resize. Elements start visible in CSS and are only hidden by a class the script adds, so nothing depends on the script running.
- [ ] **Step 3:** Run the gate so far. Expected: all pass. Commit (`feat(site): reactive layer, leaning headline and arrival`).

### Task 9: The gate, CI, and handover — stops for Dylan

**Files:** Create `site/scripts/budget.mjs`, `site/scripts/lighthouse.sh`, `.github/workflows/ci.yml`; update `README.md`, `HANDOFF.md`, `CLAUDE.md`

- [ ] **Step 1:** `budget.mjs`: after a build, gzip every `.js` file in `dist`. Fail if the files loaded by `index.html` without user action total more than 60 KB, if all JavaScript totals more than 150 KB, or if any file under `dist/data` exceeds 200 KB. Print a table. Test it by temporarily importing a large module and seeing it fail.
- [ ] **Step 2:** `lighthouse.sh`: build, serve `dist` on a local port, run Lighthouse in mobile mode, fail under performance 90 or accessibility 95, print the four scores, stop the server.
- [ ] **Step 3:** `ci.yml`: on pull requests, in `site/` run install, `check`, `test`, `build`, `budget`, and `e2e` with Chromium; in `core/` run `check` and `test`. No deploy job.
- [ ] **Step 4:** Run the whole gate and paste the output into the pull request: `npm run check`, `npm test`, `npm run build`, `npm run e2e`, `npm run budget`, `npm run lighthouse`.
- [ ] **Step 5:** Fix what the gate finds. If the first screen is over 60 KB, look for an accidental dependency before cutting features.
- [ ] **Step 6:** Add the site's commands and gate numbers to `CLAUDE.md`; a "Site" section to `README.md`; a two-line state update to `HANDOFF.md`.
- [ ] **Step 7:** Commit (`chore(site): budget, lighthouse and CI`). Pull request. **Stop.** Dylan opens `npm run preview` on a laptop and on his phone over the local network, compares it with the mockup, and says what to change.

## Ask the owner to check

Not in the gate, because they need people.

- Ten seconds with five people: do they say some version of "I moved the wind"?
- On a real phone inside the LinkedIn app's browser: does scrolling feel right, and is press-and-hold found without reading the hint?
- Are the blue and the orange right on your own screens?
- Fill in both display names and write the `ai` and `checked` text for the chapters you own.

## Commands

```bash
cd site
npm run dev            # work on it
npm run check && npm test && npm run build && npm run e2e && npm run budget && npm run lighthouse   # the gate
```
