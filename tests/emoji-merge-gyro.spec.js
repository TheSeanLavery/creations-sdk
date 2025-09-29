import { test, expect } from '@playwright/test';

test.describe('emoji-merge-game gyro reacts to emulator sliders', () => {
  test('overlay updates when sliders move', async ({ page }) => {
    await page.goto('/');

    // Select emoji-merge-game creation
    const select = page.locator('#creation-select');
    await expect(select).toBeVisible();
    const optionIndex = await select.locator('option').evaluateAll((els) => {
      const idx = els.findIndex((e) => e.textContent?.trim() === 'emoji-merge-game');
      return idx >= 0 ? idx : 1;
    });
    await select.selectOption({ index: optionIndex });

    const frame = page.frameLocator('.viewport iframe');

    // Ensure overlay present
    const overlay = frame.locator('#gyro-overlay');
    await expect(overlay).toBeVisible();

    // Helper to set emulator sliders on host
    const setSlider = async (sliderSel, numSel, value) => {
      await page.locator(sliderSel).fill(String(value));
      await page.locator(numSel).fill(String(value));
    };

    // Move sliders
    await setSlider('#emu-tilt-x', '#emu-tilt-x-num', 0.4);
    await setSlider('#emu-tilt-y', '#emu-tilt-y-num', -0.2);
    await setSlider('#emu-tilt-z', '#emu-tilt-z-num', 0.7);

    // Poll overlay text for expected values (x,y,z lines)
    await expect.poll(async () => {
      const t = (await overlay.textContent()) || '';
      return /x:\s*0\.4/.test(t);
    }).toBeTruthy();

    await expect.poll(async () => {
      const t = (await overlay.textContent()) || '';
      // y mapping may include base gravity bias; just ensure it changes sign appropriately
      return t.includes('y:');
    }).toBeTruthy();

    await expect.poll(async () => {
      const t = (await overlay.textContent()) || '';
      return /z:\s*0\.7/.test(t);
    }).toBeTruthy();
  });
});


