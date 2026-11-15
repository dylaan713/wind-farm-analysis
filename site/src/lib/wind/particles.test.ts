import { layout } from '../scene/layout';
import { baseWind, type WindState } from './field';
import { seedParticles, stepParticle, streakColour } from './particles';

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
  expect(streakColour(0, 0)).toMatchObject({ r: 24, g: 144, b: 255 });
  expect(streakColour(1, 0)).toMatchObject({ r: 255, g: 91, b: 20 });
  expect(streakColour(0.5, 0)).toMatchObject({ r: 140, g: 118, b: 138 });
  expect(streakColour(0, 0).a).toBeCloseTo(0.3, 6);
  expect(streakColour(1, 5).a).toBeCloseTo(1, 6);
  expect(streakColour(1, 5).width).toBeCloseTo(2.4, 6);
});

test('seeding is repeatable and inside the sky', () => {
  const mk = () => { let i = 0; return () => ((i = (i * 9301 + 49297) % 233280) / 233280); };
  const a = seedParticles(50, 1440, 820, mk()), b = seedParticles(50, 1440, 820, mk());
  expect(a).toEqual(b);
  for (const p of a) { expect(p.x).toBeGreaterThanOrEqual(0); expect(p.x).toBeLessThanOrEqual(1440); expect(p.y).toBeLessThanOrEqual(0.8 * 820); expect(p.e).toBe(0); }
});
