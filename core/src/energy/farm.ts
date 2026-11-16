// The farm: each turbine's waked wind speed, farm power, and a year's energy from a wind rose.
// A direct port of `energy/farm.py`, one wind speed at a time so it is fast enough to run while a
// turbine is being dragged.
import { powerKw, thrustCoefficient } from './turbine';
import type { Point, TurbineSpec, WindRose } from './types';
import { K_DEFAULT, deficit, overlapFraction } from './wake';

/** Hours in an average year (365.25 days). */
export const HOURS_PER_YEAR = 8766;

/**
 * Wind speed at each turbine, in the order given, when the free wind is `v` m/s from
 * `windFromDeg` (compass bearing the wind comes from, clockwise from north). Turbines are taken
 * from most upwind to most downwind, and each wake is given the thrust of its own turbine's waked
 * speed.
 */
export function turbineSpeeds(t: TurbineSpec, layout: readonly Point[], windFromDeg: number, v: number, k = K_DEFAULT): number[] {
  const n = layout.length;
  const r0 = t.rotor_diameter_m / 2;
  const theta = (windFromDeg * Math.PI) / 180;
  const sin = Math.sin(theta);
  const cos = Math.cos(theta);
  // The air travels toward (-sin, -cos); the crosswind axis is perpendicular to it.
  const downwind = layout.map((p) => -p.x * sin - p.y * cos);
  const crosswind = layout.map((p) => p.x * cos - p.y * sin);
  const order = layout.map((_, i) => i).sort((a, b) => downwind[a]! - downwind[b]! || a - b);

  const speeds = new Array<number>(n).fill(v);
  const ct = new Array<number>(n).fill(0);
  for (let place = 0; place < n; place++) {
    const i = order[place]!;
    let sumOfSquares = 0;
    for (let earlier = 0; earlier < place; earlier++) {
      const j = order[earlier]!;
      const along = downwind[i]! - downwind[j]!;
      if (along <= 0 || ct[j]! <= 0) continue;
      const covered = overlapFraction(r0, r0 + k * along, crosswind[i]! - crosswind[j]!);
      if (covered <= 0) continue;
      const effect = deficit(ct[j]!, along, r0, k) * covered;
      sumOfSquares += effect * effect;
    }
    // Root-sum-square of many close wakes can pass 1; the air cannot blow backwards.
    speeds[i] = v * (1 - Math.min(Math.sqrt(sumOfSquares), 1));
    ct[i] = thrustCoefficient(t, speeds[i]!);
  }
  return speeds;
}

export function farmPowerKw(t: TurbineSpec, layout: readonly Point[], windFromDeg: number, v: number, k = K_DEFAULT): number {
  let total = 0;
  for (const speed of turbineSpeeds(t, layout, windFromDeg, v, k)) total += powerKw(t, speed);
  return total;
}

/**
 * Net energy in an average year, MWh: farm power at every direction and speed of the rose,
 * weighted by how often each happens, times the calibration factor. The factor is fitted to the
 * farm's reported output; it is not a loss figure.
 */
export function annualEnergyMwh(t: TurbineSpec, layout: readonly Point[], rose: WindRose, calibrationFactor: number): number {
  let meanKw = 0;
  rose.freq.forEach((row, i) => {
    row.forEach((share, j) => {
      const speed = j * rose.speed_step;
      if (share > 0 && speed >= t.cut_in && speed < t.cut_out) {
        meanKw += share * farmPowerKw(t, layout, i * rose.dir_step, speed);
      }
    });
  });
  return (meanKw * HOURS_PER_YEAR * calibrationFactor) / 1000;
}
