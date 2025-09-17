import { test, expect } from '@playwright/test';

test.describe('plugin-demo loads', () => {
  test('index renders and no console errors', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
    });

    await page.goto('/');

    await expect(page.locator('header h1')).toHaveText(/R1 Test/i);
    await expect(page.locator('.welcome h2')).toHaveText(/Welcome/i);

    // Open menu and navigate to Data page
    await page.click('#menuBtn');
    await page.click('a[data-page="data"]');
    await expect(page.locator('.data-container')).toBeVisible();

    // Navigate to Hardware page
    await page.click('#menuBtn');
    await page.click('a[data-page="hardware"]');
    await expect(page.locator('.hardware-container')).toBeVisible();

    // Navigate to Speak page
    await page.click('#menuBtn');
    await page.click('a[data-page="speak"]');
    await expect(page.locator('.speak-container')).toBeVisible();

    // Ensure no console errors
    expect(errors).toEqual([]);
  });
});


