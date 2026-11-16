import { combine, deficit, overlapFraction } from './index';

test('deficit at a known point', () => {
  expect(deficit(0.8, 400, 40)).toBeCloseTo(0.180502, 6);
});

test('no deficit at or upwind of the rotor', () => {
  expect(deficit(0.8, -10, 40)).toBe(0);
  expect(deficit(0.8, 0, 40)).toBe(0);
});

test('deficit falls with distance', () => {
  expect(deficit(0.8, 200, 40)).toBeGreaterThan(deficit(0.8, 400, 40));
  expect(deficit(0.8, 400, 40)).toBeGreaterThan(deficit(0.8, 800, 40));
});

test('deficit refuses a thrust coefficient outside 0 to 1', () => {
  expect(() => deficit(1.2, 400, 40)).toThrow(RangeError);
  expect(() => deficit(Number.NaN, 400, 40)).toThrow(RangeError);
});

test('overlap of the rotor and the wake', () => {
  expect(overlapFraction(40, 70, 0)).toBe(1);
  expect(overlapFraction(40, 70, 30)).toBe(1); // rotor entirely inside the wake
  expect(overlapFraction(40, 70, 110)).toBe(0);
  expect(overlapFraction(40, 70, 200)).toBe(0);
  expect(overlapFraction(40, 40, 40)).toBeCloseTo(0.391002, 6);
  expect(overlapFraction(40, 70, 60)).toBeCloseTo(0.595167, 6);
  expect(overlapFraction(40, 70, -60)).toBeCloseTo(0.595167, 6);
});

test('wakes combine as the root of the sum of squares', () => {
  expect(combine([0.18, 0.1])).toBeCloseTo(0.205913, 6);
  expect(combine([])).toBe(0);
});
