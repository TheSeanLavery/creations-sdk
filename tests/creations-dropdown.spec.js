import { test, expect } from '@playwright/test';

test.describe('Creations dropdown', () => {
  test('populates with API items and navigates to selected', async ({ page, request }) => {
    // Ensure server is running separately before tests
    await page.goto('/');

    const select = page.locator('#creation-select');
    await expect(select).toBeVisible();

    // Cross-check API
    const api = await request.get('/api/creations', { headers: { 'cache-control': 'no-store' } });
    expect(api.ok()).toBeTruthy();
    const json = await api.json();
    const num = Array.isArray(json.items) ? json.items.length : 0;

    // Wait for options to load
    await expect.poll(async () => await select.locator('option').count()).toBeGreaterThan(0);

    if (num > 0) {
      // Wait until UI reflects API
      await expect.poll(async () => (await select.locator('option').count()) - 1).toBe(num);

      // Compare labels (excluding placeholder)
      const uiLabels = (await select.locator('option').allTextContents()).slice(1);
      const apiLabels = json.items.map((i) => i.label);
      expect(uiLabels).toEqual(apiLabels);

      // Select first and assert iframe src updates to a creation index
      await select.selectOption({ index: 1 });
      const frame = page.locator('.viewport iframe');
      await expect(frame).toHaveAttribute('src', /\/creations\/.+\/index\.html$/);
      await expect(page.locator('html')).toBeVisible();
    } else {
      await expect(select).toBeDisabled();
      // One of these three messages must be present
      const opts = await select.locator('option').allTextContents();
      expect(opts.join('\n')).toMatch(/Failed to load creations|No creations found|Select a creation…/);
    }
  });
});


