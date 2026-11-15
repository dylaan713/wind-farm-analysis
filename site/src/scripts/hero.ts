// The live first screen. All the numbers come from pure functions in src/lib; this file
// only reads input, keeps time, and draws.
import { addEnergy, chapterFill, demoPowerKw, particleCount, shownSpeed } from '../lib/demo';
import { palette, rgb } from '../lib/palette';
import { frameBudget } from '../lib/perf';
import { backHill, frontHill, layout, type Scene, type TurbinePose } from '../lib/scene/layout';
import { fireBurst, movePointer, stepState, wind, type WindState } from '../lib/wind/field';
import { seedParticles, stepParticle, streakColour, type Particle } from '../lib/wind/particles';

const TAU = Math.PI * 2;
const rgba = (hex: string, a: number) => { const [r, g, b] = rgb(hex); return `rgba(${r},${g},${b},${a})`; };

const HOLD_SECONDS = 0.9, HOLD_SLOP_PX = 10, MAX_DPR = 2;
const TRAIL_FADE = 0.08, SKY_TINT = 0.13, TURBINE_EASE = 0.12, FULL_GLOW_KW = 10200;

interface Rotor { pose: TurbinePose; angle: number; ms: number }

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
  const air = document.createElement('canvas'), land = document.createElement('canvas'), bg = document.createElement('canvas');
  for (const c of [air, land]) { c.setAttribute('aria-hidden', 'true'); sceneEl.appendChild(c); }
  const xa = air.getContext('2d')!, xl = land.getContext('2d')!, xb = bg.getContext('2d')!;

  const meterEl = document.querySelector<HTMLElement>('[data-meter-value]');
  const windEl = root.querySelector<HTMLElement>('[data-read-wind]');
  const outEl = root.querySelector<HTMLElement>('[data-read-output]');
  const fills = [...root.querySelectorAll<HTMLElement>('[data-chip-fill]')];
  const shown = { meter: '', wind: '', out: '', fills: ['', '', '', ''] };

  let scene: Scene = layout(1, 1), W = 1, H = 1, dpr = 1;
  let state: WindState = { t: 0, w: 1, s: 1, pointer: { x: 0, y: 0, vx: 0, vy: 0, active: false }, bursts: [] };
  let particles: Particle[] = [], rotors: Rotor[] = [];
  let kwh = 0, totalKw = 0, pulse = 0, charge = 0;
  let downId: number | null = null, holding = false, downX = 0, downY = 0;
  let inView = true, visible = document.visibilityState !== 'hidden', raf = 0, last = 0, painted = false, halved = false;
  const budget = frameBudget();
  const running = () => inView && visible;

  function size() {
    const r = root.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height); dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    for (const c of [air, land]) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    xa.setTransform(dpr, 0, 0, dpr, 0, 0); xl.setTransform(dpr, 0, 0, dpr, 0, 0);
    scene = layout(W, H);
    state = { ...state, w: W, s: scene.s };
    rotors = scene.turbines.map((pose, i) => ({ pose, angle: rotors[i]?.angle ?? i * 1.7, ms: rotors[i]?.ms ?? 7 }));
    const want = Math.round(particleCount(W) / (halved ? 2 : 1));
    if (particles.length !== want) particles = seedParticles(want, W, H, Math.random);

    // The still part of the sky, painted once at half resolution and reused every frame.
    bg.width = Math.max(1, Math.round((W * dpr) / 2)); bg.height = Math.max(1, Math.round((H * dpr) / 2));
    xb.setTransform(bg.width / W, 0, 0, bg.height / H, 0, 0);
    xb.fillStyle = palette.ground; xb.fillRect(0, 0, W, H);
    const sky = xb.createLinearGradient(0, 0, 0, H * 0.72);
    sky.addColorStop(0, rgba(palette.air, SKY_TINT)); sky.addColorStop(1, rgba(palette.air, 0));
    xb.fillStyle = sky; xb.fillRect(0, 0, W, H);
    const { sun } = scene, halo = xb.createRadialGradient(sun.x, sun.y, 0, sun.x, sun.y, Math.max(W, H) * 0.5);
    halo.addColorStop(0, rgba(palette.signal, 0.2)); halo.addColorStop(0.3, rgba(palette.signal, 0.05)); halo.addColorStop(1, rgba(palette.signal, 0));
    xb.fillStyle = halo; xb.fillRect(0, 0, W, H);
    xb.fillStyle = palette.signal; xb.beginPath(); xb.arc(sun.x, sun.y, sun.r, 0, TAU); xb.fill();
    xa.drawImage(bg, 0, 0, W, H);
  }

  // ---- input -------------------------------------------------------------
  const at = (e: PointerEvent): [number, number] => { const r = root.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const endHold = () => { holding = false; charge = 0; };
  const letGo = (e: PointerEvent) => {
    if (e.pointerId !== downId) return;
    downId = null;
    if (e.pointerType !== 'mouse') state = { ...state, pointer: { ...state.pointer, active: false } };
  };

  const onDown = (e: PointerEvent) => {
    if (downId !== null) return; // a second finger is ignored
    const [x, y] = at(e);
    downId = e.pointerId; holding = true; charge = 0; downX = x; downY = y;
    state = { ...state, pointer: { x, y, vx: 0, vy: 0, active: true } };
  };
  const onMove = (e: PointerEvent) => {
    if (downId !== null && e.pointerId !== downId) return;
    if (downId === null && e.pointerType !== 'mouse') return;
    const [x, y] = at(e);
    if (holding && Math.hypot(x - downX, y - downY) > HOLD_SLOP_PX) endHold();
    state = { ...state, pointer: movePointer(state.pointer, x, y) };
  };
  const onUp = (e: PointerEvent) => {
    if (e.pointerId !== downId) return;
    if (holding) state = fireBurst(state, charge);
    endHold(); letGo(e);
  };
  const onCancel = (e: PointerEvent) => { if (e.pointerId === downId) { endHold(); letGo(e); } };
  const onLeave = (e: PointerEvent) => {
    if (downId !== null && e.pointerId !== downId) return;
    endHold(); downId = null;
    state = { ...state, pointer: { ...state.pointer, active: false } };
  };
  const onMenu = (e: Event) => e.preventDefault();

  // Scrolling is a gust too: the page moving under the finger pushes the air.
  let lastScroll = window.scrollY;
  const onScroll = () => {
    const dy = window.scrollY - lastScroll; lastScroll = window.scrollY;
    if (downId !== null || !running()) return;
    const push = Math.max(-40, Math.min(40, dy * 0.35));
    const p = state.pointer;
    state = { ...state, pointer: { x: W / 2, y: H * 0.4, vx: p.vx * 0.6 + push * 0.4, vy: 0, active: true } };
  };

  // ---- drawing -----------------------------------------------------------
  function hill(fn: (x: number, h: number) => number, fill: string, stroke: string, lw: number) {
    xl.beginPath(); xl.moveTo(0, H);
    for (let x = 0; x <= W; x += 8) xl.lineTo(x, fn(x, H));
    xl.lineTo(W, fn(W, H)); xl.lineTo(W, H); xl.closePath(); xl.fillStyle = fill; xl.fill();
    xl.beginPath();
    for (let x = 0; x <= W; x += 8) { if (x) xl.lineTo(x, fn(x, H)); else xl.moveTo(x, fn(x, H)); }
    xl.lineTo(W, fn(W, H)); xl.strokeStyle = stroke; xl.lineWidth = lw; xl.stroke();
  }

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

    // Air: fade the last frame toward the still sky, then draw each particle's new streak.
    xa.globalAlpha = 1 - (1 - TRAIL_FADE) ** k; xa.drawImage(bg, 0, 0, W, H); xa.globalAlpha = 1; xa.lineCap = 'round';
    for (let i = 0; i < particles.length; i++) {
      const before = particles[i]!, { p, from } = stepParticle(before, state, scene, dt, Math.random);
      particles[i] = p;
      const c = streakColour(p.e, Math.hypot(p.x - from[0], p.y - from[1]) / (1.7 * k || 1));
      xa.strokeStyle = `rgba(${c.r},${c.g},${c.b},${c.a})`; xa.lineWidth = c.width;
      xa.beginPath(); xa.moveTo(from[0], from[1]); xa.lineTo(p.x, p.y); xa.stroke();
    }

    xl.clearRect(0, 0, W, H);
    // The sun answers the farm: more output, more glow.
    const { sun } = scene, glow = Math.min(1, totalKw / FULL_GLOW_KW), gr = sun.r * (1.5 + 1.6 * glow);
    const g = xl.createRadialGradient(sun.x, sun.y, sun.r * 0.9, sun.x, sun.y, gr);
    g.addColorStop(0, rgba(palette.signal, 0.1 + 0.38 * glow)); g.addColorStop(1, rgba(palette.signal, 0));
    xl.fillStyle = g; xl.beginPath(); xl.arc(sun.x, sun.y, gr, 0, TAU); xl.fill();
    for (const b of state.bursts) {
      xl.strokeStyle = rgba(palette.air, 0.35 * Math.max(0, 1 - b.r / (1.1 * W))); xl.lineWidth = 2;
      xl.beginPath(); xl.arc(b.x, b.y, b.r, 0, TAU); xl.stroke();
    }

    const [near, farA, farB] = rotors as [Rotor, Rotor, Rotor];
    hill(backHill, palette.surface, rgba(palette.air, 0.55), 1);
    let total = turbine(farA, palette.farTurbine, k) + turbine(farB, palette.farTurbine, k);
    hill(frontHill, palette.ground, palette.ink, 1.75);

    // Warm light, cool shadow: the near turbine's shadow falls away from the sun, in the air colour.
    const n = near.pose, sx = n.baseX + (n.baseX - sun.x) * 1.3, sy = n.baseY + Math.min(W * 0.3, 260) * 0.3;
    const shade = xl.createLinearGradient(n.baseX, n.baseY, sx, sy);
    shade.addColorStop(0, rgba(palette.air, 0.28)); shade.addColorStop(1, rgba(palette.air, 0));
    xl.strokeStyle = shade; xl.lineWidth = 9; xl.lineCap = 'round';
    xl.beginPath(); xl.moveTo(n.baseX, n.baseY + 4); xl.lineTo(sx, sy); xl.stroke();

    // Grass on the ridge bends with the air above it.
    xl.strokeStyle = rgba(palette.ink, 0.6); xl.lineWidth = 1; xl.beginPath();
    for (let x = 6; x < W; x += 11) {
      const y = frontHill(x, H), [u] = wind(x, y - 30, state), len = 9 + ((x * 7) % 9), lean = Math.max(-14, Math.min(14, (u - 1.55) * 5 + 2.5));
      xl.moveTo(x, y); xl.quadraticCurveTo(x + lean * 0.3, y - len * 0.6, x + lean, y - len);
    }
    xl.stroke();

    total += turbine(near, palette.ink, k);
    totalKw = total;

    // Energy leaves the turbine along the ground, faster when there is more of it.
    pulse += dt * (40 + total * 0.09); xl.fillStyle = palette.signal;
    for (let i = 0; i < 9; i++) {
      const x = n.baseX - ((pulse + (i * n.baseX) / 9) % n.baseX);
      xl.beginPath(); xl.arc(x, frontHill(x, H), 3.6, 0, TAU); xl.fill();
    }

    if (holding) {
      const { x, y } = state.pointer;
      xl.strokeStyle = rgba(palette.air, 0.35); xl.lineWidth = 1; xl.beginPath(); xl.arc(x, y, 26, 0, TAU); xl.stroke();
      xl.strokeStyle = rgba(palette.signal, 0.9); xl.lineWidth = 3; xl.lineCap = 'round';
      xl.beginPath(); xl.arc(x, y, 26, -Math.PI / 2, -Math.PI / 2 + TAU * charge); xl.stroke();
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
  }

  function frame(now: number) {
    raf = 0;
    if (!running()) return;
    const elapsed = last ? now - last : 16.7; last = now;
    const dt = Math.min(0.05, elapsed / 1000);
    if (!halved && budget.push(elapsed)) { halved = true; particles = particles.slice(0, Math.ceil(particles.length / 2)); }

    if (holding) charge = Math.min(1, charge + dt / HOLD_SECONDS);
    state = stepState(state, dt);
    draw(dt);
    kwh = addEnergy(kwh, totalKw, dt);
    write();
    if (!painted) { painted = true; html.classList.add('live'); }
    raf = requestAnimationFrame(frame);
  }
  const wake = () => { if (running() && !raf) { last = 0; raf = requestAnimationFrame(frame); } };

  // ---- lifecycle ---------------------------------------------------------
  const io = new IntersectionObserver((es) => { inView = es[0]?.isIntersecting ?? true; wake(); }, { threshold: 0.05 });
  const ro = new ResizeObserver(() => size());
  const onVisibility = () => { visible = document.visibilityState !== 'hidden'; wake(); };

  size(); io.observe(root); ro.observe(root);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('scroll', onScroll, { passive: true });
  root.addEventListener('pointerdown', onDown); root.addEventListener('pointermove', onMove);
  root.addEventListener('pointerup', onUp); root.addEventListener('pointercancel', onCancel);
  root.addEventListener('pointerleave', onLeave); root.addEventListener('contextmenu', onMenu);
  wake();

  if (new URLSearchParams(location.search).has('debug')) {
    (window as unknown as { __hero: unknown }).__hero = {
      state: () => ({ kwh, particles: particles.length, speedMs: rotors[0]?.ms ?? 0, bursts: state.bursts.length, running: running(), pointerX: state.pointer.x, charge }),
      nearHub: () => { const r = root.getBoundingClientRect(), t = scene.turbines[0]!; return { x: r.left + t.baseX, y: r.top + t.hubY }; },
    };
  }

  return () => {
    cancelAnimationFrame(raf); io.disconnect(); ro.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('scroll', onScroll);
    root.removeEventListener('pointerdown', onDown); root.removeEventListener('pointermove', onMove);
    root.removeEventListener('pointerup', onUp); root.removeEventListener('pointercancel', onCancel);
    root.removeEventListener('pointerleave', onLeave); root.removeEventListener('contextmenu', onMenu);
    air.remove(); land.remove(); html.classList.remove('live');
    delete (window as unknown as { __hero?: unknown }).__hero;
  };
}
