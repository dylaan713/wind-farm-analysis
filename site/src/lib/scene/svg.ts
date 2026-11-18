// The first screen as a still drawing. This is what shows with JavaScript off and under
// reduced motion, and what sits behind the canvas until its first frame is painted.
import { SKY_TINT, palette } from '../palette';
import { baseWind } from '../wind/base';
import { WAKE_SPREAD } from '../wind/particles';
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

/** One streak: a short path that follows the still breeze from a starting point. `drift` is a wake's sideways spread. */
function streak(x: number, y: number, steps: number, slow = 1, drift = 0): string {
  let d = `M${n(x)},${n(y)}`;
  for (let i = 0; i < steps; i++) {
    const [u, v] = baseWind(x, y, 0);
    x += u * 5 * slow;
    y += v * 5 * slow + drift * Math.abs(u * 5 * slow);
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

/** The cable that carries the near turbine's energy away along the ridge, as a path from the turbine to the left edge. */
function cablePath(toX: number, h: number): string {
  let d = `M${n(toX)},${n(frontHill(toX, h))}`;
  for (let x = Math.floor(toX / 12) * 12; x >= 0; x -= 12) d += `L${n(x)},${n(frontHill(x, h))}`;
  return d;
}

export function sceneSvg(w: number, h: number): string {
  const sc = layout(w, h), id = `s${w}x${h}`, rand = seeded(w * 7919 + h);
  const [near, farA, farB] = sc.turbines as [TurbinePose, TurbinePose, TurbinePose];

  let air = '';
  const count = w < 640 ? 120 : 230;
  for (let i = 0; i < count; i++) {
    const x = rand() * w, y = rand() * h * 0.74, o = 0.18 + rand() * 0.3;
    air += `<path d="${streak(x, y, 5 + Math.floor(rand() * 9))}" stroke="${palette.air}" stroke-opacity="${(Math.round(o * 100) / 100).toString()}" data-streak=""/>`;
  }
  let wake = '';
  for (const t of sc.turbines) {
    const lines = t.front ? 11 : 6;
    for (let i = 0; i < lines; i++) {
      const off = (rand() * 2 - 1) * 0.92, y = t.hubY + off * t.radius, x = t.baseX + 4 + rand() * t.radius * 0.5;
      wake += `<path d="${streak(x, y, 6 + Math.floor(rand() * 8), 0.62, WAKE_SPREAD * off)}" stroke="${palette.signal}" stroke-opacity="0.85" stroke-width="1.7" data-streak=""/>`;
    }
  }

  // Energy on its way along the cable: a few dots, each with a short tail behind it.
  let pulses = '';
  for (let i = 0; i < 9; i++) {
    const x = near.baseX - ((i + 0.5) * near.baseX) / 9, y = frontHill(x, h);
    pulses += `<path d="M${n(x)},${n(y)}L${n(x + 16)},${n(frontHill(x + 16, h))}" stroke="${palette.signal}" stroke-width="2.25" stroke-linecap="round"/><circle cx="${n(x)}" cy="${n(y)}" r="4.5" fill="${palette.signal}"/>`;
  }

  const shadowX = near.baseX + (near.baseX - sc.light.x) * 1.3, shadowY = near.baseY + Math.min(w * 0.3, 260) * 0.3;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Three wind turbines on two hills, in moving air" fill="none">` +
    `<defs>` +
    `<linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${palette.air}" stop-opacity="${SKY_TINT}"/><stop offset="1" stop-color="${palette.air}" stop-opacity="0"/></linearGradient>` +
    `<linearGradient id="${id}-land" x1="0" y1="0" x2="0" y2="1"><stop offset="0.8" stop-color="${palette.surface}"/><stop offset="1" stop-color="${palette.ground}"/></linearGradient>` +
    `<linearGradient id="${id}-shade" x1="${n(near.baseX)}" y1="${n(near.baseY)}" x2="${n(shadowX)}" y2="${n(shadowY)}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${palette.air}" stop-opacity="0.28"/><stop offset="1" stop-color="${palette.air}" stop-opacity="0"/></linearGradient>` +
    `</defs>` +
    `<rect width="${w}" height="${h}" fill="${palette.ground}"/>` +
    `<rect width="${w}" height="${h}" fill="url(#${id}-sky)"/>` +
    `<g stroke-linecap="round" stroke-width="1.2">${air}${wake}</g>` +
    `<path d="${hillPath(backHill, w, h, true)}" fill="${palette.hillFar}"/>` +
    `<path d="${hillPath(backHill, w, h, false)}" stroke="${palette.air}" stroke-opacity="0.55"/>` +
    turbine(farA, palette.farTurbine, 28) +
    turbine(farB, palette.farTurbine, 75) +
    `<rect width="${w}" height="${h}" fill="url(#${id}-land)" clip-path="path('${hillPath(frontHill, w, h, true)}')"/>` +
    `<path d="${hillPath(frontHill, w, h, false)}" stroke="${palette.ink}" stroke-width="1.75"/>` +
    `<path d="M${n(near.baseX)},${n(near.baseY + 4)}L${n(shadowX)},${n(shadowY)}" stroke="url(#${id}-shade)" stroke-width="9" stroke-linecap="round"/>` +
    `<path d="${cablePath(near.baseX, h)}" stroke="${palette.ink}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>` +
    pulses +
    turbine(near, palette.ink, 12) +
    `</svg>`
  );
}
