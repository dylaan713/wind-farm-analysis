import { expect, test, type Page } from '@playwright/test';

const open = async (page: Page, path = '/?debug') => {
  await page.goto(path);
  await page.waitForFunction(() => document.documentElement.classList.contains('live'));
};
const leaning = (page: Page) => page.locator('[data-lean]').evaluateAll((els) => els.filter((el) => (el as HTMLElement).style.transform !== '').length);

test('letters lean when the wind passes and return upright', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'mouse sweep');
  await open(page);
  await page.waitForTimeout(1500);
  const box = (await page.locator('h1').boundingBox())!;
  await page.mouse.move(box.x, box.y + box.height / 2);
  await page.mouse.move(box.x + box.width, box.y + box.height / 2, { steps: 10 });
  await expect.poll(() => leaning(page), { timeout: 500, intervals: [20] }).toBeGreaterThan(0);
  await page.mouse.move(5, 700);
  await expect.poll(() => leaning(page), { timeout: 3000 }).toBe(0);
});

test('letters do not move in the base wind', async ({ page }) => {
  await open(page);
  // A tap marks the visitor as present, so the page does not send its own demonstration gust.
  await page.evaluate(() => {
    const el = document.querySelector('[data-hero]')!, r = el.getBoundingClientRect();
    const ev = (type: string) => new PointerEvent(type, { pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: r.right - 20, clientY: r.bottom - 150, bubbles: true, buttons: 1 });
    el.dispatchEvent(ev('pointerdown')); el.dispatchEvent(ev('pointerup'));
  });
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(500);
    expect(await leaning(page)).toBe(0);
  }
});

test('pressing a chip scales it', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'mouse press');
  await open(page);
  await page.waitForTimeout(1500);
  const chip = page.locator('[data-chip]').first(), box = (await chip.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect.poll(() => chip.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a)).toBeLessThan(0.98);
  await page.mouse.move(5, 5);
  await page.mouse.up();
  await expect.poll(() => chip.evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a)).toBeCloseTo(1, 2);
});

test('magnetic pull follows a mouse and is off on touch', async ({ page }, info) => {
  await open(page);
  await page.waitForTimeout(1500);
  const name = page.locator('[data-magnetic]').first(), box = (await name.boundingBox())!;
  await page.mouse.move(box.x + box.width + 20, box.y + box.height / 2 + 14);
  await page.waitForTimeout(250);
  const moved = await name.evaluate((el) => (el as HTMLElement).style.transform !== '');
  expect(moved).toBe(info.project.name === 'desktop');
});

test('the arrival runs once per visit', async ({ page }) => {
  // Do not wait for the whole page to load: on a slow runner the arrival could already be over.
  await page.goto('/?debug', { waitUntil: 'commit' });
  await page.waitForFunction(() => document.documentElement.classList.contains('arriving') || document.documentElement.classList.contains('arrived'));
  expect(await page.evaluate(() => document.documentElement.className)).toMatch(/arriv/);
  await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('arrived')), { timeout: 2500 }).toBe(true);
  expect(await page.evaluate(() => document.documentElement.classList.contains('arriving'))).toBe(false);
  await page.reload();
  expect(await page.evaluate(() => document.documentElement.className)).toContain('arrived');
  expect(await page.evaluate(() => document.documentElement.classList.contains('arriving'))).toBe(false);
});

test('chapters reveal as they come into view', async ({ page }) => {
  await open(page);
  const body = page.locator('#ch-03 [data-reveal]').first();
  await expect(body).toHaveCSS('opacity', '0');
  await page.locator('#ch-03').scrollIntoViewIfNeeded();
  await expect(body).toHaveCSS('opacity', '1');
});

test.describe('with JavaScript off', () => {
  test.use({ javaScriptEnabled: false });
  test('nothing is hidden waiting for a script', async ({ page }) => {
    await page.goto('/');
    for (const el of await page.locator('[data-reveal]').all()) await expect(el).toHaveCSS('opacity', '1');
    await expect(page.locator('h1 .line').first()).toHaveCSS('opacity', '1');
  });
});

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('no lean, no arrival, no magnetic, nothing hidden', async ({ page }) => {
    await page.goto('/?debug');
    await page.waitForTimeout(800);
    expect(await page.evaluate(() => document.documentElement.classList.contains('arriving'))).toBe(false);
    expect(await leaning(page)).toBe(0);
    const name = page.locator('[data-magnetic]').first(), box = (await name.boundingBox())!;
    await page.mouse.move(box.x + box.width + 20, box.y + box.height / 2 + 14);
    await page.waitForTimeout(200);
    expect(await name.evaluate((el) => (el as HTMLElement).style.transform)).toBe('');
    for (const el of await page.locator('[data-reveal]').all()) await expect(el).toHaveCSS('opacity', '1');
  });
});
