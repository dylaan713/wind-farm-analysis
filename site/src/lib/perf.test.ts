import { frameBudget } from './perf';

test('a fast device never trips', () => {
  const b = frameBudget();
  for (let i = 0; i < 1000; i++) expect(b.push(16.7)).toBe(false);
});

test('a slow device trips once, after a full window', () => {
  const b = frameBudget(24, 90);
  const hits: number[] = [];
  for (let i = 0; i < 400; i++) if (b.push(40)) hits.push(i);
  expect(hits).toEqual([89]);
});

test('one long stall does not trip it', () => {
  const b = frameBudget(24, 90);
  let tripped = false;
  for (let i = 0; i < 300; i++) tripped = b.push(i === 50 ? 900 : 16.7) || tripped;
  expect(tripped).toBe(false);
});
