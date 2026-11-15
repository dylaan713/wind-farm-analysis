import { AIR_LEVELS, airLevel, airShare, fadeStep, type Rect } from './zones';

const zone: Rect = { x: 100, y: 100, w: 200, h: 50 };

test('no air inside a calm zone', () => {
  expect(airShare(150, 120, [zone])).toBe(0);
  expect(airShare(100, 100, [zone])).toBe(0);
  expect(airShare(300, 150, [zone])).toBe(0);
});

test('full air well outside', () => {
  expect(airShare(400, 120, [zone])).toBe(1);
  expect(airShare(150, 300, [zone])).toBe(1);
  expect(airShare(5, 5, [])).toBe(1);
});

test('air returns gradually over the feather', () => {
  expect(airShare(312, 120, [zone], 24)).toBeCloseTo(0.5, 6);   // 12 px right of the edge
  expect(airShare(150, 88, [zone], 24)).toBeCloseTo(0.5, 6);    // 12 px above
  expect(airShare(310, 160, [zone], 24)).toBeCloseTo(Math.hypot(10, 10) / 24, 6); // off the corner
  expect(airShare(318, 168, [zone], 24)).toBe(1);                                 // capped at full
});

test('the nearest zone wins', () => {
  const other: Rect = { x: 330, y: 100, w: 50, h: 50 };
  expect(airShare(320, 120, [zone, other], 24)).toBeCloseTo(10 / 24, 6);
});

test('the clean-up step is one level per 60fps frame, and never less than one', () => {
  expect(fadeStep(1 / 60)).toBe(1);
  expect(fadeStep(1 / 30)).toBe(2);
  expect(fadeStep(1 / 240)).toBe(1);
  expect(fadeStep(0)).toBe(1);
});

test('the air returns in even steps', () => {
  expect(airLevel(0)).toBe(0);
  expect(airLevel(0.2)).toBe(1);
  expect(airLevel(0.5)).toBe(2);
  expect(airLevel(0.7)).toBe(3);
  expect(airLevel(1)).toBe(AIR_LEVELS);
});
