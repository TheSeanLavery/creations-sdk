import { test, expect } from '@playwright/test';

test.describe('Right input panel → scroll and click events', () => {
  test('wheel and click on panel drive plugin hardware LEDs', async ({ page }) => {
    await page.goto('/');

    const select = page.locator('#creation-select');
    await expect(select).toBeVisible();

    // Select plugin-demo
    const index = await select.locator('option').evaluateAll((els) => {
      const i = els.findIndex((e) => (e.textContent || '').trim() === 'plugin-demo');
      return i >= 0 ? i : 1;
    });
    await select.selectOption({ index });

    const frame = page.frameLocator('.viewport iframe');

    // Open Hardware page
    await frame.locator('#menuBtn').click();
    await frame.locator('.menu-nav a[data-page="hardware"]').click();

    // Ensure buttons tab is visible (default)
    await expect(frame.locator('#buttons-tab')).toBeVisible();

    const panel = page.locator('#input-panel');
    await expect(panel).toBeVisible();
    await panel.hover();

    // Scroll DOWN -> downLed should blink
    await page.mouse.wheel(0, 200);
    await expect.poll(async () => {
      return await frame.locator('#downLed').evaluate((el) => el.classList.contains('blink'));
    }).toBe(true);

    // Small wait for blink to clear
    await page.waitForTimeout(600);

    // Scroll UP -> upLed should blink
    await panel.hover();
    await page.mouse.wheel(0, -200);
    await expect.poll(async () => {
      return await frame.locator('#upLed').evaluate((el) => el.classList.contains('blink'));
    }).toBe(true);

    await page.waitForTimeout(600);

    // Click -> PTT LED should blink
    await panel.click();
    await expect.poll(async () => {
      return await frame.locator('#pttLed').evaluate((el) => el.classList.contains('blink'));
    }).toBe(true);
  });
});


