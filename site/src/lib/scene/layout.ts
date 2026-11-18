// Where everything in the first-screen scene sits, from the stage's width and height alone.
// Pure: the static drawing and the live canvas both read from here.

export interface TurbinePose {
  baseX: number;
  baseY: number;
  hubY: number;
  radius: number;
  scale: number;
  front: boolean;
}

export interface Scene {
  w: number;
  h: number;
  /** Lengths tuned on an 800px stage are multiplied by this, so a phone feels like a laptop. */
  s: number;
  /** Where the light comes from. Nothing is drawn there; the near turbine's shadow falls away from it. */
  light: { x: number };
  turbines: TurbinePose[];
}

export function backHill(x: number, h: number): number {
  return h * (0.71 + 0.05 * Math.sin(0.003 * x + 2.2));
}

/** The near ridge. Kept at least 2% of the height below the far hill so the two never cross on very wide screens. */
export function frontHill(x: number, h: number): number {
  const y = h * (0.8 + 0.035 * Math.sin(0.004 * x + 1) + 0.012 * Math.sin(0.011 * x));
  return Math.max(y, backHill(x, h) + 0.02 * h);
}

const TURBINES = [
  { at: 0.8, scale: 1, front: true },
  { at: 0.57, scale: 0.58, front: false },
  { at: 0.94, scale: 0.42, front: false },
] as const;

/**
 * `clearBelow` is a y that text reaches down to. Turbines are shortened so their blade tips stay
 * under it, as far as they can be while still standing clear of the ground.
 */
export function layout(w: number, h: number, opts: { clearBelow?: number } = {}): Scene {
  const turbines = TURBINES.map(({ at, scale, front }): TurbinePose => {
    const baseX = at * w;
    const baseY = (front ? frontHill : backHill)(baseX, h);
    const radius = Math.min(0.21 * h, 0.17 * w) * scale;
    let hubY = baseY - 0.36 * h * scale;
    if (opts.clearBelow !== undefined) hubY = Math.min(baseY - radius * 1.15, Math.max(hubY, opts.clearBelow + radius));
    return { baseX, baseY, hubY, radius, scale, front };
  });
  return { w, h, s: Math.min(w, h) / 800, light: { x: 0.66 * w }, turbines };
}

/** How high the particles may fall before they are recycled: just above the far hill. */
export const AIR_FLOOR = 0.86;

/** The ridge never drops below this share of the scene's height (0.8 + 0.035 + 0.012). */
const RIDGE_LOWEST = 0.847;

/**
 * The height to lay the scene out in, given the stage height and the y where something (the
 * chapter links) starts at the bottom of the stage. The ridge is kept 12px above it.
 */
export function fitHeight(h: number, clearBelow: number): number {
  return Math.max(Math.min(150, h), Math.min(h, (clearBelow - 12) / RIDGE_LOWEST));
}
