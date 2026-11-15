import { baseWind, fireBurst, gust, movePointer, stepState, wind, type Pointer, type WindState } from './field';

const idle: Pointer = { x: 0, y: 0, vx: 0, vy: 0, active: false };
const still: WindState = { t: 0, w: 1000, s: 1, pointer: idle, bursts: [] };
const pushing = (over: Partial<WindState> = {}): WindState => ({ ...still, pointer: { x: 200, y: 200, vx: 10, vy: 0, active: true }, ...over });

test('base wind at the origin', () => {
  const [u, v] = baseWind(0, 0, 0);
  expect(u).toBeCloseTo(1.55, 6);
  expect(v).toBeCloseTo(0, 6);
});

test('base wind always blows left to right', () => {
  for (let t = 0; t <= 10; t += 0.5) for (let x = 0; x <= 2000; x += 50) for (let y = 0; y <= 1200; y += 50) expect(baseWind(x, y, t)[0]).toBeGreaterThan(1.0);
});

test('no visitor wind when nothing is happening', () => expect(gust(300, 300, still)).toEqual([0, 0]));

test('pointer push is strongest at the pointer', () => {
  const st = pushing();
  expect(gust(200, 200, st)[0]).toBeCloseTo(3.0, 6);
  expect(gust(390, 200, st)[0]).toBeCloseTo(3.0 * Math.exp(-1), 6);
  expect(gust(1200, 200, st)[0]).toBeLessThan(1e-9);
});

test('pointer push scales with the screen', () => {
  expect(gust(295, 200, pushing({ s: 0.5 }))[0]).toBeCloseTo(3.0 * Math.exp(-1), 6);
});

test('an inactive pointer pushes nothing', () => {
  expect(gust(200, 200, { ...still, pointer: { x: 200, y: 200, vx: 10, vy: 0, active: false } })).toEqual([0, 0]);
});

test('a gust ring pushes outward on the ring only', () => {
  const st: WindState = { ...still, bursts: [{ x: 500, y: 300, r: 100, strength: 1 }] };
  const [u, v] = gust(600, 300, st);
  expect(u).toBeCloseTo(7 * (1 - 100 / 1100), 6);
  expect(v).toBeCloseTo(0, 6);
  expect(gust(500, 300, st)).toEqual([0, 0]);
  expect(gust(800, 300, st)).toEqual([0, 0]);
  expect(gust(400, 300, st)[0]).toBeCloseTo(-7 * (1 - 100 / 1100), 6);
});

test('a ring grows, fades and is dropped', () => {
  let st: WindState = { ...still, bursts: [{ x: 0, y: 0, r: 0, strength: 1 }] };
  st = stepState(st, 0.5);
  expect(st.bursts[0]!.r).toBeCloseTo(410, 6);
  st = stepState(st, 2);
  expect(st.bursts).toHaveLength(0);
});

test('a tap is not a hold: under a third of a full charge fires nothing', () => {
  // A full charge takes 0.9 s, so this is about 0.3 s. An ordinary tap or click lasts 0.1 to 0.2 s.
  expect(fireBurst(pushing(), 0.12).bursts).toHaveLength(0);
  expect(fireBurst(pushing(), 0.33).bursts).toHaveLength(0);
  expect(fireBurst(pushing(), 0.34).bursts).toHaveLength(1);
  expect(fireBurst(pushing(), 0.5).bursts).toHaveLength(1);
  expect(fireBurst(pushing(), 0.5).bursts[0]).toMatchObject({ x: 200, y: 200, r: 0, strength: 0.5 });
});

test('at most three rings at once', () => {
  let st = pushing();
  for (let i = 0; i < 4; i++) st = fireBurst({ ...st, pointer: { ...st.pointer, x: i } }, 1);
  expect(st.bursts.map((b) => b.x)).toEqual([1, 2, 3]);
});

test('pointer velocity is smoothed and decays', () => {
  const p = movePointer({ x: 0, y: 0, vx: 0, vy: 0, active: true }, 10, 0);
  expect(p.vx).toBeCloseTo(4, 6);
  expect(stepState({ ...still, pointer: p }, 1 / 60).pointer.vx).toBeCloseTo(4 * 0.95, 6);
});

test('the first move after becoming active gives no velocity', () => {
  const p = movePointer(idle, 300, 120);
  expect(p).toEqual({ x: 300, y: 120, vx: 0, vy: 0, active: true });
});

test('stepState is frame-rate independent', () => {
  const start: WindState = { ...pushing(), bursts: [{ x: 0, y: 0, r: 0, strength: 1 }] };
  const one = stepState(start, 1 / 60), two = stepState(stepState(start, 1 / 120), 1 / 120);
  expect(two.t).toBeCloseTo(one.t, 9);
  expect(two.bursts[0]!.r).toBeCloseTo(one.bursts[0]!.r, 6);
  expect(Math.abs(two.pointer.vx - one.pointer.vx) / one.pointer.vx).toBeLessThan(0.01);
});

test('wind is the breeze plus the visitor', () => {
  const st = pushing();
  const [bu, bv] = baseWind(200, 200, 0), [gu, gv] = gust(200, 200, st);
  expect(wind(200, 200, st)).toEqual([bu + gu, bv + gv]);
});
