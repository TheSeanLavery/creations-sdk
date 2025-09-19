import { test, expect } from '@playwright/test';

test.describe('Viewport, overlay, and input panel alignment', () => {
  test('overlay aligns to viewport and panel attaches to right edge without shifting layout', async ({ page }) => {
    await page.goto('/');

    // Use saved defaults
    const defX = -31;
    const defY = -91;
    const defS = 0.49;
    await page.fill('#ov-x-num', String(defX));
    await page.fill('#ov-y-num', String(defY));
    await page.fill('#ov-scale-num', String(defS));
    // trigger input to apply
    await page.locator('#ov-x-num').dispatchEvent('input');
    await page.locator('#ov-y-num').dispatchEvent('input');
    await page.locator('#ov-scale').dispatchEvent('input');

    const vp = page.locator('.viewport');
    const overlay = page.locator('#overlay');
    const panel = page.locator('#input-panel');
    const stage = page.locator('.stage');

    const vpBox = await vp.boundingBox();
    const ovBox = await overlay.boundingBox();
    const stBox = await stage.boundingBox();
    const pnBox = await panel.boundingBox();

    expect(vpBox).toBeTruthy();
    expect(ovBox).toBeTruthy();
    expect(pnBox).toBeTruthy();
    expect(stBox).toBeTruthy();

    // With saved defaults, overlay should be offset by defX/defY relative to viewport (account for status bar)
    const STATUSBAR_HEIGHT = 28;
    expect(Math.abs(ovBox.x - (vpBox.x + defX))).toBeLessThan(4);
    expect(Math.abs((ovBox.y + STATUSBAR_HEIGHT) - (vpBox.y + defY))).toBeLessThan(4);

    // Panel should be to the immediate right of viewport (with small gap >= 0)
    expect(pnBox.x).toBeGreaterThanOrEqual(vpBox.x + vpBox.width);
    // Panel height approximately equals content height (minus status bar), allow slack
    expect(pnBox.height).toBeGreaterThan(180);

    // Ensure stage top did not shift above header (layout stable)
    // Header height ~ 48px; stage y should be >= header bottom
    const header = page.locator('header');
    const hdBox = await header.boundingBox();
    expect(stBox.y).toBeGreaterThanOrEqual(hdBox.y + hdBox.height - 2);
  });
});


