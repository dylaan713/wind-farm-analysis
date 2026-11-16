import { contrast, palette } from '../palette';
import { layout } from '../scene/layout';
import { baseWind, type WindState } from './field';
import { WAKE_SPREAD, bladesAt, onBlade, seedParticles, stepParticle, streakColour } from './particles';

const scene = layout(1440, 820);
const near = scene.turbines[0]!;
const still: WindState = { t: 0, w: 1440, s: scene.s, pointer: { x: 0, y: 0, vx: 0, vy: 0, active: false }, bursts: [] };
const rand = () => 0.5;
const F = 1 / 60;

test('a particle moves with the wind', () => {
  const { p, from } = stepParticle({ x: 100, y: 100, e: 0 }, still, scene, F, rand);
  const [u, v] = baseWind(100, 100, 0);
  expect(p.x).toBeCloseTo(100 + u * 1.7, 6);
  expect(p.y).toBeCloseTo(100 + v * 1.7, 6);
  expect(from).toEqual([100, 100]);
});

// One blade straight down from the near hub (the other two up-left and up-right); the far turbines' blades likewise.
const DOWN = scene.turbines.map(() => bladesAt(Math.PI / 2)), UP = scene.turbines.map(() => bladesAt(-Math.PI / 2));
/** A particle that lands on the near rotor's vertical line, `dy` below the hub, this step. */
const arrive = (dy: number, blades = dy >= 0 ? DOWN : UP) => stepParticle({ x: near.baseX - 1, y: near.hubY + dy, e: 0 }, still, scene, F, rand, blades).p;

test('where the blades point', () => {
  const b = bladesAt(Math.PI / 2);
  expect(b[0]).toBeCloseTo(0, 9); expect(b[1]).toBeCloseTo(1, 9);                 // straight down the screen
  expect(b[2]).toBeCloseTo(Math.cos(Math.PI / 2 + (2 * Math.PI) / 3), 9);
  expect(Math.hypot(b[4], b[5])).toBeCloseTo(1, 9);
});

test('a point is on a blade only along it, out to the tip, and the blade narrows', () => {
  const b = bladesAt(0);                                  // one blade pointing right
  expect(onBlade(50, 0, 100, 1, b)).toBe(true);
  expect(onBlade(50, 6, 100, 1, b)).toBe(true);           // inside its width half way out
  expect(onBlade(50, 20, 100, 1, b)).toBe(false);
  expect(onBlade(95, 6, 100, 1, b)).toBe(false);          // the same offset misses near the thin tip
  expect(onBlade(101, 0, 100, 1, b)).toBe(false);         // past the tip
  expect(onBlade(-50, 0, 100, 1, b)).toBe(false);         // behind the hub there is no blade
  expect(onBlade(0, 0, 100, 1, b)).toBe(true);            // the hub itself
});

test('air that meets a blade is energised', () => {
  expect(arrive(near.radius / 2).e).toBe(1);
  expect(arrive(-near.radius / 2).e).toBe(1);
});

test('air that passes between the blades stays plain', () => {
  // The same point of the rotor, with no blade there: the blades point the other way.
  expect(arrive(near.radius / 2, UP).e).toBe(0);
  expect(arrive(-near.radius / 2, DOWN).e).toBe(0);
});

test('passing above or below the rotor does not energise', () => {
  expect(arrive(-near.radius - 5, UP).e).toBe(0);
  expect(arrive(near.radius + 5, DOWN).e).toBe(0);
});

test('without blade directions nothing is energised', () => {
  expect(stepParticle({ x: near.baseX - 1, y: near.hubY, e: 0 }, still, scene, F, rand).p.e).toBe(0);
});

test('energy fades with a 1.18 s time constant', () => {
  let p = { x: 100, y: 100, e: 1 };
  for (let i = 0; i < Math.round(1.18 * 60); i++) p = stepParticle(p, still, scene, F, rand).p;
  expect(Math.abs(p.e - 1 / Math.E)).toBeLessThan(0.01);
});

test('the wake widens: air that met a blade above the hub drifts up, below it drifts down', () => {
  const above = arrive(-near.radius / 2), below = arrive(near.radius / 2), centre = arrive(0);
  expect(above.d!).toBeLessThan(0);
  expect(below.d!).toBeGreaterThan(0);
  expect(Math.abs(centre.d!)).toBeLessThan(0.02);
  expect(Math.abs(arrive(near.radius - 1).d!)).toBeLessThanOrEqual(WAKE_SPREAD);
  // One more step, with no blade in the way: the drift is added on top of the wind, away from the hub line.
  const plain = stepParticle({ x: above.x, y: above.y, e: above.e }, still, scene, F, rand).p;
  expect(stepParticle(above, still, scene, F, rand).p.y).toBeLessThan(plain.y);
  expect(stepParticle(below, still, scene, F, rand).p.y).toBeGreaterThan(stepParticle({ x: below.x, y: below.y, e: below.e }, still, scene, F, rand).p.y);
});

test('plain air has no drift, and the drift dies away with the energy', () => {
  expect(stepParticle({ x: 100, y: 100, e: 0 }, still, scene, F, rand).p.d).toBeUndefined();
  const a = stepParticle({ x: 100, y: 100, e: 1, d: 0.3 }, still, scene, F, rand).p;
  const b = stepParticle({ x: 100, y: 100, e: 0, d: 0.3 }, still, scene, F, rand).p;
  expect(a.y).toBeGreaterThan(b.y);
  expect(b.y).toBeCloseTo(stepParticle({ x: 100, y: 100, e: 0 }, still, scene, F, rand).p.y, 9);
});

test('energised air is slower', () => {
  const a = stepParticle({ x: 100, y: 100, e: 0 }, still, scene, F, rand).p;
  const b = stepParticle({ x: 100, y: 100, e: 1 }, still, scene, F, rand).p;
  expect((b.x - 100) / (a.x - 100)).toBeCloseTo(0.62, 6);
});

test('leaving the stage recycles the particle upwind as plain air', () => {
  const { p, from } = stepParticle({ x: 1440 + 6, y: 100, e: 0.7 }, still, scene, F, rand);
  expect(p).toEqual({ x: -4, y: 0.5 * 820 * 0.8, e: 0 });
  expect(from).toEqual([p.x, p.y]);
});

test('particles never go below the ground line', () => {
  const { p } = stepParticle({ x: 300, y: 0.86 * 820 + 1, e: 0 }, still, scene, F, rand);
  expect(p.x).toBe(-4);
  expect(p.y).toBeLessThanOrEqual(0.8 * 820);
});

test('travel is frame-rate independent', () => {
  const one = stepParticle({ x: 100, y: 100, e: 0 }, still, scene, F, rand).p;
  let two = { x: 100, y: 100, e: 0 };
  for (let i = 0; i < 2; i++) two = stepParticle(two, still, scene, F / 2, rand).p;
  expect(two.x).toBeCloseTo(one.x, 2);
});

test('streak colour runs from air to signal', () => {
  expect(streakColour(0, 0)).toMatchObject({ r: 6, g: 132, b: 249 });
  expect(streakColour(1, 0)).toMatchObject({ r: 245, g: 78, b: 0 });
  expect(streakColour(0.5, 0)).toMatchObject({ r: 180, g: 109, b: 183 });
  expect(streakColour(0, 0).a).toBeCloseTo(0.3, 6);
  expect(streakColour(1, 5).a).toBeCloseTo(1, 6);
  expect(streakColour(1, 5).width).toBeCloseTo(2.4, 6);
});

test('a streak is never darker than plain air, whatever share of its energy is left', () => {
  // Dark text sits straight on the moving air, so the air's darkest colour is what it must be readable on.
  const air = streakColour(0, 0), airHex = `#${[air.r, air.g, air.b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
  for (let e = 0; e <= 1.0001; e += 0.05) {
    const c = streakColour(Math.min(1, e), 0), hex = `#${[c.r, c.g, c.b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
    expect(contrast(palette.ink, hex), `energy ${e.toFixed(2)}`).toBeGreaterThanOrEqual(contrast(palette.ink, airHex) - 0.02);
    expect(contrast(palette.ink, hex), `energy ${e.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
  }
});

test('seeding is repeatable and inside the sky', () => {
  const mk = () => { let i = 0; return () => ((i = (i * 9301 + 49297) % 233280) / 233280); };
  const a = seedParticles(50, 1440, 820, mk()), b = seedParticles(50, 1440, 820, mk());
  expect(a).toEqual(b);
  for (const p of a) { expect(p.x).toBeGreaterThanOrEqual(0); expect(p.x).toBeLessThanOrEqual(1440); expect(p.y).toBeLessThanOrEqual(0.8 * 820); expect(p.e).toBe(0); }
});
