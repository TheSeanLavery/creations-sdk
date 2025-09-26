import { test, expect } from '@playwright/test';

test.describe('BitBreaker smoke', () => {
  test('loads graphics, responds to input, advances game loop', async ({ page }) => {
    await page.goto('/');

    // Select bitBreaker from creations dropdown
    const select = page.locator('#creation-select');
    await expect(select).toBeVisible();
    // Ensure API loaded
    await expect.poll(async () => await select.locator('option').count()).toBeGreaterThan(1);

    // Find the option that ends with /creations/bitBreaker/index.html
    const options = await select.locator('option').all();
    let index = 1;
    for (let i = 0; i < options.length; i++) {
      const v = await options[i].getAttribute('value');
      if (v && /\/creations\/bitBreaker\/index\.html$/.test(v)) { index = i; break; }
    }
    await select.selectOption({ index });

    const frame = page.frameLocator('.viewport iframe');
    await expect(frame.locator('canvas#glcanvas')).toBeVisible();

    // Query debug stats
    const stats1 = await frame.evaluate(() => window.BB_DEBUG?.getStats?.());
    expect(stats1).toBeTruthy();
    const bricks1 = stats1.bricksAlive;
    expect(stats1.balls).toBeGreaterThan(0);

    // Simulate scroll wheel down to move paddle right
    // Emulator exposes input via dispatching scrollDown to iframe window
    await page.evaluate(() => {
      const frameWin = document.querySelector('.viewport iframe')?.contentWindow;
      frameWin?.dispatchEvent(new CustomEvent('scrollDown'));
    });

    // Wait a frame and verify paddle moved
    await page.waitForTimeout(50);
    const stats2 = await frame.evaluate(() => window.BB_DEBUG?.getStats?.());
    expect(stats2.paddleX).toBeGreaterThan(stats1.paddleX);

    // Wait for powerups and multiballs to increase ball count
    await page.waitForTimeout(2000);
    const stats3 = await frame.evaluate(() => window.BB_DEBUG?.getStats?.());
    expect(stats3.balls).toBeGreaterThanOrEqual(stats2.balls);
  });
});


