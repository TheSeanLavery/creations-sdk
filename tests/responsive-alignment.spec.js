import { test, expect } from '@playwright/test';

test.describe('Responsive alignment under resize', () => {
  test('overlay and input panel stay visually aligned to the iframe on page resize', async ({ page }) => {
    await page.goto('/');

    // Read current slider offsets to use as ground truth
    const getNum = async (selector) => parseFloat(await page.locator(selector).inputValue());
    const defX = await getNum('#ov-x-num');
    const defY = await getNum('#ov-y-num');
    const defS = await getNum('#ov-scale-num');
    const px = await getNum('#panel-x-num');
    const py = await getNum('#panel-y-num');

    const STATUSBAR_HEIGHT = 28;

    // Helper to assert alignment relations
    const assertAlignment = async () => {
      const vpBox = await page.locator('.viewport').boundingBox();
      const ovBox = await page.locator('#overlay').boundingBox();
      const pnBox = await page.locator('#input-panel').boundingBox();
      expect(vpBox && ovBox && pnBox).toBeTruthy();

      // Overlay: top-left equals viewport + (defX, defY - STATUSBAR_HEIGHT), accounting for scale (no offset change at origin)
      // Since we translate+scale from top-left, positions should match within tolerance
      expect(Math.abs(ovBox.x - (vpBox.x + defX))).toBeLessThan(3);
      expect(Math.abs(ovBox.y - (vpBox.y + defY - STATUSBAR_HEIGHT))).toBeLessThan(3);

      // Panel: attached to right edge of viewport with offsets px, py
      expect(Math.abs(pnBox.x - (vpBox.x + vpBox.width + px))).toBeLessThan(3);
      expect(Math.abs(pnBox.y - (vpBox.y + STATUSBAR_HEIGHT + py))).toBeLessThan(3);

      // Sanity: scale value did not change unexpectedly
      const curS = await getNum('#ov-scale-num');
      expect(curS).toBeCloseTo(defS, 2);

      // Ensure overlay and panel are NOT children of the iframe container (avoid clipping)
      const { overlayInsideV, panelInsideV } = await page.evaluate(() => {
        const vp = document.getElementById('viewport');
        const overlay = document.getElementById('overlay');
        const panel = document.getElementById('input-panel');
        return { overlayInsideV: !!(vp && overlay && vp.contains(overlay)), panelInsideV: !!(vp && panel && vp.contains(panel)) };
      });
      expect(overlayInsideV).toBeFalsy();
      expect(panelInsideV).toBeFalsy();
    };

    // Initial assertion
    await assertAlignment();

    // Resize page to smaller viewport
    await page.setViewportSize({ width: 900, height: 700 });
    // Wait a tick for resize listeners to run
    await page.waitForTimeout(50);
    await assertAlignment();

    // Resize page to larger viewport
    await page.setViewportSize({ width: 1400, height: 900 });
    await page.waitForTimeout(50);
    await assertAlignment();

    // Scroll page and re-assert (overlay/panel should track iframe in page coordinates)
    await page.evaluate(() => window.scrollTo(0, 300));
    await page.waitForTimeout(50);
    await assertAlignment();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(50);
    await assertAlignment();
  });
});


