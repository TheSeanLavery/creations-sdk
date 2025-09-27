const { test, expect } = require('@playwright/test');

test.describe('DiceSim responds to emulator tilt', () => {
  test('tilting changes gravity and moves the die', async ({ page, request }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Select DiceSim from creations dropdown
    const api = await request.get('/api/creations', { headers: { 'cache-control': 'no-store' } });
    expect(api.ok()).toBeTruthy();
    const json = await api.json();
    const item = (json.items || []).find(x => /DiceSim/i.test(x.label || ''));
    expect(item).toBeTruthy();
    const select = page.locator('#creation-select');
    await select.selectOption({ label: item.label });

    const frameLoc = page.locator('.viewport iframe');
    await expect(frameLoc).toHaveAttribute('src', /\/creations\/DiceSim\/index\.html$/);
    const frame = await frameLoc.elementHandle();
    const app = await frame.contentFrame();

    // Wait for canvas and first die
    await app.waitForSelector('#glcanvas', { timeout: 15000 });
    await expect.poll(async () => await app.evaluate(() => (window.__diceDebug?.getCount?.() || 0))).toBeGreaterThan(0);

    // Give a moment to settle
    await page.waitForTimeout(500);

    // Tilt emulator: add strong X component and reduce Z so vector isn't mostly downward
    await page.fill('#emu-tilt-x-num', '0.8');
    await page.dispatchEvent('#emu-tilt-x-num', 'input');
    await page.fill('#emu-tilt-z-num', '0.2');
    await page.dispatchEvent('#emu-tilt-z-num', 'input');

    // Wait for motion: poll speeds to exceed small threshold
    await expect.poll(async () => {
      const d = await app.evaluate(() => {
        const dd = window.__diceDebug;
        if (!dd) return { speeds: [], ang: [] };
        return { speeds: dd.getSpeeds(), ang: dd.getAngularSpeeds() };
      });
      const moving = d.speeds.some(v => v > 0.05);
      return moving ? 'yes' : 'no';
    }, { timeout: 10000 }).toEqual('yes');
  });
});
