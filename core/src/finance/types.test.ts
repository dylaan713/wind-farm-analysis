import flat from '../../../data/fixtures/finance-flat.json';
import type { FixtureFile } from './types';

test('flat fixture has the contract shape', () => {
  const f = flat as FixtureFile;
  expect(f.scenarios).toHaveLength(1);
  const s = f.scenarios[0]!;
  expect(s.name).toBe('flat');
  expect(Object.keys(s.inputs)).toHaveLength(23);
  expect(s.inputs.macrs_schedule).toHaveLength(6);
  expect(s.outputs.debt_amount).toBeCloseTo(80204470.23, 2);
  expect(s.outputs.binding_case).toBe('P50');
});
