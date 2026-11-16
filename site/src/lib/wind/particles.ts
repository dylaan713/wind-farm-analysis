// The air itself: small particles carried by the wind. Each one arrives blue. When it
// passes through a rotor the turbine takes its energy: it turns orange and slows down,
// then fades back to blue. That trail is the wake, and it widens as it goes: air that
// crossed above the hub drifts up, air that crossed below drifts down.
import { palette, rgb } from '../palette';
import { AIR_FLOOR, type Scene } from '../scene/layout';
import { wind, type WindState } from './field';

export interface Particle {
  x: number; y: number;
  /** 0 = plain air, 1 = energy just taken. */
  e: number;
  /** Sideways drift picked up at a rotor, in px per px travelled; absent for plain air. */
  d?: number;
}

const STEP = 1.7;          // px travelled per unit of wind per 60fps frame
const WAKE_SLOWDOWN = 0.38;
const WAKE_FADE_S = 1.18;
/**
 * How fast the wake widens: a streak that crossed at the blade tip leaves at this slope. The farm
 * model's wake grows 0.075 m per metre; this is drawn four times wider so it can be seen.
 */
export const WAKE_SPREAD = 0.3;
const SPAWN_BAND = 0.8;    // new air enters in the top 80% of the stage

const toLight = (c: number) => { const v = c / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const fromLight = (l: number) => Math.round(255 * (l <= 0.0031308 ? l * 12.92 : 1.055 * l ** (1 / 2.4) - 0.055));
// The two colours as amounts of light, so a blend of them is never darker than the darker of the
// two. Blending the screen values instead passes through a dull purple that dark text cannot sit on.
const AIR = rgb(palette.air).map(toLight), ENERGY = rgb(palette.signal).map(toLight);

export function seedParticles(n: number, w: number, h: number, rand: () => number): Particle[] {
  return Array.from({ length: n }, () => ({ x: rand() * w, y: rand() * h * SPAWN_BAND, e: 0 }));
}

/** Move one particle by dt seconds. `from` is where its streak starts; after a recycle it equals the new position. */
export function stepParticle(p: Particle, st: WindState, scene: Scene, dt: number, rand: () => number): { p: Particle; from: [number, number] } {
  const [u, v] = wind(p.x, p.y, st);
  const k = STEP * (1 - WAKE_SLOWDOWN * p.e) * dt * 60;
  const x = p.x + u * k, y = p.y + v * k + (p.d ?? 0) * p.e * Math.abs(u * k);

  if (x > scene.w + 6 || x < -6 || y < -6 || y > AIR_FLOOR * scene.h) {
    const fresh = { x: u >= 0 ? -4 : scene.w + 4, y: rand() * scene.h * SPAWN_BAND, e: 0 };
    return { p: fresh, from: [fresh.x, fresh.y] };
  }

  let e = p.e * Math.exp(-dt / WAKE_FADE_S), d = p.d;
  for (const t of scene.turbines) {
    if (p.x < t.baseX && x >= t.baseX && Math.abs(y - t.hubY) < t.radius) { e = 1; d = (WAKE_SPREAD * (y - t.hubY)) / t.radius; }
  }
  return { p: d === undefined ? { x, y, e } : { x, y, e, d }, from: [p.x, p.y] };
}

/** Colour, opacity and width of a streak, from how much energy was just taken and how fast the air is moving. */
export function streakColour(e: number, speed: number): { r: number; g: number; b: number; a: number; width: number } {
  const sp = Math.min(1, speed / 5), mix = (i: 0 | 1 | 2) => fromLight(AIR[i]! + (ENERGY[i]! - AIR[i]!) * e);
  return { r: mix(0), g: mix(1), b: mix(2), a: 0.3 + 0.35 * sp + 0.35 * e, width: 1 + 0.9 * e + 0.5 * sp };
}
