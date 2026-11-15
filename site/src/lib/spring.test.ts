import { leanTarget, stepSpring, type Spring } from './spring';

const run = (fps: number, seconds: number, target: number, from: Spring = { value: 0, velocity: 0 }) => {
  let sp = from, max = -Infinity;
  for (let i = 0; i < Math.round(fps * seconds); i++) { sp = stepSpring(sp, target, 1 / fps); max = Math.max(max, sp.value); }
  return { sp, max };
};

test('lean target is clamped', () => {
  expect(leanTarget(1)).toBeCloseTo(2.4, 6);
  expect(leanTarget(100)).toBe(15);
  expect(leanTarget(-100)).toBe(-15);
});

test('the spring settles on its target', () => {
  const { sp } = run(60, 3, 10);
  expect(Math.abs(sp.value - 10)).toBeLessThan(0.01);
  expect(Math.abs(sp.velocity)).toBeLessThan(0.01);
});

test('the spring overshoots once, a little', () => {
  const { max } = run(60, 3, 10);
  expect(max).toBeGreaterThan(10);
  expect(max).toBeLessThan(13.5);
});

test('the spring is frame-rate independent', () => {
  const a = run(60, 0.25, 10).sp.value, b = run(120, 0.25, 10).sp.value;
  expect(Math.abs(a - b) / a).toBeLessThan(0.03);
});

test('a spring at rest stays at rest', () => {
  expect(stepSpring({ value: 0, velocity: 0 }, 0, 1 / 60)).toEqual({ value: 0, velocity: 0 });
});
