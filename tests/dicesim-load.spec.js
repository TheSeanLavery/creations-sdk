const { test, expect } = require('@playwright/test');

// Navigates via the host page to the DiceSim creation and asserts it loads
test.describe('DiceSim loads without console errors', () => {
  test('loads DiceSim via host and initializes WebGL', async ({ page, request }) => {
    // Go to host root
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    // Find the DiceSim entry from API and navigate the dropdown
    const api = await request.get('/api/creations', { headers: { 'cache-control': 'no-store' } });
    expect(api.ok()).toBeTruthy();
    const json = await api.json();
    const item = (json.items || []).find(x => /DiceSim/i.test(x.label || ''));
    expect(item, 'DiceSim should exist in creations list').toBeTruthy();

    const select = page.locator('#creation-select');
    await expect(select).toBeVisible();

    // Select the DiceSim option by label
    await select.selectOption({ label: item.label });

    // Wait for iframe to point to the creation
    const frameLoc = page.locator('.viewport iframe');
    await expect(frameLoc).toHaveAttribute('src', /\/creations\/DiceSim\/index\.html$/);

    const frame = await frameLoc.elementHandle();
    const app = await frame.contentFrame();

    const errors = [];
    page.on('pageerror', (err) => errors.push(`pageerror: ${err?.message || String(err)}`));
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`); });

    // Inside the app, wait for canvas and WebGL2
    await app.waitForSelector('canvas#glcanvas', { timeout: 15000 });
    const hadContext = await app.evaluate(() => {
      const c = document.getElementById('glcanvas');
      const gl = c && (c.getContext('webgl2') || c.getContext('experimental-webgl2'));
      return !!gl;
    });
    expect(hadContext).toBeTruthy();

    // Overlay should appear
    await expect.poll(async () => await app.evaluate(() => !!document.getElementById('tilt-source'))).toBeTruthy();

    // No errors captured
    expect(errors.join('\n')).toBe('');
  });
});


