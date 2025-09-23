import { test, expect } from '@playwright/test';

test.describe('Viewport faux-fullscreen behavior', () => {
  test('viewport stays fixed; iframe fills viewport; statusbar hides', async ({ page }) => {
    await page.goto('/');

    const viewport = page.locator('.viewport');
    const iframe = page.locator('.viewport iframe');
    const status = page.locator('.viewport .statusbar');
    const fsToggle = page.locator('#emu-fullscreen-toggle');

    await expect(viewport).toBeVisible();
    await expect(iframe).toBeVisible();
    await expect(status).toBeVisible();

    // Record initial viewport box and iframe box
    const vpBefore = await viewport.boundingBox();
    const iframeBefore = await iframe.boundingBox();
    expect(vpBefore).not.toBeNull();
    expect(iframeBefore).not.toBeNull();

    // Toggle fullscreen on
    await fsToggle.check();

    // Wait for class application
    await expect(viewport).toHaveClass(/vp-full/);

    // Viewport should NOT move or resize
    const vpAfter = await viewport.boundingBox();
    expect(Math.abs(vpAfter.x - vpBefore.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(vpAfter.y - vpBefore.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(vpAfter.width - vpBefore.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(vpAfter.height - vpBefore.height)).toBeLessThanOrEqual(1);

    // Status bar should hide
    await expect(status).toBeHidden();

    // Iframe should fill the viewport's inner content box (account for 1px border)
    const borders = await viewport.evaluate((el) => {
      const cs = getComputedStyle(el);
      const toNum = (v) => parseFloat(v || '0') || 0;
      return {
        left: toNum(cs.borderLeftWidth),
        right: toNum(cs.borderRightWidth),
        top: toNum(cs.borderTopWidth),
        bottom: toNum(cs.borderBottomWidth),
      };
    });
    const iframeAfter = await iframe.boundingBox();
    // Position: iframe's top-left should align to viewport's content box (x + borderLeft, y + borderTop)
    expect(Math.abs(iframeAfter.x - (vpAfter.x + borders.left))).toBeLessThanOrEqual(1);
    expect(Math.abs(iframeAfter.y - (vpAfter.y + borders.top))).toBeLessThanOrEqual(1);
    // Size: iframe should match viewport content box (width - borders, height - borders)
    expect(Math.abs(iframeAfter.width - (vpAfter.width - borders.left - borders.right))).toBeLessThanOrEqual(1);
    expect(Math.abs(iframeAfter.height - (vpAfter.height - borders.top - borders.bottom))).toBeLessThanOrEqual(1);

    // Toggle fullscreen off
    await fsToggle.uncheck();
    await expect(viewport).not.toHaveClass(/vp-full/);

    // Status bar should show again
    await expect(status).toBeVisible();

    // Iframe should return to native size (240x254) and be offset by 28px from the viewport content box
    const iframeBack = await iframe.boundingBox();
    expect(Math.round(iframeBack.width)).toBe(240);
    expect(Math.round(iframeBack.height)).toBe(254);
    expect(Math.round(iframeBack.y)).toBe(Math.round(vpBefore.y + borders.top + 28));
  });
});


