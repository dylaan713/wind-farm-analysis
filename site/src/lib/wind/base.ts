/** The breeze that is always there, in px per step. It always blows left to right. */
export function baseWind(x: number, y: number, t: number): [number, number] {
  return [1.55 + 0.45 * Math.sin(0.011 * y + 0.7 * t), 0.4 * Math.sin(0.008 * x + 0.5 * t + 0.005 * y)];
}
