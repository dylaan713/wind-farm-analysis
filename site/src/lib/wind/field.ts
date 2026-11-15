// The wind: a breeze that is always there, plus whatever the visitor adds by sweeping
// or by sending a gust. Pure functions; every step returns a new state.
import { baseWind } from './base';

export { baseWind };

export interface Pointer { x: number; y: number; vx: number; vy: number; active: boolean }
export interface Burst { x: number; y: number; r: number; strength: number }
export interface WindState {
  t: number;
  /** Stage width in px. */
  w: number;
  /** Stage scale, min(width, height) / 800. */
  s: number;
  pointer: Pointer;
  bursts: Burst[];
}

const PUSH_RADIUS = 190, PUSH_GAIN = 0.3, VELOCITY_KEEP = 0.6, VELOCITY_DECAY = 0.95;
const RING_SPEED = 820, RING_BAND = 70, RING_GAIN = 7, RING_FADE = 1.1, RING_DROP = 1.15;
const MIN_CHARGE = 0.33, MAX_RINGS = 3;

/** The visitor's wind only: the pointer's push plus any gust rings. */
export function gust(x: number, y: number, st: WindState): [number, number] {
  let u = 0, v = 0;
  const p = st.pointer;
  if (p.active) {
    const dx = x - p.x, dy = y - p.y, radius = PUSH_RADIUS * st.s;
    const k = Math.exp(-(dx * dx + dy * dy) / (radius * radius));
    u += p.vx * PUSH_GAIN * k;
    v += p.vy * PUSH_GAIN * k;
  }
  for (const b of st.bursts) {
    const ex = x - b.x, ey = y - b.y, d = Math.hypot(ex, ey) || 1;
    const band = 1 - Math.abs(d - b.r) / (RING_BAND * st.s);
    if (band <= 0) continue;
    const f = band * b.strength * RING_GAIN * Math.max(0, 1 - b.r / (RING_FADE * st.w));
    u += (ex / d) * f;
    v += (ey / d) * f;
  }
  return [u, v];
}

export function wind(x: number, y: number, st: WindState): [number, number] {
  const [bu, bv] = baseWind(x, y, st.t), [gu, gv] = gust(x, y, st);
  return [bu + gu, bv + gv];
}

/** Follow the pointer to a new position, smoothing its velocity. The first move after it appears carries none. */
export function movePointer(p: Pointer, x: number, y: number): Pointer {
  if (!p.active) return { x, y, vx: 0, vy: 0, active: true };
  return {
    x, y, active: true,
    vx: p.vx * VELOCITY_KEEP + (x - p.x) * (1 - VELOCITY_KEEP),
    vy: p.vy * VELOCITY_KEEP + (y - p.y) * (1 - VELOCITY_KEEP),
  };
}

/** Advance time: the pointer's push dies away, rings grow and are dropped once off the stage. */
export function stepState(st: WindState, dt: number): WindState {
  const decay = VELOCITY_DECAY ** (dt * 60);
  return {
    ...st,
    t: st.t + dt,
    pointer: { ...st.pointer, vx: st.pointer.vx * decay, vy: st.pointer.vy * decay },
    bursts: st.bursts
      .map((b) => ({ ...b, r: b.r + RING_SPEED * st.s * dt }))
      .filter((b) => b.r <= RING_DROP * st.w),
  };
}

/** Release a held gust at the pointer. Too short a hold does nothing. */
export function fireBurst(st: WindState, charge: number): WindState {
  if (charge <= MIN_CHARGE || !st.pointer.active) return st;
  const ring: Burst = { x: st.pointer.x, y: st.pointer.y, r: 0, strength: Math.min(1, charge) };
  return { ...st, bursts: [...st.bursts, ring].slice(-MAX_RINGS) };
}
