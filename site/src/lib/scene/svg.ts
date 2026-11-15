// The first screen as a still drawing. This is what shows with JavaScript off and under
// reduced motion, and what sits behind the canvas until its first frame is painted.
import { palette } from '../palette';
import { baseWind } from '../wind/base';
import { backHill, frontHill, layout, type TurbinePose } from './layout';

const n = (v: number) => (Math.round(v * 10) / 10).toString();

/** Small seeded generator so the drawing is identical on every build. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hillPath(fn: (x: number, h: number) => number, w: number, h: number, close: boolean): string {
  let d = '';
  for (let x = 0; x <= w; x += 12) d += `${x ? 'L' : 'M'}${n(x)},${n(fn(x, h))}`;
  d += `L${n(w)},${n(fn(w, h))}`;
  return close ? `${d}L${n(w)},${n(h)}L0,${n(h)}Z` : d;
}

/** One streak: a short path that follows the still breeze from a starting point. */
function streak(x: number, y: number, steps: number, slow = 1): string {
  let d = `M${n(x)},${n(y)}`;
  for (let i = 0; i < steps; i++) {
    const [u, v] = baseWind(x, y, 0);
    x += u * 5 * slow;
    y += v * 5 * slow;
    d += `L${n(x)},${n(y)}`;
  }
  return d;
}

function turbine(t: TurbinePose, colour: string, angle: number): string {
  const k = t.scale, R = t.radius;
  const blade = `M0,${n(-5 * k)}Q${n(R * 0.35)},${n(-11 * k)} ${n(R)},${n(-1.5 * k)}L${n(R)},${n(1.5 * k)}Q${n(R * 0.3)},${n(6 * k)} 0,${n(5 * k)}Z`;
  const blades = [0, 120, 240]
    .map((a) => `<path d="${blade}" fill="${colour}" transform="translate(${n(t.baseX)},${n(t.hubY)}) rotate(${a + angle})"/>`)
    .join('');
  return (
    `<path d="M${n(t.baseX)},${n(t.baseY)}L${n(t.baseX)},${n(t.hubY)}" stroke="${colour}" stroke-width="${n(5 * k)}" stroke-linecap="round"/>` +
    blades +
    `<circle cx="${n(t.baseX)}" cy="${n(t.hubY)}" r="${n(8 * k)}" fill="${palette.signal}"/>`
  );
}

export function sceneSvg(w: number, h: number): string {
  const sc = layout(w, h), { sun } = sc, id = `s${w}x${h}`, rand = seeded(w * 7919 + h);
  const [near, farA, farB] = sc.turbines as [TurbinePose, TurbinePose, TurbinePose];

  let air = '';
  const count = w < 640 ? 70 : 130;
  for (let i = 0; i < count; i++) {
    const x = rand() * w, y = rand() * h * 0.74, o = 0.18 + rand() * 0.3;
    air += `<path d="${streak(x, y, 5 + Math.floor(rand() * 9))}" stroke="${palette.air}" stroke-opacity="${(Math.round(o * 100) / 100).toString()}" data-streak=""/>`;
  }
  let wake = '';
  for (const t of sc.turbines) {
    const lines = t.front ? 9 : 5;
    for (let i = 0; i < lines; i++) {
      const y = t.hubY + (rand() * 2 - 1) * t.radius * 0.92, x = t.baseX + 4 + rand() * t.radius * 0.5;
      wake += `<path d="${streak(x, y, 6 + Math.floor(rand() * 8), 0.62)}" stroke="${palette.signal}" stroke-opacity="0.85" stroke-width="1.7" data-streak=""/>`;
    }
  }

  let grass = '';
  for (let x = 6; x < w; x += 11) {
    const y = frontHill(x, h), len = 9 + ((x * 7) % 9);
    grass += `M${n(x)},${n(y)}q0.8,${n(-len * 0.6)} 2.5,${n(-len)}`;
  }

  const shadowX = near.baseX + (near.baseX - sun.x) * 1.3, shadowY = near.baseY + Math.min(w * 0.3, 260) * 0.3;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" role="img" aria-label="A sun low over two hills with three wind turbines" fill="none">` +
    `<defs>` +
    `<linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${palette.air}" stop-opacity="0.13"/><stop offset="0.72" stop-color="${palette.air}" stop-opacity="0"/></linearGradient>` +
    `<radialGradient id="${id}-halo" cx="${n(sun.x)}" cy="${n(sun.y)}" r="${n(Math.max(w, h) * 0.5)}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${palette.signal}" stop-opacity="0.2"/><stop offset="0.3" stop-color="${palette.signal}" stop-opacity="0.05"/><stop offset="1" stop-color="${palette.signal}" stop-opacity="0"/></radialGradient>` +
    `<linearGradient id="${id}-shade" x1="${n(near.baseX)}" y1="${n(near.baseY)}" x2="${n(shadowX)}" y2="${n(shadowY)}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${palette.air}" stop-opacity="0.28"/><stop offset="1" stop-color="${palette.air}" stop-opacity="0"/></linearGradient>` +
    `</defs>` +
    `<rect width="${w}" height="${h}" fill="${palette.ground}"/>` +
    `<rect width="${w}" height="${h}" fill="url(#${id}-sky)"/>` +
    `<rect width="${w}" height="${h}" fill="url(#${id}-halo)"/>` +
    `<circle cx="${n(sun.x)}" cy="${n(sun.y)}" r="${n(sun.r)}" fill="${palette.signal}"/>` +
    `<g stroke-linecap="round" stroke-width="1.2">${air}${wake}</g>` +
    `<path d="${hillPath(backHill, w, h, true)}" fill="${palette.surface}"/>` +
    `<path d="${hillPath(backHill, w, h, false)}" stroke="${palette.air}" stroke-opacity="0.55"/>` +
    turbine(farA, palette.farTurbine, 28) +
    turbine(farB, palette.farTurbine, 75) +
    `<path d="${hillPath(frontHill, w, h, true)}" fill="${palette.ground}"/>` +
    `<path d="${hillPath(frontHill, w, h, false)}" stroke="${palette.ink}" stroke-width="1.75"/>` +
    `<path d="M${n(near.baseX)},${n(near.baseY + 4)}L${n(shadowX)},${n(shadowY)}" stroke="url(#${id}-shade)" stroke-width="9" stroke-linecap="round"/>` +
    `<path d="${grass}" stroke="${palette.ink}" stroke-opacity="0.6"/>` +
    turbine(near, palette.ink, 12) +
    `</svg>`
  );
}
