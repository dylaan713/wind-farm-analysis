// All copy and every fact on the site lives here. Nothing is stated that the results
// files, the workbook or the two owners did not say.

export interface Credit {
  owner: 'dylan' | 'partner' | 'both';
  /** Written by the owner, never by an agent: it is a claim about what they did. */
  ai: string;
  checked: string;
}

export interface Chapter {
  id: string;
  number: string;
  title: string;
  status: 'live' | 'in-progress';
  summary: string;
  credit: Credit;
}

const TO_WRITE = 'To be written by its owner.';
const stub = (number: string, title: string, owner: Credit['owner']): Chapter => ({
  id: `ch-${number}`,
  number,
  title,
  status: 'in-progress',
  summary: 'In progress.',
  credit: { owner, ai: TO_WRITE, checked: TO_WRITE },
});

export const site = {
  name: 'wind-farm',
  headline: ['Made of', 'moving', 'air.'] as [string, string, string],
  /** The first screen's instruction, in three parts so the gesture can be emphasised. */
  hint: { lead: 'Sweep to push the wind.', emph: 'Press and hold, then let go,', tail: 'to send a gust.' },
  /** Shown in its place when the scene cannot respond (JavaScript off, or reduced motion). */
  still: 'A still view of the scene. With motion on, you can push the wind.',
  description: 'A wind farm, from the wind to the money: an energy model, a finance model, and the checks behind them.',
  people: {
    // Display names are entered by Dylan. An empty name shows the role alone.
    dylan: { name: '', role: 'Energy model and site' },
    partner: { name: '', role: 'Finance model' },
  },
  ownerLabel: { dylan: 'Energy model and site', partner: 'Finance model', both: 'Both of us' } as Record<Credit['owner'], string>,
  meter: { label: 'your wind has made', unit: 'kWh', note: 'demo turbine, not the real farm' },
  readouts: { wind: 'wind at hub', output: 'demo output' },
  creditLabels: { owner: 'Owned by', ai: 'How AI was used', checked: 'How it was checked' },
  /** The four chapters the first screen's chips link to. */
  heroChips: ['ch-01', 'ch-02', 'ch-03', 'ch-05'],
  chapters: [
    stub('01', 'The wind', 'dylan'),
    stub('02', 'One turbine', 'dylan'),
    stub('03', 'The farm', 'dylan'),
    stub('04', 'How sure are we', 'dylan'),
    stub('05', 'The money', 'partner'),
    stub('06', 'How we built it', 'both'),
  ] as Chapter[],
  disclaimer: 'Educational model. Not investment, tax or engineering advice.',
  sourcesNote: 'Sources and attributions will be listed here as each chapter goes live.',
  repoUrl: null as string | null,
};
