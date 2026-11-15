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
  sun: { x: number; y: number; r: number };
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

export function layout(w: number, h: number): Scene {
  const turbines = TURBINES.map(({ at, scale, front }): TurbinePose => {
    const baseX = at * w;
    const baseY = (front ? frontHill : backHill)(baseX, h);
    return { baseX, baseY, hubY: baseY - 0.36 * h * scale, radius: Math.min(0.21 * h, 0.17 * w) * scale, scale, front };
  });
  return { w, h, s: Math.min(w, h) / 800, sun: { x: 0.66 * w, y: 0.69 * h, r: 0.13 * Math.min(w, h) }, turbines };
}

/** How high the particles may fall before they are recycled: just above the far hill. */
export const AIR_FLOOR = 0.86;
