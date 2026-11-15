// The one spring on the site. It makes letters lean and controls settle.

export interface Spring { value: number; velocity: number }

const MAX_LEAN_DEG = 15, LEAN_PER_WIND = 2.4;

/** Advance a spring toward its target by dt seconds. Tuned per 60fps frame, scaled for other rates. */
export function stepSpring(sp: Spring, target: number, dt: number, stiffness = 0.16, damping = 0.76): Spring {
  const k = dt * 60;
  const velocity = (sp.velocity + (target - sp.value) * stiffness * k) * damping ** k;
  return { value: sp.value + velocity * k, velocity };
}

/** How far a letter leans, in degrees, for a given sideways push from the visitor's wind. */
export function leanTarget(gustU: number): number {
  return Math.max(-MAX_LEAN_DEG, Math.min(MAX_LEAN_DEG, gustU * LEAN_PER_WIND));
}
