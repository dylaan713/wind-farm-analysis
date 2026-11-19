import { expect, test, type Page } from '@playwright/test';

/** Temporary diagnostic (2026-11-14): these tests failed on CI's runner without a known cause. Records every pointer and scroll event the page receives, and prints it with the scene's state if the test fails. */
const recordInput = (page: Page) =>
  page.addInitScript(() => {
    const log: unknown[] = ((window as unknown as { __ev: unknown[] }).__ev = []);
    for (const t of ['pointerdown', 'pointermove', 'pointerup', 'pointerleave', 'pointercancel', 'scroll'])
      window.addEventListener(t, (e) => { const p = e as PointerEvent; log.push([t, p.pointerType, Math.round(p.clientX), Math.round(p.clientY), e.isTrusted, Math.round(performance.now())]); }, true);
  });
const diagnose = async (page: Page, label: string) => {
  const d = await page.evaluate(() => ({ ev: (window as unknown as { __ev: unknown[] }).__ev, state: (window as unknown as { __hero?: { state(): unknown } }).__hero?.state(), classes: document.documentElement.className, now: Math.round(performance.now()) })).catch((e) => ({ error: String(e) }));
  console.log(`DIAG ${label}: ${JSON.stringify(d)}`);
};

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

test('readouts are zero-padded with units', async ({ page }) => {
  await open(page);
  await expect(page.locator('[data-read-wind]')).toHaveText(/^\d\d\.\d m\/s$/);
  await expect(page.locator('[data-read-output]')).toHaveText(/^[\d,]+ kW$/);
});

test('the two readings describe the same turbine and agree with each other', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'mouse sweep');
  await open(page);
  const hub = await nearHub(page);
  const read = async () => {
    const [w, o] = await Promise.all([page.locator('[data-read-wind]').innerText(), page.locator('[data-read-output]').innerText()]);
    return { ms: parseFloat(w), kw: Number(o.replace(/[^\d]/g, '')) };
  };
  // One turbine can never show more than its rating, however hard the wind is pushed.
  for (let i = 0; i < 4; i++) {
    await page.mouse.move(hub.x - 420, hub.y);
    await page.mouse.move(hub.x + 80, hub.y, { steps: 10 });
    expect((await read()).kw).toBeLessThanOrEqual(3400);
  }
  // Left to settle, the output shown is what the demo power curve gives for the wind shown.
  await page.mouse.move(5, 5);
  await page.waitForTimeout(2500);
  const { ms, kw } = await read();
  const curve = (v: number) => (v <= 3 || v >= 25 ? 0 : 3400 * Math.min(1, ((v - 3) / 9) ** 3));
  expect(kw).toBeGreaterThanOrEqual(curve(ms - 0.2) - 20);
  expect(kw).toBeLessThanOrEqual(curve(ms + 0.2) + 20);
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
  expect(scales[0]!).toBeCloseTo(Math.min(1, total / 1), 1);
});

test('chips are links that work without the animation', async ({ page }) => {
  await open(page);
  const hrefs = await page.locator('[data-chip]').evaluateAll((els) => els.map((el) => el.getAttribute('href')));
  expect(hrefs).toEqual(['#ch-01', '#ch-02', '#ch-03', '#ch-05']);
  await page.locator('[data-chip]').nth(3).click();
  await expect(page.locator('#ch-05')).toBeInViewport();
});

test('the spoken summary waits for the visitor and is never on a timer', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'mouse sweep');
  await recordInput(page);
  await open(page);
  // The visual meter is hidden from screen readers; the summary carries the figure instead.
  await expect(page.locator('[data-meter]')).toHaveAttribute('aria-hidden', 'true');
  const summary = page.locator('[data-meter-summary]');
  await expect(summary).toHaveAttribute('aria-live', 'polite');
  // Left alone, it says nothing, however long the page is open.
  // A pointer that merely arrives and rests over the scene is not a push either.
  await page.mouse.move(300, 300);
  await page.waitForTimeout(6000);
  const quiet = await summary.innerText();
  if (quiet !== '') await diagnose(page, 'summary spoke unprompted');
  expect(quiet).toBe('');
  // After a sweep, and a pause, it speaks once.
  const hub = await nearHub(page);
  await page.mouse.move(hub.x - 420, hub.y);
  await page.mouse.move(hub.x + 80, hub.y, { steps: 10 });
  await expect.poll(() => summary.innerText(), { timeout: 6000 }).toMatch(/demo turbine, not the real farm/);
  const spoken = await summary.innerText();
  expect(spoken).not.toBe(quiet);
  await page.waitForTimeout(4000);
  expect(await summary.innerText()).toBe(spoken);
});
