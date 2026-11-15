import { backHill, frontHill, layout } from './layout';

test('scale factor', () => {
  expect(layout(1440, 820).s).toBeCloseTo(1.025, 3);
  expect(layout(390, 780).s).toBeCloseTo(0.4875, 4);
});

test('sun position and size', () => {
  const { sun } = layout(1440, 820);
  expect(sun.x).toBeCloseTo(950.4, 1);
  expect(sun.y).toBeCloseTo(565.8, 1);
  expect(sun.r).toBeCloseTo(106.6, 1);
});

test('three turbines, the first on the front hill', () => {
  const t = layout(1440, 820).turbines;
  expect(t).toHaveLength(3);
  expect(t[0]!.front).toBe(true);
  expect(t[1]!.front).toBe(false);
  expect(t[0]!.baseX).toBeCloseTo(1152, 1);
  expect(t[0]!.baseY).toBeCloseTo(frontHill(1152, 820), 6);
  expect(t[1]!.baseY).toBeCloseTo(backHill(t[1]!.baseX, 820), 6);
  expect(t[0]!.hubY).toBeCloseTo(t[0]!.baseY - 0.36 * 820, 6);
  expect(t[0]!.radius).toBeCloseTo(172.2, 1);
});

test('on a narrow screen the rotor is limited by width', () => {
  expect(layout(390, 780).turbines[0]!.radius).toBeCloseTo(66.3, 1);
});

test('hills stay inside the stage and never cross', () => {
  for (const [w, h] of [[390, 780], [1440, 820], [2560, 1300], [5120, 1440]] as const) {
    for (let x = 0; x <= w; x += 10) {
      const b = backHill(x, h), f = frontHill(x, h);
      expect(b).toBeGreaterThan(0.6 * h);
      expect(f).toBeGreaterThanOrEqual(b + 0.02 * h - 1e-9);
      expect(f).toBeLessThan(h);
    }
  }
});
