import { expect, test } from '@playwright/test';

const CHAPTERS = ['The wind', 'One turbine', 'The farm', 'How sure are we', 'The money', 'How we built it'];
const DISCLAIMER = 'Educational model. Not investment, tax or engineering advice.';

test('every chapter and the disclaimer are on the page', async ({ page }) => {
  await page.goto('/');
  for (const title of CHAPTERS) await expect(page.getByRole('heading', { level: 2, name: title })).toBeVisible();
  await expect(page.getByText(DISCLAIMER)).toBeVisible();
});

test('one h1, headings in order', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toHaveCount(1);
  await expect(page.locator('h1')).toHaveAccessibleName('Made of moving air.');
  const levels = await page.locator('h1, h2, h3, h4').evaluateAll((els) => els.map((e) => Number(e.tagName[1])));
  expect(levels[0]).toBe(1);
  for (let i = 1; i < levels.length; i++) expect(levels[i]! - levels[i - 1]!).toBeLessThanOrEqual(1);
});

test('no horizontal scroll', async ({ page }) => {
  await page.goto('/');
  const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  expect(sw).toBeLessThanOrEqual(cw);
});

test('the top bar stays on one line on a phone', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'phone', 'phone layout only');
  await page.goto('/');
  const box = await page.locator('[data-topbar]').boundingBox();
  expect(box!.height).toBeLessThan(72);
});

test('in-progress chapters show no numbers', async ({ page }) => {
  await page.goto('/');
  const bodies = await page.locator('[data-chapter][data-status="in-progress"] [data-chapter-body]').allInnerTexts();
  expect(bodies).toHaveLength(6);
  for (const text of bodies) expect(text).not.toMatch(/\d/);
});

test.describe('with JavaScript off', () => {
  test.use({ javaScriptEnabled: false });
  test('everything is readable', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByText('Sweep to push the wind.')).toBeVisible();
    for (const title of CHAPTERS) await expect(page.getByRole('heading', { level: 2, name: title })).toBeVisible();
    await expect(page.getByText(DISCLAIMER)).toBeVisible();
    await expect(page.locator('[data-meter]')).toBeHidden();
  });
});

test.describe('the still drawing', () => {
  test.describe('with JavaScript off', () => {
    test.use({ javaScriptEnabled: false });
    test('fills the first screen', async ({ page }) => {
      await page.goto('/');
      const still = page.locator('[data-still]:visible');
      await expect(still).toHaveCount(1);
      const box = (await still.boundingBox())!, vp = page.viewportSize()!;
      expect(box.width).toBeGreaterThanOrEqual(vp.width - 1);
      expect(box.height).toBeGreaterThanOrEqual(Math.min(vp.height, 540) - 1);
      await expect(page.getByRole('img', { name: 'A sun low over two hills with three wind turbines' })).toBeVisible();
    });
  });

  test.describe('with reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });
    test('shows and nothing animates', async ({ page }) => {
      await page.goto('/');
      await page.waitForTimeout(2000);
      await expect(page.locator('[data-hero] canvas:visible')).toHaveCount(0);
      await expect(page.locator('[data-still]:visible')).toHaveCount(1);
      await expect(page.locator('[data-meter]')).toBeHidden();
    });
  });
});
