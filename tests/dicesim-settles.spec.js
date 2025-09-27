const { test, expect } = require('@playwright/test');

test.describe('DiceSim settles', () => {
  test('die settles below speed threshold', async ({ page, request }) => {
    // Open host
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Select DiceSim from creations dropdown
    const api = await request.get('/api/creations', { headers: { 'cache-control': 'no-store' } });
    expect(api.ok()).toBeTruthy();
    const json = await api.json();
    const item = (json.items || []).find(x => /DiceSim/i.test(x.label || ''));
    expect(item).toBeTruthy();
    const select = page.locator('#creation-select');
    await select.selectOption({ label: item.label });

    // Wait for DiceSim iframe
    const frameLoc = page.locator('.viewport iframe');
    await expect(frameLoc).toHaveAttribute('src', /\/creations\/DiceSim\/index\.html$/);
    const frame = await frameLoc.elementHandle();
    const app = await frame.contentFrame();

    // Wait for canvas to ensure app started
    await app.waitForSelector('#glcanvas', { timeout: 15000 });

    // Wait for at least one die to exist (first die seeded on first frame)
    await expect.poll(async () => await app.evaluate(() => (window.__diceDebug && window.__diceDebug.getCount && window.__diceDebug.getCount()) || 0)).toBeGreaterThan(0);

    // Give physics a moment to settle with a static gravity
    const timeoutMs = 10000;
    const thresholdLin = 0.05; // m/s
    const thresholdAng = 0.2;  // rad/s (rough)
    const start = Date.now();
    let settled = false;
    while (Date.now() - start < timeoutMs && !settled) {
      const { speeds, angSpeeds, sleeping } = await app.evaluate(() => {
        const get = (fn) => (window.__diceDebug && fn) ? fn() : [];
        return { speeds: get(window.__diceDebug?.getSpeeds), angSpeeds: get(window.__diceDebug?.getAngularSpeeds), sleeping: get(window.__diceDebug?.getSleeping) };
      });
      if (speeds.length > 0 && (sleeping.every(Boolean) || (speeds.every(v => v <= thresholdLin) && angSpeeds.every(v => v <= thresholdAng)))) {
        settled = true;
        break;
      }
      await page.waitForTimeout(200);
    }

    expect(settled, 'dice should settle below thresholds').toBeTruthy();
  });
});


