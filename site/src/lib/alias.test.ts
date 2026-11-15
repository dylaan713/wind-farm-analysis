import type { FinanceInputs } from '@core/finance';

test('the core alias resolves', () => {
  const k: keyof FinanceInputs = 'capacity_mw';
  expect(k).toBe('capacity_mw');
});
