// Calm zones: boxes behind text where no air is drawn, so the words stay readable however
// hard the visitor pushes the wind. Around each box the air comes back gradually.

export interface Rect { x: number; y: number; w: number; h: number }

/** How much air may be drawn at a point: 0 inside any zone, 1 once `feather` px clear of all of them. */
export function airShare(x: number, y: number, zones: readonly Rect[], feather = 24): number {
  let share = 1;
  for (const z of zones) {
    const dx = Math.max(z.x - x, x - (z.x + z.w), 0), dy = Math.max(z.y - y, y - (z.y + z.h), 0);
    share = Math.min(share, Math.hypot(dx, dy) / feather);
  }
  return Math.min(1, share);
}

/** Streaks near text are drawn in this many strengths, so the air thins out instead of stopping at an edge. */
export const AIR_LEVELS = 4;

/** Which strength to draw at: 0 means not at all, AIR_LEVELS means full. */
export function airLevel(share: number): number {
  return share <= 0 ? 0 : Math.min(AIR_LEVELS, Math.ceil(share * AIR_LEVELS));
}

/**
 * Streaks fade by mixing toward white, which keeps their colour true. That alone never quite
 * finishes: 8-bit rounding leaves a few levels behind for good. So each frame the canvas is also
 * lightened by this many whole levels, which clears the remainder within a few frames.
 */
export function fadeStep(dt: number): number {
  return Math.max(1, Math.round(dt * 60));
}
