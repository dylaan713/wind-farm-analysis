// The first screen's readings. Every number shown (wind, output, energy) describes the SAME ONE
// turbine, the near one, so they always agree with each other. These describe a DEMO turbine driven by the visitor's wind,
// never the real farm, and the page labels them that way. When core/src/energy exists,
// demoPowerKw is replaced by the real turbine's power curve.

const MS_PER_UNIT = 4.5, MAX_SHOWN_MS = 24;
const RATED_KW = 3400, CUT_IN = 3, RATED_AT = 12, CUT_OUT = 25;
/** kWh from the one demo turbine at which each chapter link is full. */
const FILL_AT = [1, 3, 6, 10] as const;

/**
 * Wind speed shown to the visitor, in m/s, from the field's px-per-step wind. A fast sweep can
 * push the field far past anything real, so the reading tops out just under the turbine's cut-out:
 * pushing harder never switches the demo turbine off.
 */
export function shownSpeed(u: number, v: number): number {
  return Math.min(MAX_SHOWN_MS, Math.hypot(u, v) * MS_PER_UNIT);
}

export function demoPowerKw(ms: number): number {
  if (!(ms > CUT_IN) || ms >= CUT_OUT) return 0;
  return RATED_KW * Math.min(1, ((ms - CUT_IN) / (RATED_AT - CUT_IN)) ** 3);
}

/** Add kW over dt seconds to a kWh total. A gap longer than maxDt (a hidden tab, a stall) counts as maxDt. */
export function addEnergy(kwh: number, kw: number, dt: number, maxDt = 0.05): number {
  if (!(kw > 0) || !(dt > 0)) return kwh;
  return kwh + (kw * Math.min(dt, maxDt)) / 3600;
}

/** How full each of the four chapter chips is, 0 to 1, filling in order. */
export function chapterFill(kwh: number): [number, number, number, number] {
  return FILL_AT.map((hi, i) => {
    const lo = i ? FILL_AT[i - 1]! : 0;
    return Math.min(1, Math.max(0, (kwh - lo) / (hi - lo)));
  }) as [number, number, number, number];
}

export function particleCount(w: number): number {
  return w < 640 ? 520 : 1200;
}
