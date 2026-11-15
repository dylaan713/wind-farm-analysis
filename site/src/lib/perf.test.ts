import { frameBudget } from './perf';

const firstTrip = (ms: number, frames = 400) => {
  const b = frameBudget(), hits: number[] = [];
  for (let i = 0; i < frames; i++) if (b.push(ms)) hits.push(i);
  return hits;
};

test('a fast device never trips', () => expect(firstTrip(16.7, 1000)).toEqual([]));

test('a slow device trips once, after two seconds of slow frames', () => {
  expect(firstTrip(40)).toEqual([49]); // 50 frames × 40 ms
  expect(firstTrip(30)).toEqual([66]); // 67 frames × 30 ms
});

test('a very slow device is not kept waiting for a full window of frames', () => {
  // 300 ms frames count as 100 ms each: 20 of them is two seconds.
  expect(firstTrip(300)).toEqual([19]);
});

test('a device just inside the budget never trips', () => expect(firstTrip(23.9, 1000)).toEqual([]));

test('one long stall does not trip it', () => {
  const b = frameBudget();
  let tripped = false;
  for (let i = 0; i < 300; i++) tripped = b.push(i === 50 ? 900 : 16.7) || tripped;
  expect(tripped).toBe(false);
});

test('a burst of slow frames after a long fast run does not trip it', () => {
  const b = frameBudget();
  let tripped = false;
  for (let i = 0; i < 600; i++) tripped = b.push(i >= 500 && i < 510 ? 80 : 16.7) || tripped;
  expect(tripped).toBe(false);
});
