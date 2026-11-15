import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('no axe violations', async ({ page }) => {
  await page.goto('/');
  const { violations } = await new AxeBuilder({ page }).analyze();
  expect(violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
});

test.describe('with JavaScript off', () => {
  test.use({ javaScriptEnabled: false });
  test('the page has a main landmark, a language and a title', async ({ page }) => {
    // axe needs scripts to run, so the no-JS state is checked structurally.
    await page.goto('/');
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page).toHaveTitle(/.+/);
  });
});
