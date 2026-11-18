// The one source of truth for colour. tokens.css mirrors it and a test keeps them in step.
// Blue is air, orange is energy: a complementary pair, opposite each other on the colour wheel.
// Orange appears only where energy is: the wake behind a rotor, the hubs, the cable, one word.
export const palette = {
  ground: '#FFFFFF',
  ink: '#0A1220',
  surface: '#EFF5FB',
  air: '#0684F9',
  signal: '#F54E00',
  third: '#5A687D',
  airDeep: '#0B62C4',
  signalDeep: '#BD3C00',
  farTurbine: '#34506F',
  sky: '#E4F1FE',
  hillFar: '#C8E4FE',
} as const;

/** How much of the air colour is laid over the ground at the top of the sky; it fades to none at the foot of the scene. */
export const SKY_TINT = 0.11;
/** The far hill: the air colour at this strength over the ground. */
export const HILL_TINT = 0.22;

export type Role = keyof typeof palette;

export function rgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
}

function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Colour a with share t of colour b laid over it, as a hex. */
export function mix(a: string, b: string, t: number): string {
  const [x, y] = [rgb(a), rgb(b)];
  return `#${x.map((c, i) => Math.round(c + (y[i]! - c) * t).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

/** WCAG contrast ratio, 1 to 21. Order does not matter. */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Every foreground/background pair the site may use for text. 3 means large text only. */
export const textPairs: { fg: Role; bg: Role; min: 4.5 | 3 }[] = [
  { fg: 'ink', bg: 'ground', min: 4.5 },
  { fg: 'ink', bg: 'surface', min: 4.5 },
  { fg: 'third', bg: 'ground', min: 4.5 },
  { fg: 'third', bg: 'surface', min: 4.5 },
  { fg: 'ink', bg: 'signal', min: 4.5 },
  { fg: 'ink', bg: 'air', min: 4.5 },
  { fg: 'airDeep', bg: 'ground', min: 4.5 },
  { fg: 'airDeep', bg: 'surface', min: 4.5 },
  { fg: 'signalDeep', bg: 'ground', min: 4.5 },
  { fg: 'signalDeep', bg: 'surface', min: 4.5 },
  // Text over the scene sits on the sky, which is never darker than its top.
  { fg: 'ink', bg: 'sky', min: 4.5 },
  { fg: 'third', bg: 'sky', min: 4.5 },
  { fg: 'airDeep', bg: 'sky', min: 4.5 },
  { fg: 'signalDeep', bg: 'sky', min: 4.5 },
  { fg: 'signal', bg: 'sky', min: 3 },
  { fg: 'signal', bg: 'ground', min: 3 },
  { fg: 'air', bg: 'ground', min: 3 },
];

/**
 * Never used for text or thin shapes. Orange and blue are almost the same brightness, so the air
 * may never touch an orange letter: the headline word keeps a sky-coloured margin around each
 * letter for that reason (Hero.astro).
 */
export const bannedPairs: [Role, Role][] = [
  ['signal', 'air'],
  ['air', 'signal'],
];
