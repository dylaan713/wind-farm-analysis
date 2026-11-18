import { ctFromCp, powerKw, thrustCoefficient } from './index';
import type { TurbineSpec } from './index';
import { T } from './testTurbine';

test('power interpolates between curve points', () => {
  expect(powerKw(T, 10)).toBeCloseTo(1400, 9);
  expect(powerKw(T, 8)).toBeCloseTo(800, 9);
});

test('power is zero below cut-in and at or above cut-out', () => {
  expect(powerKw(T, 2.99)).toBe(0);
  expect(powerKw(T, 25)).toBe(0);
  expect(powerKw(T, 40)).toBe(0);
  expect(powerKw(T, -1)).toBe(0);
});

test('power is never negative or above the rating', () => {
  for (let v = 0; v <= 40; v += 0.25) {
    expect(powerKw(T, v)).toBeGreaterThanOrEqual(0);
    expect(powerKw(T, v)).toBeLessThanOrEqual(2000);
  }
});

test('a missing speed gives a missing power', () => {
  expect(powerKw(T, Number.NaN)).toBeNaN();
});

test('thrust from power coefficient', () => {
  expect(ctFromCp(0.512)).toBeCloseTo(0.64, 6);
  expect(ctFromCp(16 / 27)).toBeCloseTo(0.888889, 5);
  expect(ctFromCp(0.7)).toBeCloseTo(0.888889, 5); // capped at the Betz limit
  expect(ctFromCp(0)).toBe(0);
});

test('thrust is zero when the turbine is not running', () => {
  expect(thrustCoefficient(T, 2)).toBe(0);
  expect(thrustCoefficient(T, 26)).toBe(0);
  expect(thrustCoefficient(T, 8)).toBeGreaterThan(0);
});

test('a published thrust curve is used when there is one', () => {
  const withCurve: TurbineSpec = { ...T, curve_ct: [0.9, 0.8, 0.4, 0.1] };
  expect(thrustCoefficient(withCurve, 10)).toBeCloseTo(0.6, 9);
  expect(thrustCoefficient(withCurve, 2)).toBe(0);
});
