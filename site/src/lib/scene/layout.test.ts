import { backHill, fitHeight, frontHill, layout } from './layout';

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

test('the scene is shortened so the ridge clears whatever sits at the bottom of the stage', () => {
  // Tall laptop stage, one row of chips starting at 746: nothing to do.
  expect(fitHeight(820, 746)).toBe(820);
  // Small phone, two rows of chips starting at 450: the ridge's lowest point must end 12px above them.
  const h = fitHeight(568, 450);
  expect(h).toBeLessThan(568);
  for (let x = 0; x <= 320; x += 4) expect(frontHill(x, h)).toBeLessThanOrEqual(450 - 12 + 1e-6);
  // Never collapses to nothing.
  expect(fitHeight(300, 10)).toBeGreaterThanOrEqual(150);
});

test('turbines are shortened, when they can be, so their blades stay clear of text', () => {
  const free = layout(320, 540), kept = layout(320, 540, { clearBelow: 250 });
  kept.turbines.forEach((t, i) => {
    // The blade tips never reach above the line...
    expect(t.hubY - t.radius).toBeGreaterThanOrEqual(250 - 1e-6);
    // ...the turbine still stands on its hill...
    expect(t.baseY).toBeCloseTo(free.turbines[i]!.baseY, 6);
    // ...and is never raised.
    expect(t.hubY).toBeGreaterThanOrEqual(free.turbines[i]!.hubY - 1e-6);
  });
  // A turbine already clear of the line is left exactly as it was.
  expect(layout(1440, 820, { clearBelow: 100 })).toEqual(layout(1440, 820));
});

test('a turbine is never shortened into the ground', () => {
  const squeezed = layout(320, 540, { clearBelow: 520 });
  for (const t of squeezed.turbines) expect(t.baseY - t.hubY).toBeGreaterThanOrEqual(t.radius * 1.15 - 1e-6);
});
