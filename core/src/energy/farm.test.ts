import { deficit, farmPowerKw, powerKw, thrustCoefficient, turbineSpeeds } from './index';
import type { Point } from './index';
import { T } from './testTurbine';

const PAIR: Point[] = [{ x: 0, y: 0 }, { x: 400, y: 0 }];

test('a single turbine has no wake', () => {
  for (let d = 0; d < 360; d += 5) {
    for (const v of [2, 5, 10, 15, 26]) {
      expect(farmPowerKw(T, [{ x: 0, y: 0 }], d, v)).toBeCloseTo(powerKw(T, v), 9);
    }
  }
});

test('two aligned turbines', () => {
  const speeds = turbineSpeeds(T, PAIR, 270, 10);
  const back = 10 * (1 - deficit(thrustCoefficient(T, 10), 400, 40));
  expect(speeds[0]).toBeCloseTo(10, 9);
  expect(speeds[1]).toBeCloseTo(back, 9);
  expect(farmPowerKw(T, PAIR, 270, 10)).toBeCloseTo(powerKw(T, 10) + powerKw(T, back), 6);
});

test('two turbines side by side have no wake', () => {
  for (const d of [0, 180]) expect(farmPowerKw(T, PAIR, d, 10)).toBeCloseTo(2 * powerKw(T, 10), 6);
});

test('reversing the wind swaps the roles', () => {
  const fromWest = turbineSpeeds(T, PAIR, 270, 10);
  const fromEast = turbineSpeeds(T, PAIR, 90, 10);
  expect(fromEast[1]).toBeCloseTo(10, 9);
  expect(fromEast[0]).toBeCloseTo(fromWest[1]!, 9);
});

test("three in a row: each wake uses its own turbine's thrust", () => {
  const row: Point[] = [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 800, y: 0 }];
  const s = turbineSpeeds(T, row, 270, 10);
  expect(s[2]!).toBeLessThan(s[1]!);
  expect(s[1]!).toBeLessThan(s[0]!);
  const d1 = deficit(thrustCoefficient(T, s[0]!), 800, 40);
  const d2 = deficit(thrustCoefficient(T, s[1]!), 400, 40);
  expect(s[2]).toBeCloseTo(10 * (1 - Math.hypot(d1, d2)), 9);
});

test('speeds come back in the order the turbines were given', () => {
  const reversed = [...PAIR].reverse();
  const s = turbineSpeeds(T, reversed, 270, 10);
  expect(s[1]).toBeCloseTo(10, 9); // the western turbine is second in this list
  expect(s[0]!).toBeLessThan(10);
});

test('a farm that is switched off by high wind makes nothing and casts no wake', () => {
  expect(farmPowerKw(T, PAIR, 270, 25)).toBe(0);
  expect(turbineSpeeds(T, PAIR, 270, 25)).toEqual([25, 25]);
});
