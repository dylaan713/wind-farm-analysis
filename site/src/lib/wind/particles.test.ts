import { contrast, palette } from '../palette';
import { layout } from '../scene/layout';
import { baseWind, type WindState } from './field';
import { WAKE_SPREAD, seedParticles, stepParticle, streakColour } from './particles';

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

test('crossing a rotor from the left energises it', () => {
  expect(stepParticle({ x: near.baseX - 1, y: near.hubY, e: 0 }, still, scene, F, rand).p.e).toBe(1);
});

test('passing above or below the rotor does not', () => {
  expect(stepParticle({ x: near.baseX - 1, y: near.hubY - near.radius - 5, e: 0 }, still, scene, F, rand).p.e).toBe(0);
  expect(stepParticle({ x: near.baseX - 1, y: near.hubY + near.radius + 5, e: 0 }, still, scene, F, rand).p.e).toBe(0);
});

test('moving right to left through a rotor does not', () => {
  const back: WindState = { ...still, pointer: { x: near.baseX, y: near.hubY, vx: -40, vy: 0, active: true } };
  const { p } = stepParticle({ x: near.baseX + 1, y: near.hubY, e: 0 }, back, scene, F, rand);
  expect(p.x).toBeLessThan(near.baseX);
  expect(p.e).toBe(0);
});

test('energy fades with a 1.18 s time constant', () => {
  let p = { x: 100, y: 100, e: 1 };
  for (let i = 0; i < Math.round(1.18 * 60); i++) p = stepParticle(p, still, scene, F, rand).p;
  expect(Math.abs(p.e - 1 / Math.E)).toBeLessThan(0.01);
});

test('the wake widens: air that crossed above the hub drifts up, below it drifts down', () => {
  const cross = (dy: number) => stepParticle({ x: near.baseX - 1, y: near.hubY + dy, e: 0 }, still, scene, F, rand).p;
  const above = cross(-near.radius / 2), below = cross(near.radius / 2), centre = cross(0);
  expect(above.d!).toBeLessThan(0);
  expect(below.d!).toBeGreaterThan(0);
  expect(Math.abs(centre.d!)).toBeLessThan(0.02);
  expect(Math.abs(cross(near.radius - 1).d!)).toBeLessThanOrEqual(WAKE_SPREAD);
  // One more step: the drift is added on top of the wind, away from the hub line.
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
