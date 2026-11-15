import { palette } from '../palette';
import { sceneSvg } from './svg';

test('svg is self-contained', () => {
  const svg = sceneSvg(1440, 820);
  expect(svg.startsWith('<svg')).toBe(true);
  expect(svg).not.toMatch(/<script|href=|url\(http/);
  expect(svg).toContain('viewBox="0 0 1440 820"');
  expect(svg).toContain('role="img"');
});

test('svg uses only palette colours', () => {
  const allowed = new Set(Object.values(palette).map((c) => c.toUpperCase()));
  const used = sceneSvg(1440, 820).match(/#[0-9a-fA-F]{6}\b/g) ?? [];
  expect(used.length).toBeGreaterThan(10);
  for (const c of used) expect(allowed.has(c.toUpperCase()), c).toBe(true);
});

test('svg has streaks of both colours', () => {
  const svg = sceneSvg(1440, 820);
  expect((svg.match(new RegExp(`stroke="${palette.air}"[^>]*data-streak`, 'g')) ?? []).length).toBeGreaterThanOrEqual(40);
  expect((svg.match(new RegExp(`stroke="${palette.signal}"[^>]*data-streak`, 'g')) ?? []).length).toBeGreaterThanOrEqual(8);
});

test('the drawing is identical every build', () => {
  expect(sceneSvg(390, 780)).toBe(sceneSvg(390, 780));
});

test('gradient ids do not collide between two sizes on one page', () => {
  const ids = (s: string) => [...s.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]);
  const a = ids(sceneSvg(1440, 820)), b = ids(sceneSvg(390, 780));
  expect(a.filter((id) => b.includes(id))).toEqual([]);
});
