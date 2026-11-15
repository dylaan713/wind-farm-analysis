// The live first screen. All the numbers come from pure functions in src/lib; this file
// only reads input, keeps time, and draws.
import { addEnergy, chapterFill, demoPowerKw, particleCount, shownSpeed } from '../lib/demo';
import { palette, rgb } from '../lib/palette';
import { frameBudget } from '../lib/perf';
import { backHill, fitHeight, frontHill, layout, type Scene, type TurbinePose } from '../lib/scene/layout';
import { leanTarget, stepSpring, type Spring } from '../lib/spring';
import { burstAt, fireBurst, gust, movePointer, stepState, wind, type WindState } from '../lib/wind/field';
import { seedParticles, stepParticle, streakColour, type Particle } from '../lib/wind/particles';
import { AIR_LEVELS, airLevel, airShare, fadeStep, type Rect } from '../lib/zones';

const TAU = Math.PI * 2;
const rgba = (hex: string, a: number) => { const [r, g, b] = rgb(hex); return `rgba(${r},${g},${b},${a})`; };

const HOLD_SECONDS = 0.9, HOLD_SLOP_PX = 10, MAX_DPR = 2;
const SKY_TINT = 0.13, TURBINE_EASE = 0.12, FULL_GLOW_KW = 10200;
const ARRIVAL_SECONDS = 1.2, ZONE_FEATHER = 72, ZONE_PAD = 5, TRAIL_FADE = 0.08;
/** If nobody has touched anything this long after the arrival, one gust fires by itself to show what is possible. */
const DEMO_GUST_AFTER_S = 2.5, DEMO_GUST_STRENGTH = 0.85, HINT_MS = 1800;
/** The spoken summary is only updated once the visitor has stopped pushing for this long. */
const SUMMARY_QUIET_S = 2, SUMMARY_MIN_CHANGE = 0.1;

interface Rotor { pose: TurbinePose; angle: number; ms: number }
interface Letter { el: HTMLElement; spring: Spring; cx: number; cy: number; shown: string }

export function startHero(root: HTMLElement): () => void {
  const sceneEl = root.querySelector<HTMLElement>('[data-scene]');
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!sceneEl) return () => {};

  let stopRun: (() => void) | null = null;
  const sync = () => {
    if (motion.matches) { stopRun?.(); stopRun = null; } else if (!stopRun) stopRun = run(root, sceneEl);
  };
  motion.addEventListener('change', sync);
  sync();
  return () => { motion.removeEventListener('change', sync); stopRun?.(); stopRun = null; };
}

function run(root: HTMLElement, sceneEl: HTMLElement): () => void {
  const html = document.documentElement;

  // Six layers, bottom to top. Only the first and last are redrawn every frame.
  //   air    white, with the moving streaks. One canvas pixel per CSS pixel: it is soft by
  //          nature, and that is a quarter of the pixels to touch on a phone. It fades by a
  //          fixed step toward pure white, so a streak leaves nothing behind.
  //   sky    the blue tint and the sun's wide halo, painted once per resize, with a clear
  //          patch behind each piece of text.
  //   sun    a CSS disc, moved by the compositor during the arrival.
  //   glow   the sun's reactive halo: a CSS gradient, faded and scaled by the compositor.
  //   hills  both ridges and the near turbine's shadow, painted once per resize.
  //   top    turbines, grass, energy pulses, gust rings.
  const air = document.createElement('canvas'), sky = document.createElement('canvas');
  const hills = document.createElement('canvas'), land = document.createElement('canvas');
  const sunEl = document.createElement('div'), glowEl = document.createElement('div');
  const layers: [HTMLElement, string][] = [[air, 'air'], [sky, 'sky'], [sunEl, 'sun'], [glowEl, 'glow'], [hills, 'hills'], [land, 'top']];
  for (const [el, name] of layers) { el.dataset.layer = name; el.setAttribute('aria-hidden', 'true'); sceneEl.appendChild(el); }
  const xa = air.getContext('2d')!, xs = sky.getContext('2d')!, xh = hills.getContext('2d')!, xl = land.getContext('2d')!;
  const shownGlow = { opacity: '', transform: '' };
  // Streaks are drawn in a handful of batches (by energy, speed and nearness to text), not one path each.
  const E_STEPS = 5, PER_E = 2 * AIR_LEVELS, batches: number[][] = Array.from({ length: (E_STEPS + 1) * PER_E }, () => []);
  let airClip: Path2D | null = null;

  const meterBox = document.querySelector<HTMLElement>('[data-meter]');
  const meterEl = document.querySelector<HTMLElement>('[data-meter-value]');
  const summaryEl = document.querySelector<HTMLElement>('[data-meter-summary]');
  const windEl = root.querySelector<HTMLElement>('[data-read-wind]');
  const outEl = root.querySelector<HTMLElement>('[data-read-output]');
  const fills = [...root.querySelectorAll<HTMLElement>('[data-chip-fill]')];
  const chipsEl = root.querySelector<HTMLElement>('[data-chips]');
  const calmEls = [...root.querySelectorAll<HTMLElement>('[data-calm]')];
  const letters: Letter[] = [...root.querySelectorAll<HTMLElement>('[data-lean]')].map((el) => ({ el, spring: { value: 0, velocity: 0 }, cx: 0, cy: 0, shown: '' }));
  const shown = { meter: '', wind: '', out: '', fills: ['', '', '', ''] };
  const coarse = window.matchMedia('(pointer: coarse)').matches;

  let scene: Scene = layout(1, 1), W = 1, H = 1, dpr = 1, zones: Rect[] = [];
  let state: WindState = { t: 0, w: 1, s: 1, pointer: { x: 0, y: 0, vx: 0, vy: 0, active: false }, bursts: [] };
  let particles: Particle[] = [], rotors: Rotor[] = [];
  let kwh = 0, totalKw = 0, pulse = 0, charge = 0;
  let downId: number | null = null, holding = false, downX = 0, downY = 0;
  let mouseIn = false, mouseX = 0, mouseY = 0, afterScroll = false;
  let inView = true, visible = document.visibilityState !== 'hidden', raf = 0, last = 0, painted = false, halved = false;
  let touched = false, lastInputAt = 0, demoGustDone = false, hintTimer = 0;
  let spokenKwh = 0, summaryPending = false, streaksOff = false;
  const budget = frameBudget();
  // The sun rises once, on the visit's first screen; it starts below the ridge and eases up.
  let arrival = html.classList.contains('arriving') ? 0 : 1, arrivedAt = arrival === 1 ? 0 : Infinity, sunDrop = 0;
  const running = () => inView && visible;

  function size() {
    const r = root.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height); dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    for (const c of [hills, land]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    for (const c of [air, sky]) { c.width = Math.round(W); c.height = Math.round(H); }
    xa.setTransform(air.width / W, 0, 0, air.height / H, 0, 0); xs.setTransform(sky.width / W, 0, 0, sky.height / H, 0, 0);
    xh.setTransform(dpr, 0, 0, dpr, 0, 0); xl.setTransform(dpr, 0, 0, dpr, 0, 0);

    // The scene is laid out in a height that keeps the ridge clear of the chapter links.
    // offsetTop, not the bounding box: the links may be mid-animation during the arrival.
    const chipsTop = chipsEl ? chipsEl.offsetTop : H;
    const sceneH = fitHeight(H, chipsTop);
    // Text that sits over a turbine's sweep: the turbines are shortened to stay under it.
    const free = layout(W, sceneH);
    let clearBelow = 0;
    for (const el of calmEls) {
      const b = el.getBoundingClientRect();
      if (!b.width) continue;
      const left = b.left - r.left, right = b.right - r.left, bottom = el.offsetTop + el.offsetHeight + (el.offsetParent as HTMLElement | null ?? root).offsetTop;
      if (free.turbines.some((t) => right > t.baseX - t.radius - 8 && left < t.baseX + t.radius + 8)) clearBelow = Math.max(clearBelow, bottom + 8);
    }
    scene = clearBelow ? layout(W, sceneH, { clearBelow }) : free;
    state = { ...state, w: W, s: scene.s };
    rotors = scene.turbines.map((pose, i) => ({ pose, angle: rotors[i]?.angle ?? i * 1.7, ms: rotors[i]?.ms ?? 7 }));
    const want = Math.round(particleCount(W) / (halved ? 2 : 1));
    if (particles.length !== want) particles = seedParticles(want, W, scene.h, Math.random);

    if (arrival < 1) sunDrop = (1 - arrival) ** 3 * scene.sun.r * 2.4;
    measure();
    xa.globalCompositeOperation = 'source-over'; xa.fillStyle = palette.ground; xa.fillRect(0, 0, W, H);
    paintSky();
    paintHills();
    const { sun } = scene, d = sun.r * 6.2;
    Object.assign(sunEl.style, { width: `${sun.r * 2}px`, height: `${sun.r * 2}px`, left: `${sun.x - sun.r}px`, top: `${sun.y - sun.r}px`, transform: `translateY(${sunDrop.toFixed(1)}px)` });
    Object.assign(glowEl.style, { width: `${d}px`, height: `${d}px`, left: `${sun.x - d / 2}px`, top: `${sun.y - d / 2}px` });
    armDprWatch();
  }

  /** Where the headline letters and the calm zones sit, relative to the stage. Measured with leans cleared. */
  function measure() {
    const r = root.getBoundingClientRect();
    for (const l of letters) {
      if (l.shown) { l.el.style.transform = ''; l.shown = ''; }
      const b = l.el.getBoundingClientRect();
      l.cx = b.left - r.left + b.width / 2; l.cy = b.top - r.top + b.height / 2;
    }
    const box = (b: DOMRect, pad: number, dy = 0): Rect => ({ x: b.left - r.left - pad, y: b.top - r.top - pad + dy, w: b.width + pad * 2, h: b.height + pad * 2 });
    zones = calmEls.map((el) => el.getBoundingClientRect()).filter((b) => b.width > 0 && b.height > 0).map((b) => box(b, ZONE_PAD));
    // The meter is fixed to the viewport; place its zone where it sits when the page is at the top.
    const mb = meterBox?.getBoundingClientRect();
    if (mb && mb.width > 0) zones.push(box(mb, ZONE_PAD, r.top));
    // Everything except the zones themselves: clipping to this guarantees no streak crosses a word.
    airClip = new Path2D();
    airClip.rect(0, 0, W, H);
    for (const z of zones) airClip.rect(z.x, z.y, z.w, z.h);
  }

  /** The still part of the sky: a blue tint from the top and the sun's wide halo, cleared behind text. */
  function paintSky() {
    xs.globalCompositeOperation = 'source-over'; xs.shadowBlur = 0; xs.clearRect(0, 0, W, H);
    const tint = xs.createLinearGradient(0, 0, 0, scene.h * 0.72);
    tint.addColorStop(0, rgba(palette.air, SKY_TINT)); tint.addColorStop(1, rgba(palette.air, 0));
    xs.fillStyle = tint; xs.fillRect(0, 0, W, H);
    const { sun } = scene, halo = xs.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, Math.max(W, scene.h) * 0.5);
    halo.addColorStop(0, rgba(palette.signal, 0.2)); halo.addColorStop(0.3, rgba(palette.signal, 0.05)); halo.addColorStop(1, rgba(palette.signal, 0));
    xs.fillStyle = halo; xs.fillRect(0, 0, W, H);
    // Erase the tint behind each piece of text, with a soft edge.
    xs.globalCompositeOperation = 'destination-out'; xs.fillStyle = palette.ink; xs.shadowColor = palette.ink; xs.shadowBlur = ZONE_FEATHER;
    for (const z of zones) for (let i = 0; i < 2; i++) xs.fillRect(z.x, z.y, z.w, z.h);
    xs.globalCompositeOperation = 'source-over'; xs.shadowBlur = 0;
  }

  function hill(fn: (x: number, h: number) => number, fill: string, stroke: string, lw: number) {
    const h = scene.h;
    xh.beginPath(); xh.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) xh.lineTo(x, fn(x, h));
    xh.lineTo(W, fn(W, h)); xh.lineTo(W, H); xh.closePath(); xh.fillStyle = fill; xh.fill();
    xh.beginPath();
    for (let x = 0; x <= W; x += 8) { if (x) xh.lineTo(x, fn(x, h)); else xh.moveTo(x, fn(x, h)); }
    xh.lineTo(W, fn(W, h)); xh.strokeStyle = stroke; xh.lineWidth = lw; xh.stroke();
  }

  function paintHills() {
    xh.clearRect(0, 0, W, H);
    hill(backHill, palette.surface, rgba(palette.air, 0.55), 1);
    hill(frontHill, palette.ground, palette.ink, 1.75);
    // Warm light, cool shadow: the near turbine's shadow falls away from the sun, in the air colour.
    const n = scene.turbines[0]!, sx = n.baseX + (n.baseX - scene.sun.x) * 1.3, sy = n.baseY + Math.min(W * 0.3, 260) * 0.3;
    const shade = xh.createLinearGradient(n.baseX, n.baseY, sx, sy);
    shade.addColorStop(0, rgba(palette.air, 0.28)); shade.addColorStop(1, rgba(palette.air, 0));
    xh.strokeStyle = shade; xh.lineWidth = 9; xh.lineCap = 'round';
    xh.beginPath(); xh.moveTo(n.baseX, n.baseY + 4); xh.lineTo(sx, sy); xh.stroke();
  }

  // ---- input -------------------------------------------------------------
  const at = (e: PointerEvent): [number, number] => { const r = root.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const noteInput = () => { touched = true; lastInputAt = state.t; summaryPending = true; };
  const endHold = () => { holding = false; charge = 0; };
  const letGo = (e: PointerEvent) => {
    if (e.pointerId !== downId) return;
    downId = null;
    if (e.pointerType !== 'mouse') state = { ...state, pointer: { ...state.pointer, active: false } };
  };

  const onDown = (e: PointerEvent) => {
    if (downId !== null) return; // a second finger is ignored
    const [x, y] = at(e);
    downId = e.pointerId; holding = true; charge = 0; downX = x; downY = y; afterScroll = false;
    state = { ...state, pointer: { x, y, vx: 0, vy: 0, active: true } };
    noteInput();
  };
  const onMove = (e: PointerEvent) => {
    if (downId !== null && e.pointerId !== downId) return;
    if (downId === null && e.pointerType !== 'mouse') return;
    const [x, y] = at(e);
    if (e.pointerType === 'mouse') { mouseIn = true; mouseX = x; mouseY = y; }
    if (holding && Math.hypot(x - downX, y - downY) > HOLD_SLOP_PX) endHold();
    // A scroll gust may have parked the pointer elsewhere; the jump back must not count as a sweep.
    const from = afterScroll ? { ...state.pointer, active: false } : state.pointer;
    afterScroll = false;
    state = { ...state, pointer: movePointer(from, x, y) };
    noteInput();
  };
  const onUp = (e: PointerEvent) => {
    if (e.pointerId !== downId) return;
    if (holding) state = fireBurst(state, charge);
    endHold(); letGo(e);
  };
  const onCancel = (e: PointerEvent) => { if (e.pointerId === downId) { endHold(); letGo(e); } };
  const onLeave = (e: PointerEvent) => {
    if (downId !== null && e.pointerId !== downId) return;
    endHold(); downId = null; mouseIn = false;
    state = { ...state, pointer: { ...state.pointer, active: false } };
  };
  const onMenu = (e: Event) => e.preventDefault();

  // Scrolling is a gust too: the page moving under the finger pushes the air.
  let lastScroll = window.scrollY;
  const onScroll = () => {
    const dy = window.scrollY - lastScroll; lastScroll = window.scrollY;
    if (downId !== null || !running()) return;
    const push = Math.max(-40, Math.min(40, dy * 0.35)), p = state.pointer;
    const [x, y] = mouseIn ? [mouseX, mouseY] : [W / 2, scene.h * 0.4];
    state = { ...state, pointer: { x, y, vx: p.vx * 0.6 + push * 0.4, vy: 0, active: true } };
    afterScroll = true;
  };

  // ---- drawing -----------------------------------------------------------
  function turbine(r: Rotor, colour: string, k: number): number {
    const { pose: t } = r, [u, v] = wind(t.baseX, t.hubY, state), target = shownSpeed(u, v);
    r.ms += (target - r.ms) * (1 - (1 - TURBINE_EASE) ** k);
    r.angle += ((Math.min(r.ms, 20) * 0.0075) / Math.sqrt(t.scale)) * k;
    xl.strokeStyle = colour; xl.lineWidth = 5 * t.scale; xl.lineCap = 'round';
    xl.beginPath(); xl.moveTo(t.baseX, t.baseY); xl.lineTo(t.baseX, t.hubY); xl.stroke();
    xl.fillStyle = colour;
    for (let i = 0; i < 3; i++) {
      xl.save(); xl.translate(t.baseX, t.hubY); xl.rotate(r.angle + (i * TAU) / 3);
      const R = t.radius, w = t.scale;
      xl.beginPath(); xl.moveTo(0, -5 * w); xl.quadraticCurveTo(R * 0.35, -11 * w, R, -1.5 * w);
      xl.lineTo(R, 1.5 * w); xl.quadraticCurveTo(R * 0.3, 6 * w, 0, 5 * w); xl.closePath(); xl.fill(); xl.restore();
    }
    xl.fillStyle = palette.signal; xl.beginPath(); xl.arc(t.baseX, t.hubY, 8 * t.scale, 0, TAU); xl.fill();
    return demoPowerKw(r.ms);
  }

  function draw(dt: number) {
    const k = dt * 60;

    // Air: lighten everything by a fixed step (old streaks fade right out), then add each particle's new streak.
    const step = fadeStep(dt);
    xa.globalCompositeOperation = 'source-over'; xa.fillStyle = rgba(palette.ground, 1 - (1 - TRAIL_FADE) ** k); xa.fillRect(0, 0, W, H);
    xa.globalCompositeOperation = 'lighter'; xa.fillStyle = `rgb(${step},${step},${step})`; xa.fillRect(0, 0, W, H);
    xa.globalCompositeOperation = 'source-over'; xa.lineCap = 'round';
    for (const b of batches) b.length = 0;
    const unit = 1.7 * k || 1;
    for (let i = 0; i < particles.length; i++) {
      const { p, from } = stepParticle(particles[i]!, state, scene, dt, Math.random);
      particles[i] = p;
      if (streaksOff) continue;
      // Near text the air thins out in steps; behind the words themselves none is drawn.
      const level = airLevel(airShare((p.x + from[0]) / 2, (p.y + from[1]) / 2, zones, ZONE_FEATHER));
      if (!level) continue;
      const fast = Math.hypot(p.x - from[0], p.y - from[1]) / unit > 2.5 ? 1 : 0;
      batches[Math.round(p.e * E_STEPS) * PER_E + (level - 1) * 2 + fast]!.push(from[0], from[1], p.x, p.y);
    }
    xa.save();
    if (airClip) xa.clip(airClip, 'evenodd');
    for (let b = 0; b < batches.length; b++) {
      const seg = batches[b]!;
      if (!seg.length) continue;
      const within = b % PER_E, level = (within >> 1) + 1;
      const c = streakColour(Math.floor(b / PER_E) / E_STEPS, within & 1 ? 5 : 1.6), a = c.a * (level / AIR_LEVELS) ** 1.5;
      xa.strokeStyle = `rgba(${c.r},${c.g},${c.b},${a.toFixed(3)})`; xa.lineWidth = c.width; xa.beginPath();
      for (let j = 0; j < seg.length; j += 4) { xa.moveTo(seg[j]!, seg[j + 1]!); xa.lineTo(seg[j + 2]!, seg[j + 3]!); }
      xa.stroke();
    }
    xa.restore();

    // The sun answers the farm: more output, more glow. Only opacity and transform change.
    const glow = Math.min(1, totalKw / FULL_GLOW_KW);
    const opacity = (0.1 + 0.38 * glow).toFixed(2), transform = `translateY(${sunDrop.toFixed(1)}px) scale(${((1.5 + 1.6 * glow) / 3.1).toFixed(3)})`;
    if (opacity !== shownGlow.opacity) glowEl.style.opacity = shownGlow.opacity = opacity;
    if (transform !== shownGlow.transform) glowEl.style.transform = shownGlow.transform = transform;

    xl.clearRect(0, 0, W, H);
    for (const b of state.bursts) {
      xl.strokeStyle = rgba(palette.air, 0.35 * Math.max(0, 1 - b.r / (1.1 * W))); xl.lineWidth = 2;
      xl.beginPath(); xl.arc(b.x, b.y, b.r, 0, TAU); xl.stroke();
    }

    const [near, farA, farB] = rotors as [Rotor, Rotor, Rotor], n = near.pose, h = scene.h;
    let total = turbine(farA, palette.farTurbine, k) + turbine(farB, palette.farTurbine, k);

    // Grass on the ridge bends with the air above it.
    xl.strokeStyle = rgba(palette.ink, 0.6); xl.lineWidth = 1; xl.beginPath();
    for (let x = 6; x < W; x += 11) {
      const y = frontHill(x, h), [u] = wind(x, y - 30, state), len = 9 + ((x * 7) % 9), bend = Math.max(-14, Math.min(14, (u - 1.55) * 5 + 2.5));
      xl.moveTo(x, y); xl.quadraticCurveTo(x + bend * 0.3, y - len * 0.6, x + bend, y - len);
    }
    xl.stroke();

    total += turbine(near, palette.ink, k);
    totalKw = total;

    // Energy leaves the turbine along the ground, faster when there is more of it.
    pulse += dt * (40 + total * 0.09); xl.fillStyle = palette.signal;
    for (let i = 0; i < 9; i++) {
      const x = n.baseX - ((pulse + (i * n.baseX) / 9) % n.baseX);
      xl.beginPath(); xl.arc(x, frontHill(x, h), 3.6, 0, TAU); xl.fill();
    }

    if (holding) {
      // On a touch screen the ring is larger and sits above the finger, so it can be seen.
      const { x } = state.pointer, radius = coarse ? 44 : 26, y = state.pointer.y - (coarse ? 64 : 0);
      xl.strokeStyle = rgba(palette.air, 0.35); xl.lineWidth = 1; xl.beginPath(); xl.arc(x, y, radius, 0, TAU); xl.stroke();
      xl.strokeStyle = rgba(palette.signal, 0.9); xl.lineWidth = 3; xl.lineCap = 'round';
      xl.beginPath(); xl.arc(x, y, radius, -Math.PI / 2, -Math.PI / 2 + TAU * charge); xl.stroke();
    }
  }

  /** The headline leans in the wind the visitor makes, and only that wind, then springs back. */
  function lean(dt: number) {
    for (const l of letters) {
      l.spring = stepSpring(l.spring, leanTarget(gust(l.cx, l.cy, state)[0]), dt);
      const v = l.spring.value, t = Math.abs(v) > 0.05 ? `translateX(${(v * 0.2).toFixed(2)}px) skewX(${(-v).toFixed(2)}deg)` : '';
      if (t !== l.shown) { l.shown = t; l.el.style.transform = t; }
    }
  }

  function write() {
    const set = (el: HTMLElement | null, key: 'meter' | 'wind' | 'out', text: string) => {
      if (el && shown[key] !== text) { shown[key] = text; el.textContent = text; }
    };
    set(meterEl, 'meter', kwh.toFixed(2));
    set(windEl, 'wind', `${(rotors[0]?.ms ?? 0).toFixed(1).padStart(4, '0')} m/s`);
    set(outEl, 'out', `${(Math.round(totalKw / 10) * 10).toLocaleString('en-US')} kW`);
    chapterFill(kwh).forEach((f, i) => {
      const t = `scaleX(${f.toFixed(3)})`, el = fills[i];
      if (el && shown.fills[i] !== t) { shown.fills[i] = t; el.style.transform = t; }
    });
    // Spoken once, after the visitor has pushed the wind and then left it alone; never on a timer.
    if (summaryEl && summaryPending && state.t - lastInputAt >= SUMMARY_QUIET_S && Math.abs(kwh - spokenKwh) >= SUMMARY_MIN_CHANGE) {
      summaryPending = false; spokenKwh = kwh;
      summaryEl.textContent = `Your wind has made ${kwh.toFixed(1)} kilowatt hours on a demo turbine, not the real farm.`;
    }
  }

  /** Nobody has touched anything: send one gust from under the hint, and point at the words that explain it. */
  function demoGust() {
    demoGustDone = true;
    const z = zones[1] ?? zones[0]; // the hint line, when it is on screen
    const x = z ? z.x + z.w * 0.45 : W * 0.3, y = z ? Math.min(scene.h * 0.6, z.y + z.h + 46) : scene.h * 0.4;
    state = burstAt(state, x, y, DEMO_GUST_STRENGTH);
    html.classList.add('hinting');
    hintTimer = window.setTimeout(() => html.classList.remove('hinting'), HINT_MS);
  }

  function frame(now: number) {
    raf = 0;
    if (!running()) return;
    const elapsed = last ? now - last : 16.7; last = now;
    const dt = Math.min(0.05, elapsed / 1000);
    if (!halved && budget.push(elapsed)) { halved = true; particles = particles.slice(0, Math.ceil(particles.length / 2)); }

    if (holding) charge = Math.min(1, charge + dt / HOLD_SECONDS);
    state = stepState(state, dt);
    if (arrival < 1) {
      arrival = Math.min(1, arrival + dt / ARRIVAL_SECONDS);
      sunDrop = (1 - arrival) ** 3 * scene.sun.r * 2.4;
      sunEl.style.transform = `translateY(${sunDrop.toFixed(1)}px)`;
      if (arrival === 1) { arrivedAt = state.t; measure(); paintSky(); } // the headline has finished moving into place
    }
    if (!demoGustDone && !touched && state.t - arrivedAt >= DEMO_GUST_AFTER_S) demoGust();
    draw(dt);
    lean(dt);
    kwh = addEnergy(kwh, totalKw, dt);
    write();
    if (!painted) { painted = true; html.classList.add('live'); }
    raf = requestAnimationFrame(frame);
  }
  const wake = () => { if (running() && !raf) { last = 0; raf = requestAnimationFrame(frame); } };

  // ---- lifecycle ---------------------------------------------------------
  // A burst of entries can arrive in one callback; the newest one is the truth.
  const io = new IntersectionObserver((es) => { inView = es[es.length - 1]?.isIntersecting ?? true; wake(); }, { threshold: 0.05 });
  const ro = new ResizeObserver(() => size());
  const onVisibility = () => { visible = document.visibilityState !== 'hidden'; wake(); };
  // Moving the window to a screen with a different pixel density changes nothing a ResizeObserver sees.
  let dprQuery: MediaQueryList | null = null;
  const onDpr = () => size();
  function armDprWatch() {
    dprQuery?.removeEventListener('change', onDpr);
    dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
    dprQuery.addEventListener('change', onDpr);
  }

  size(); io.observe(root); ro.observe(root);
  document.fonts?.ready.then(() => { measure(); paintSky(); }).catch(() => {});
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('scroll', onScroll, { passive: true });
  root.addEventListener('pointerdown', onDown); root.addEventListener('pointermove', onMove);
  root.addEventListener('pointerup', onUp); root.addEventListener('pointercancel', onCancel);
  root.addEventListener('pointerleave', onLeave); root.addEventListener('contextmenu', onMenu);
  wake();

  if (new URLSearchParams(location.search).has('debug')) {
    (window as unknown as { __hero: unknown }).__hero = {
      state: () => ({ kwh, particles: particles.length, speedMs: rotors[0]?.ms ?? 0, bursts: state.bursts.length, running: running(), pointerX: state.pointer.x, charge, demoGustDone }),
      nearHub: () => { const r = root.getBoundingClientRect(), t = scene.turbines[0]!; return { x: r.left + t.baseX, y: r.top + t.hubY, r: t.radius }; },
      zones: () => zones,
      /** Stop drawing new streaks, so a test can check that the old ones fade away completely. */
      streaks: (on: boolean) => { streaksOff = !on; },
    };
  }

  return () => {
    cancelAnimationFrame(raf); window.clearTimeout(hintTimer); io.disconnect(); ro.disconnect();
    dprQuery?.removeEventListener('change', onDpr);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('scroll', onScroll);
    root.removeEventListener('pointerdown', onDown); root.removeEventListener('pointermove', onMove);
    root.removeEventListener('pointerup', onUp); root.removeEventListener('pointercancel', onCancel);
    root.removeEventListener('pointerleave', onLeave); root.removeEventListener('contextmenu', onMenu);
    for (const [el] of layers) el.remove();
    html.classList.remove('live', 'hinting');
    for (const l of letters) l.el.style.transform = '';
    delete (window as unknown as { __hero?: unknown }).__hero;
  };
}
