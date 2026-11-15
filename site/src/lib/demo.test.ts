import { addEnergy, chapterFill, demoPowerKw, particleCount, shownSpeed } from './demo';

test('shown speed', () => expect(shownSpeed(1.55, 0)).toBeCloseTo(6.975, 6));

test('a wild sweep tops out just under cut-out, so pushing harder never shuts the demo turbine down', () => {
  expect(shownSpeed(20, 0)).toBe(24);
  expect(demoPowerKw(shownSpeed(20, 0))).toBeCloseTo(3400, 6);
});

test('demo power', () => {
  expect(demoPowerKw(2.99)).toBe(0);
  expect(demoPowerKw(3)).toBe(0);
  expect(demoPowerKw(7.5)).toBeCloseTo(425, 6);
  expect(demoPowerKw(12)).toBeCloseTo(3400, 6);
  expect(demoPowerKw(20)).toBeCloseTo(3400, 6);
  expect(demoPowerKw(25)).toBe(0);
  expect(demoPowerKw(NaN)).toBe(0);
});

test('energy adds up', () => expect(addEnergy(0, 3600, 1, Infinity)).toBeCloseTo(1, 9));
test('a long gap adds at most 0.05 s', () => expect(addEnergy(0, 3600, 30)).toBeCloseTo(0.05, 9));
test('negative or NaN input adds nothing', () => {
  expect(addEnergy(2, -5, 1)).toBe(2);
  expect(addEnergy(2, NaN, 1)).toBe(2);
  expect(addEnergy(2, 100, NaN)).toBe(2);
  expect(addEnergy(2, 100, -1)).toBe(2);
});

test('chapter fill', () => {
  expect(chapterFill(0)).toEqual([0, 0, 0, 0]);
  expect(chapterFill(3)).toEqual([1, 0, 0, 0]);
  expect(chapterFill(6)).toEqual([1, 0.5, 0, 0]);
  expect(chapterFill(99)).toEqual([1, 1, 1, 1]);
});

test('fewer particles on a phone', () => {
  expect(particleCount(390)).toBe(340);
  expect(particleCount(640)).toBe(680);
});
