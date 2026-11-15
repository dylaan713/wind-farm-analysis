import { expect, test, type Page } from '@playwright/test';

type HeroState = { kwh: number; particles: number; speedMs: number; bursts: number; running: boolean; pointerX: number; charge: number };
const state = (page: Page) => page.evaluate(() => (window as unknown as { __hero: { state(): HeroState } }).__hero.state());
const open = async (page: Page) => {
  await page.goto('/?debug');
  await page.waitForFunction(() => document.documentElement.classList.contains('live'));
};
const nearHub = (page: Page) =>
  page.evaluate(() => (window as unknown as { __hero: { nearHub(): { x: number; y: number } } }).__hero.nearHub());
const fire = (page: Page, type: string, id: number, x: number, y: number) =>
  page.evaluate(([t, i, px, py]) => {
    const el = document.querySelector('[data-hero]')!, r = el.getBoundingClientRect();
    el.dispatchEvent(new PointerEvent(t as string, { pointerId: i as number, pointerType: 'touch', isPrimary: i === 1, clientX: r.left + (px as number), clientY: r.top + (py as number), bubbles: true, buttons: 1 }));
  }, [type, id, x, y] as const);

test('the air moves on its own', async ({ page }) => {
  await open(page);
  const air = page.locator('[data-hero] canvas[data-layer="air"]');
  const a = await air.screenshot();
  await page.waitForTimeout(500);
  expect(Buffer.compare(a, await air.screenshot())).not.toBe(0);
});

test('sweeping raises the wind speed', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'mouse sweep');
  await open(page);
  const hub = await nearHub(page);
  await page.mouse.move(hub.x - 320, hub.y);
  await page.waitForTimeout(400);
  expect((await state(page)).speedMs).toBeLessThan(9);
  await page.mouse.move(hub.x + 40, hub.y, { steps: 8 });
  await expect.poll(async () => (await state(page)).speedMs, { timeout: 600, intervals: [30] }).toBeGreaterThan(12);
});

test('hold and release sends one gust', async ({ page }) => {
  await open(page);
  await fire(page, 'pointerdown', 1, 200, 200);
  // Wait on the charge itself, not the clock: a slow runner charges more slowly.
  await expect.poll(async () => (await state(page)).charge, { timeout: 6000 }).toBeGreaterThan(0.9);
  const before = (await state(page)).bursts;
  await fire(page, 'pointerup', 1, 200, 200);
  expect((await state(page)).bursts).toBe(before + 1);
  await expect.poll(async () => (await state(page)).bursts, { timeout: 5000 }).toBe(0);
});

test('a short tap sends nothing', async ({ page }) => {
  await open(page);
  // Down and up inside one browser task, so the tap's length does not depend on how fast the test runner is.
  await page.evaluate(() => {
    const el = document.querySelector('[data-hero]')!, r = el.getBoundingClientRect();
    const ev = (type: string) => new PointerEvent(type, { pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: r.left + 200, clientY: r.top + 200, bubbles: true, buttons: 1 });
    el.dispatchEvent(ev('pointerdown'));
    el.dispatchEvent(ev('pointerup'));
  });
  expect((await state(page)).bursts).toBe(0);
});

test('a hold survives a small wobble but not a real move', async ({ page }) => {
  await open(page);
  await fire(page, 'pointerdown', 1, 200, 200);
  await fire(page, 'pointermove', 1, 208, 200); // 8 px: still a hold
  await expect.poll(async () => (await state(page)).charge, { timeout: 6000 }).toBeGreaterThan(0.2);
  await fire(page, 'pointermove', 1, 212, 200); // 12 px from where it started: now it is a drag
  expect((await state(page)).charge).toBe(0);
  await page.waitForTimeout(400);
  const before = (await state(page)).bursts;
  await fire(page, 'pointerup', 1, 212, 200);
  const after = await state(page);
  expect(after.charge).toBe(0);
  expect(after.bursts).toBe(before);
});

test('a scroll taking over the touch cancels a hold', async ({ page }) => {
  await open(page);
  await fire(page, 'pointerdown', 1, 200, 200);
  await expect.poll(async () => (await state(page)).charge, { timeout: 6000 }).toBeGreaterThan(0.5);
  const before = (await state(page)).bursts;
  await fire(page, 'pointercancel', 1, 200, 200);
  const s = await state(page);
  expect(s.bursts).toBe(before);
  expect(s.charge).toBe(0);
});

test('leaving the window cancels a hold', async ({ page }) => {
  await open(page);
  await fire(page, 'pointerdown', 1, 200, 200);
  await expect.poll(async () => (await state(page)).charge, { timeout: 6000 }).toBeGreaterThan(0.5);
  const before = (await state(page)).bursts;
  await fire(page, 'pointerleave', 1, 200, 200);
  expect((await state(page)).charge).toBe(0);
  // A release that arrives afterwards must not fire the gust that was being charged.
  await fire(page, 'pointerup', 1, 200, 200);
  expect((await state(page)).bursts).toBe(before);
});

test('a second finger is ignored', async ({ page }) => {
  await open(page);
  await fire(page, 'pointerdown', 1, 100, 200);
  await fire(page, 'pointerdown', 2, 300, 300);
  await fire(page, 'pointermove', 2, 330, 300);
  expect((await state(page)).pointerX).toBe(100);
  await fire(page, 'pointerup', 2, 330, 300);
  expect((await state(page)).pointerX).toBe(100);
});

test('hidden tabs do not run', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const before = await state(page);
  expect(before.running).toBe(false);
  await page.waitForTimeout(1500);
  expect((await state(page)).kwh).toBe(before.kwh);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(300);
  const after = await state(page);
  expect(after.running).toBe(true);
  // Coming back adds at most a few capped frames, never the time spent away.
  expect(after.kwh - before.kwh).toBeLessThan(1.2);
});

test('resizing keeps it sharp', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'viewport resize');
  await open(page);
  await page.setViewportSize({ width: 900, height: 700 });
  await expect
    .poll(() => page.evaluate(() => {
      const c = document.querySelector<HTMLCanvasElement>('[data-hero] canvas[data-layer="top"]')!;
      return c.width === Math.round(c.getBoundingClientRect().width * Math.min(devicePixelRatio, 2));
    }))
    .toBe(true);
  const hub = await nearHub(page);
  expect(hub.x).toBeCloseTo(0.8 * 900, 0);
});

test('it pauses offscreen', async ({ page }) => {
  await open(page);
  await page.locator('footer').scrollIntoViewIfNeeded();
  await expect.poll(async () => (await state(page)).running).toBe(false);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(async () => (await state(page)).running).toBe(true);
});

test('device pixel ratio is capped at 2', async ({ page }) => {
  await open(page);
  const ratio = await page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>('[data-hero] canvas[data-layer="top"]')!;
    return c.width / c.getBoundingClientRect().width;
  });
  expect(ratio).toBeLessThanOrEqual(2.01);
});

test('long press shows no selection or menu', async ({ page }) => {
  await open(page);
  const css = await page.locator('[data-hero]').evaluate((el) => {
    const s = getComputedStyle(el);
    return [s.userSelect, s.touchAction];
  });
  expect(css).toEqual(['none', 'pan-y']);
  const prevented = await page.locator('[data-hero]').evaluate((el) => !el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })));
  expect(prevented).toBe(true);
  await fire(page, 'pointerdown', 1, 200, 200);
  await page.waitForTimeout(950);
  await fire(page, 'pointerup', 1, 200, 200);
  expect(await page.evaluate(() => window.getSelection()!.toString())).toBe('');
});

test('it drops particles on a slow device', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'CPU throttling through CDP');
  const cdp = await page.context().newCDPSession(page);
  await open(page);
  const start = (await state(page)).particles;
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 20 });
  await expect.poll(async () => (await state(page)).particles, { timeout: 15_000 }).toBe(start / 2);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
});

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('the controller never starts', async ({ page }) => {
    await page.goto('/?debug');
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => 'state' in ((window as unknown as { __hero?: object }).__hero ?? {}))).toBe(false);
    await expect(page.locator('[data-hero] canvas')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.classList.contains('live'))).toBe(false);
  });
});
