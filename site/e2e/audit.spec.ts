// Tests for defects found by the 2026-11-14 audits. Each one failed, or would have, before its fix.
import { expect, test, type Page } from '@playwright/test';

type Hero = {
  state(): { bursts: number; charge: number; demoGustDone: boolean; running: boolean };
  nearHub(): { x: number; y: number; r: number };
  streaks(on: boolean): void;
};
const open = async (page: Page) => {
  await page.goto('/?debug');
  await page.waitForFunction(() => document.documentElement.classList.contains('live') && document.documentElement.classList.contains('arrived'));
};
const tap = (page: Page) =>
  page.evaluate(() => {
    const el = document.querySelector('[data-hero]')!, r = el.getBoundingClientRect();
    const ev = (type: string) => new PointerEvent(type, { pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: r.right - 20, clientY: r.bottom - 150, bubbles: true, buttons: 1 });
    el.dispatchEvent(ev('pointerdown')); el.dispatchEvent(ev('pointerup'));
  });

/** Lowest WCAG contrast between a text colour and every canvas pixel behind an element (air and sky layers together). */
const lowestContrast = (page: Page, selector: string, token: string) =>
  page.evaluate(([sel, tok]) => {
    const lum = (r: number, g: number, b: number) => {
      const f = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    };
    const hex = getComputedStyle(document.documentElement).getPropertyValue(tok!).trim().replace('#', '');
    const fg = lum(parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16));
    const root = document.querySelector('[data-hero]')!.getBoundingClientRect();
    const el = document.querySelector(sel!)!.getBoundingClientRect();
    const air = document.querySelector<HTMLCanvasElement>('canvas[data-layer="air"]')!, sky = document.querySelector<HTMLCanvasElement>('canvas[data-layer="sky"]')!;
    const c = document.createElement('canvas'); c.width = air.width; c.height = air.height;
    const x = c.getContext('2d')!; x.drawImage(air, 0, 0); x.drawImage(sky, 0, 0);
    const k = air.width / root.width;
    const d = x.getImageData(Math.floor((el.left - root.left) * k), Math.floor((el.top - root.top) * k), Math.max(1, Math.ceil(el.width * k)), Math.max(1, Math.ceil(el.height * k))).data;
    let min = 21;
    for (let i = 0; i < d.length; i += 4) {
      const bg = lum(d[i]!, d[i + 1]!, d[i + 2]!), ratio = (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05);
      if (ratio < min) min = ratio;
    }
    return min;
  }, [selector, token] as const);

const sweepAcross = async (page: Page, selector: string) => {
  const b = (await page.locator(selector).boundingBox())!;
  for (let i = 0; i < 3; i++) {
    await page.mouse.move(b.x - 60, b.y + b.height / 2);
    await page.mouse.move(b.x + b.width + 60, b.y + b.height / 2, { steps: 8 });
  }
};

test('the orange word keeps its contrast, still and while the wind is pushed across it', async ({ page }) => {
  await open(page);
  await page.waitForTimeout(1200);
  expect(await lowestContrast(page, 'h1 .energy', '--signal')).toBeGreaterThanOrEqual(3);
  await sweepAcross(page, 'h1 .energy');
  expect(await lowestContrast(page, 'h1 .energy', '--signal')).toBeGreaterThanOrEqual(3);
});

test('the instruction and the readouts keep their contrast while the wind is pushed across them', async ({ page }) => {
  await open(page);
  await page.waitForTimeout(1200);
  for (const sel of ['.sub-live', '[data-readouts]']) {
    await sweepAcross(page, sel);
    expect(await lowestContrast(page, sel, '--third'), sel).toBeGreaterThanOrEqual(4.5);
  }
});

test('old streaks fade away completely', async ({ page }) => {
  await open(page);
  await tap(page);
  await page.waitForTimeout(800);
  await page.evaluate(() => (window as unknown as { __hero: Hero }).__hero.streaks(false));
  await page.waitForTimeout(2500);
  const dirty = await page.evaluate(() => {
    const c = document.querySelector<HTMLCanvasElement>('canvas[data-layer="air"]')!;
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] !== 255 || d[i + 1] !== 255 || d[i + 2] !== 255) n++;
    return n;
  });
  expect(dirty).toBe(0);
});

test('a scroll followed by a mouse move does not fake a sweep', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'mouse');
  await open(page);
  await page.mouse.move(100, 300);
  await page.waitForTimeout(1500); // let that first move die away
  await page.evaluate(() => window.scrollBy(0, 20));
  await page.waitForTimeout(100);
  await page.mouse.move(101, 300);
  let worst = 0;
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(40);
    const skews = await page.locator('[data-lean]').evaluateAll((els) => els.map((el) => Math.abs(parseFloat((el as HTMLElement).style.transform.match(/skewX\(([-\d.]+)deg\)/)?.[1] ?? '0'))));
    worst = Math.max(worst, ...skews);
  }
  expect(worst).toBeLessThan(2);
});

test('left alone, the page sends one gust and points at the words that explain it', async ({ page }) => {
  await page.goto('/?debug');
  await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('hinting')), { timeout: 9000, intervals: [50] }).toBe(true);
  expect(await page.evaluate(() => (window as unknown as { __hero: Hero }).__hero.state().demoGustDone)).toBe(true);
  await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('hinting')), { timeout: 4000 }).toBe(false);
});

test('a visitor who has already touched the screen is not shown the demonstration', async ({ page }) => {
  await open(page);
  await tap(page);
  await page.waitForTimeout(4500);
  expect(await page.evaluate(() => (window as unknown as { __hero: Hero }).__hero.state().demoGustDone)).toBe(false);
});

test('switching reduced motion on and off while the page is open', async ({ page }) => {
  await open(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('[data-hero] canvas')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.classList.contains('live'))).toBe(false);
  await expect(page.locator('[data-still]:visible')).toHaveCount(1);
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.waitForFunction(() => document.documentElement.classList.contains('live'));
  await expect(page.locator('[data-hero] canvas')).toHaveCount(4);
});

test('letters are measured again after a resize', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'viewport resize and mouse');
  await open(page);
  await tap(page);
  await page.setViewportSize({ width: 1000, height: 760 });
  await page.waitForTimeout(600);
  const b = (await page.locator('h1').boundingBox())!;
  await page.mouse.move(b.x, b.y + b.height * 0.3);
  await page.mouse.move(b.x + b.width, b.y + b.height * 0.3, { steps: 10 });
  await expect
    .poll(() => page.locator('h1 .line').first().locator('[data-lean]').evaluateAll((els) => els.filter((el) => (el as HTMLElement).style.transform !== '').length), { timeout: 600, intervals: [20] })
    .toBeGreaterThan(0);
});

test.describe('layouts the audit found broken', () => {
  test.beforeEach(({}, info) => test.skip(info.project.name !== 'desktop', 'sets its own viewport'));

  test('a phone on its side keeps the chapter links and the headline on screen', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await open(page);
    const chips = (await page.locator('[data-chips]').boundingBox())!, bar = (await page.locator('[data-topbar]').boundingBox())!, h1 = (await page.locator('h1').boundingBox())!;
    expect(chips.y + chips.height).toBeLessThanOrEqual(390);
    expect(h1.y).toBeGreaterThanOrEqual(bar.y + bar.height - 1);
    expect(h1.y + h1.height).toBeLessThan(chips.y);
  });

  test('zoomed to 200% the chapter links are still on the first screen', async ({ page }) => {
    await page.setViewportSize({ width: 720, height: 450 });
    await open(page);
    const chips = (await page.locator('[data-chips]').boundingBox())!;
    expect(chips.y + chips.height).toBeLessThanOrEqual(450);
  });

  test('the narrowest phone: the bar stays compact and the ridge clears the links', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await open(page);
    expect((await page.locator('[data-topbar]').boundingBox())!.height).toBeLessThan(76);
    const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
    expect(sw).toBeLessThanOrEqual(cw);
    const chips = (await page.locator('[data-chips]').boundingBox())!, hub = await page.evaluate(() => (window as unknown as { __hero: Hero }).__hero.nearHub());
    // The near turbine stands on the ridge: its base must be above the links.
    const base = await page.evaluate(() => {
      const c = document.querySelector<HTMLCanvasElement>('canvas[data-layer="hills"]')!, k = c.width / c.getBoundingClientRect().width;
      const x = Math.round(c.width * 0.8), col = c.getContext('2d')!.getImageData(x, 0, 1, c.height).data;
      let y = c.height - 1;
      // Walk up from the bottom while the pixel is the white of the front hill.
      while (y > 0 && col[y * 4] === 255 && col[y * 4 + 1] === 255 && col[y * 4 + 2] === 255 && col[y * 4 + 3] === 255) y--;
      return y / k;
    });
    expect(base).toBeLessThan(chips.y - 6);
    expect(hub.y).toBeLessThan(chips.y);
  });

  test('the readouts are clear of the near turbine', async ({ page }) => {
    for (const vp of [{ width: 1440, height: 900 }, { width: 1440, height: 820 }, { width: 1024, height: 768 }]) {
      await page.setViewportSize(vp);
      await open(page);
      const box = (await page.locator('[data-readouts]').boundingBox())!, hub = await page.evaluate(() => (window as unknown as { __hero: Hero }).__hero.nearHub());
      const nx = Math.max(box.x, Math.min(hub.x, box.x + box.width)), ny = Math.max(box.y, Math.min(hub.y, box.y + box.height));
      expect(Math.hypot(nx - hub.x, ny - hub.y), JSON.stringify(vp)).toBeGreaterThan(hub.r + 8);
    }
  });
});

test('jumping to a chapter does not hide its start under the top bar', async ({ page }) => {
  await open(page);
  await page.locator('[data-chip]').first().click();
  await page.waitForTimeout(900);
  const bar = (await page.locator('[data-topbar]').boundingBox())!, num = (await page.locator('#ch-01 .number').boundingBox())!;
  expect(num.y).toBeGreaterThanOrEqual(bar.y + bar.height - 20);
});
