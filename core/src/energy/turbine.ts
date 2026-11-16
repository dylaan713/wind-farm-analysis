// One turbine: the power curve and thrust. A direct port of `energy/turbine.py`; every formula is
// written out in the energy plan under "The model, exactly".
import type { TurbineSpec } from './types';

/** kg/m3, the density power curves are published at. */
export const STANDARD_DENSITY = 1.225;
/** The most power any rotor can take from the wind. */
export const BETZ = 16 / 27;
export const CT_MAX = 0.9;
/**
 * Share of an ideal rotor's power that reaches the grid. Contains information from the Open
 * Energy Platform wind turbine library, © Reiner Lemoine Institut, made available under the Open
 * Database License (ODbL) 1.0. Only this number is taken from it.
 */
export const ROTOR_TO_GRID = 0.78;

/** Linear between the points; held at the end values outside them. `xs` must ascend. */
export function interpolate(x: number, xs: readonly number[], ys: readonly number[]): number {
  const last = xs.length - 1;
  if (last < 0 || ys.length !== xs.length) throw new RangeError('the curve needs matching speeds and values');
  if (x <= xs[0]!) return ys[0]!;
  if (x >= xs[last]!) return ys[last]!;
  let low = 0;
  let high = last;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (xs[mid]! <= x) low = mid;
    else high = mid;
  }
  const share = (x - xs[low]!) / (xs[high]! - xs[low]!);
  return ys[low]! + share * (ys[high]! - ys[low]!);
}

function running(t: TurbineSpec, v: number): boolean {
  return v >= t.cut_in && v < t.cut_out;
}

/** Power at speed v: linear between curve points, 0 below cut-in and at or above cut-out, never
 * above the rating. A missing speed gives a missing power. */
export function powerKw(t: TurbineSpec, v: number): number {
  if (Number.isNaN(v)) return Number.NaN;
  if (!running(t, v)) return 0;
  return Math.min(Math.max(interpolate(v, t.curve_v, t.curve_kw), 0), t.rated_kw);
}

/** Momentum theory: solve Cp = 4a(1-a)^2 for a in [0, 1/3] by bisection, then Ct = 4a(1-a). */
export function ctFromCp(cp: number): number {
  if (!(cp > 0)) return 0;
  const target = Math.min(cp, BETZ);
  let low = 0;
  let high = 1 / 3;
  for (let i = 0; i < 60; i++) {
    const mid = (low + high) / 2;
    if (4 * mid * (1 - mid) ** 2 < target) low = mid;
    else high = mid;
  }
  const a = (low + high) / 2;
  return Math.min(4 * a * (1 - a), CT_MAX);
}

/** Thrust derived from electrical power: the power an ideal rotor would have had to take from the
 * wind is the electrical power divided by `efficiency`. 0 where there is no power or no wind. */
export function ctFromPower(kw: number, v: number, rotorDiameterM: number, efficiency = ROTOR_TO_GRID): number {
  if (!(kw > 0) || !(v > 0)) return 0;
  const swept = Math.PI * (rotorDiameterM / 2) ** 2;
  const cp = (kw * 1000) / (0.5 * STANDARD_DENSITY * swept * v ** 3);
  return ctFromCp(cp / efficiency);
}

/** Ct at speed v: the published curve if the turbine has one, otherwise derived from the power
 * curve. 0 whenever the turbine is not running. */
export function thrustCoefficient(t: TurbineSpec, v: number): number {
  if (t.curve_ct !== null) return running(t, v) ? interpolate(v, t.curve_v, t.curve_ct) : 0;
  return ctFromPower(powerKw(t, v), v, t.rotor_diameter_m);
}
