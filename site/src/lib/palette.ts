// The one source of truth for colour. tokens.css mirrors it and a test keeps them in step.
// Blue is air, orange is energy: a complementary pair, opposite each other on the colour wheel.
export const palette = {
  ground: '#FFFFFF',
  ink: '#0A1220',
  surface: '#E6F1FC',
  air: '#1890FF',
  signal: '#FF5B14',
  third: '#5C6B80',
  airDeep: '#0B62C4',
  signalDeep: '#C2410C',
  farTurbine: '#7FA6CC',
} as const;

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
  { fg: 'signal', bg: 'ground', min: 3 },
  { fg: 'air', bg: 'ground', min: 3 },
];

/** Never used for text or thin shapes. Orange and blue are almost the same brightness. */
export const bannedPairs: [Role, Role][] = [
  ['signal', 'surface'],
  ['signal', 'air'],
  ['air', 'signal'],
];
