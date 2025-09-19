import { test, expect } from '@playwright/test';

test.describe('Creations dropdown UI', () => {
  test('dropdown enables, lists creations, and navigates', async ({ page, request }) => {
    await page.goto('/');

    const select = page.locator('#creation-select');
    await expect(select).toBeVisible();

    // Ensure API has items
    const api = await request.get('/api/creations', { headers: { 'cache-control': 'no-store' } });
    expect(api.ok()).toBeTruthy();
    const json = await api.json();
    const apiCount = Array.isArray(json.items) ? json.items.length : 0;

    // Wait for dropdown to populate; it should not be disabled nor show failure text
    await expect.poll(async () => await select.evaluate((el) => el.disabled ? 'disabled' : 'enabled')).toBe('enabled');
    await expect.poll(async () => await select.locator('option').count()).toBeGreaterThan(1);

    const optionTexts = await select.locator('option').allTextContents();
    const joined = optionTexts.join('\n');
    expect(joined).not.toMatch(/Failed to load creations/);
    expect(joined).not.toMatch(/No creations found/);

    // UI options should equal API items + placeholder
    expect(optionTexts.length).toBe(apiCount + 1);

    // Select first real option and verify iframe updates to selected creation
    await select.selectOption({ index: 1 });
    const frame = page.locator('.viewport iframe');
    await expect(frame).toHaveAttribute('src', /\/creations\/.+\/index\.html$/);
  });
});


