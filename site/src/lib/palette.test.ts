import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HILL_TINT, SKY_TINT, bannedPairs, contrast, mix, palette, rgb, textPairs, type Role } from './palette';

const SRC = fileURLToPath(new URL('..', import.meta.url));
const kebab = (s: string) => s.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);

test('known ratios', () => {
  expect(contrast('#0A1220', '#FFFFFF')).toBeCloseTo(18.75, 2);
  expect(contrast('#FF5B14', '#FFFFFF')).toBeCloseTo(3.11, 2);
  expect(contrast('#FF5B14', '#1890FF')).toBeCloseTo(1.04, 2);
  expect(contrast('#FFFFFF', '#0A1220')).toBeCloseTo(18.75, 2);
});

test('the sky and the far hill are the air colour laid over the ground', () => {
  expect(mix('#FFFFFF', '#000000', 0.5)).toBe('#808080');
  expect(palette.sky).toBe(mix(palette.ground, palette.air, SKY_TINT));
  expect(palette.hillFar).toBe(mix(palette.ground, palette.air, HILL_TINT));
});

test('the bright orange has room to spare on white, and the two brand colours are equally bright', () => {
  expect(contrast(palette.signal, palette.ground)).toBeGreaterThanOrEqual(3.5);
  expect(contrast(palette.signal, palette.air)).toBeLessThan(1.2);
});

test.each(textPairs)('$fg on $bg meets $min', ({ fg, bg, min }) => {
  expect(contrast(palette[fg], palette[bg])).toBeGreaterThanOrEqual(min);
});

test.each(bannedPairs)('%s on %s really is unusable', (fg, bg) => {
  expect(contrast(palette[fg], palette[bg])).toBeLessThan(3);
});

test('tokens.css mirrors the palette', () => {
  const css = readFileSync(join(SRC, 'styles/tokens.css'), 'utf8');
  for (const role of Object.keys(palette) as Role[]) {
    const m = css.match(new RegExp(`--${kebab(role)}:\\s*(#[0-9a-fA-F]{6})\\b`));
    expect(m?.[1]?.toUpperCase(), `--${kebab(role)}`).toBe(palette[role].toUpperCase());
  }
});

test('no stray hex colours in site/src', () => {
  const allowed = new Set(['lib/palette.ts', 'lib/palette.test.ts', 'styles/tokens.css']);
  const offenders: string[] = [];
  const walk = (dir: string, rel = '') => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name), r = rel ? `${rel}/${name}` : name;
      if (statSync(full).isDirectory()) walk(full, r);
      else if (/\.(ts|astro|css|mjs)$/.test(name) && !allowed.has(r) && /#[0-9a-fA-F]{6}\b/.test(readFileSync(full, 'utf8'))) offenders.push(r);
    }
  };
  walk(SRC);
  expect(offenders).toEqual([]);
});

test('rgb parses', () => expect(rgb('#1890FF')).toEqual([24, 144, 255]));
