import { expect, test, type Page } from '@playwright/test';

const open = async (page: Page) => {
  await page.goto('/?debug');
  await page.waitForFunction(() => document.documentElement.classList.contains('live'));
};
const kwh = async (page: Page) => Number(await page.locator('[data-meter-value]').innerText());
const nearHub = (page: Page) =>
  page.evaluate(() => (window as unknown as { __hero: { nearHub(): { x: number; y: number } } }).__hero.nearHub());

test('the meter starts near zero and climbs', async ({ page }) => {
  await open(page);
  await expect(page.locator('[data-meter-value]')).toHaveText(/^\d+\.\d\d$/);
  const a = await kwh(page);
  expect(a).toBeLessThan(1);
  await page.waitForTimeout(2000);
  expect(await kwh(page)).toBeGreaterThan(a);
});

test('the meter is labeled a demo, on every screen size', async ({ page }) => {
  await open(page);
  await expect(page.locator('[data-meter]').getByText('your wind has made')).toBeVisible();
  await expect(page.locator('[data-meter]').getByText('demo turbine, not the real farm')).toBeVisible();
});

test('the top bar still fits on a phone with the meter showing', async ({ page }, info) => {
  test.skip(info.project.name !== 'phone', 'phone layout only');
  await open(page);
  expect((await page.locator('[data-topbar]').boundingBox())!.height).toBeLessThan(72);
  const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  expect(sw).toBeLessThanOrEqual(cw);
});

test('readouts are zero-padded with units', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'readouts are hidden on phones');
  await open(page);
  await expect(page.locator('[data-read-wind]')).toHaveText(/^\d\d\.\d m\/s$/);
  await expect(page.locator('[data-read-output]')).toHaveText(/^[\d,]+ kW$/);
});

test('pushing the wind makes the meter climb faster', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'mouse sweep');
  await open(page);
  const hub = await nearHub(page);
  await page.mouse.move(5, 5);
  const a = await kwh(page);
  await page.waitForTimeout(2000);
  const idle = (await kwh(page)) - a;
  const b = await kwh(page), end = Date.now() + 2000;
  while (Date.now() < end) {
    await page.mouse.move(hub.x - 420, hub.y);
    await page.mouse.move(hub.x + 80, hub.y, { steps: 10 });
  }
  expect((await kwh(page)) - b).toBeGreaterThan(idle * 1.5);
});

test('chapter chips fill in order', async ({ page }) => {
  await open(page);
  await expect
    .poll(() => page.locator('[data-chip-fill]').first().evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a), { timeout: 8000 })
    .toBeGreaterThan(0.05);
  const scales = await page.locator('[data-chip-fill]').evaluateAll((els) => els.map((el) => new DOMMatrix(getComputedStyle(el).transform).a));
  expect(scales).toHaveLength(4);
  for (let i = 1; i < 4; i++) if (scales[i]! > 0) expect(scales[i - 1]).toBe(1);
  const total = await kwh(page);
  expect(scales[0]!).toBeCloseTo(Math.min(1, total / 3), 1);
});

test('chips are links that work without the animation', async ({ page }) => {
  await open(page);
  const hrefs = await page.locator('[data-chip]').evaluateAll((els) => els.map((el) => el.getAttribute('href')));
  expect(hrefs).toEqual(['#ch-01', '#ch-02', '#ch-03', '#ch-05']);
  await page.locator('[data-chip]').nth(3).click();
  await expect(page.locator('#ch-05')).toBeInViewport();
});

test('screen readers are not flooded', async ({ page }) => {
  await open(page);
  await expect(page.locator('[data-meter]')).toHaveAttribute('aria-live', 'off');
  const summary = page.locator('[data-meter-summary]');
  await expect(summary).toHaveAttribute('aria-live', 'polite');
  const first = await summary.innerText();
  expect(first).toMatch(/demo turbine/);
  await page.waitForTimeout(3000);
  expect(await summary.innerText()).toBe(first);
});
