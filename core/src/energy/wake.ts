// The Jensen (Park) wake: the slower air behind one rotor, how much of a downstream rotor it
// covers, and how several wakes add up. A direct port of `energy/wake.py`.

/** Wake expansion: the wake's radius grows 0.075 m per metre downwind. */
export const K_DEFAULT = 0.075;

/** Fractional speed drop inside the wake `alongM` metres downwind of a rotor of radius `r0` with
 * thrust coefficient `ct`. Zero at or upwind of the rotor. */
export function deficit(ct: number, alongM: number, r0: number, k = K_DEFAULT): number {
  if (!(ct >= 0 && ct <= 1)) throw new RangeError(`thrust coefficient ${ct} is outside 0 to 1`);
  if (!(r0 > 0)) throw new RangeError(`rotor radius ${r0} must be positive`);
  if (alongM <= 0) return 0;
  return (1 - Math.sqrt(1 - ct)) / (1 + (k * alongM) / r0) ** 2;
}

/** Share of a rotor disc (radius `r0`) inside a wake circle (radius `rw`) whose centre is
 * `acrossM` metres away: the two-circle lens area divided by the rotor's area. */
export function overlapFraction(r0: number, rw: number, acrossM: number): number {
  if (!(r0 > 0) || !(rw > 0)) throw new RangeError(`radii must be positive, got rotor ${r0} and wake ${rw}`);
  const d = Math.abs(acrossM);
  if (d >= r0 + rw) return 0;
  if (d <= rw - r0) return 1; // rotor entirely inside the wake
  if (d <= r0 - rw) return (rw / r0) ** 2; // wake entirely inside the rotor
  // Clamped because rounding can push the cosine a hair past 1 near the boundaries above.
  const clamp = (c: number) => Math.min(1, Math.max(-1, c));
  const a = r0 * r0 * Math.acos(clamp((d * d + r0 * r0 - rw * rw) / (2 * d * r0)));
  const b = rw * rw * Math.acos(clamp((d * d + rw * rw - r0 * r0) / (2 * d * rw)));
  const c = 0.5 * Math.sqrt(Math.max(0, (-d + r0 + rw) * (d + r0 - rw) * (d - r0 + rw) * (d + r0 + rw)));
  return (a + b - c) / (Math.PI * r0 * r0);
}

/** Total deficit at one turbine from several wakes: the root of the sum of squares. */
export function combine(effects: readonly number[]): number {
  let sum = 0;
  for (const e of effects) sum += e * e;
  return Math.sqrt(sum);
}
