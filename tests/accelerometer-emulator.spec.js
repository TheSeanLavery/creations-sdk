import { test, expect } from '@playwright/test';

test.describe('Accelerometer emulator → plugin hardware page', () => {
  test('sliders drive accelerometer values in plugin hardware accelerometer tab', async ({ page }) => {
    // Host
    await page.goto('/');

    // Select plugin-demo creation
    const select = page.locator('#creation-select');
    await expect(select).toBeVisible();
    // Find option with label 'plugin-demo'
    const optionIndex = await select.locator('option').evaluateAll((els) => {
      const idx = els.findIndex((e) => e.textContent?.trim() === 'plugin-demo');
      return idx >= 0 ? idx : 1; // fallback to first
    });
    await select.selectOption({ index: optionIndex });

    // Get iframe locator
    const frameLocator = page.frameLocator('.viewport iframe');

    // Open menu and navigate to Hardware page inside plugin
    await frameLocator.locator('#menuBtn').click();
    await frameLocator.locator('.menu-nav a[data-page="hardware"]').click();

    // Switch to Accelerometer tab
    await frameLocator.locator('.tab-button[data-tab="accelerometer"]').click();

    // Start accelerometer
    const startBtn = frameLocator.locator('#toggleAccel');
    await expect(startBtn).toBeVisible();
    await startBtn.click();

    // Ensure values elements are visible
    const tiltX = frameLocator.locator('#tiltX');
    const tiltY = frameLocator.locator('#tiltY');
    const tiltZ = frameLocator.locator('#tiltZ');
    const rawX = frameLocator.locator('#rawX');
    const rawY = frameLocator.locator('#rawY');
    const rawZ = frameLocator.locator('#rawZ');
    await expect(tiltX).toBeVisible();
    await expect(rawX).toBeVisible();

    // Adjust host emulator sliders
    const setSlider = async (sliderSel, numSel, value) => {
      await page.locator(sliderSel).fill(String(value));
      await page.locator(numSel).fill(String(value));
    };

    // Set to X=0.5, Y=-0.25, Z=0.8
    await setSlider('#emu-tilt-x', '#emu-tilt-x-num', 0.5);
    await setSlider('#emu-tilt-y', '#emu-tilt-y-num', -0.25);
    await setSlider('#emu-tilt-z', '#emu-tilt-z-num', 0.8);

    // Wait for plugin to receive callback and update text
    await expect.poll(async () => parseFloat(await tiltX.textContent() || '0')).toBeCloseTo(0.5, 2);
    await expect.poll(async () => parseFloat(await tiltY.textContent() || '0')).toBeCloseTo(-0.25, 2);
    await expect.poll(async () => parseFloat(await tiltZ.textContent() || '0')).toBeCloseTo(0.8, 2);

    // Raw values should reflect approx 9.81 scaling
    await expect.poll(async () => parseFloat(await rawX.textContent() || '0')).toBeCloseTo(0.5 * 9.81, 1);
    await expect.poll(async () => parseFloat(await rawY.textContent() || '0')).toBeCloseTo(-0.25 * 9.81, 1);
    await expect.poll(async () => parseFloat(await rawZ.textContent() || '0')).toBeCloseTo(0.8 * 9.81, 1);
  });
});


