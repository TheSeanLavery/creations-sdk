import { test, expect } from '@playwright/test';

test.describe('Creations dropdown diagnostics', () => {
  test('no console errors, dropdown populated, screenshot menu', async ({ page, request }, testInfo) => {
    const consoleMsgs = [];
    const failedRequests = [];

    page.on('console', (msg) => {
      const type = msg.type();
      if (type === 'error' || type === 'warning') {
        consoleMsgs.push({ type, text: msg.text() });
      }
    });
    page.on('requestfailed', (req) => {
      failedRequests.push({ url: req.url(), method: req.method(), failure: req.failure()?.errorText });
    });

    await page.goto('/');

    const select = page.locator('#creation-select');
    await expect(select).toBeVisible();

    // Cross-check API directly
    const api = await request.get('/api/creations', { headers: { 'cache-control': 'no-store' } });
    const apiOk = api.ok();
    let apiJson = null;
    if (apiOk) apiJson = await api.json();

    // Wait for dropdown to become enabled or show explicit failure text
    const enabled = await expect
      .poll(async () => (await select.evaluate((el) => el.disabled ? 'disabled' : 'enabled')))
      .toBe('enabled');

    // Gather options text/values
    const optionLocs = select.locator('option');
    await expect.poll(async () => await optionLocs.count()).toBeGreaterThan(0);
    const optionTexts = await optionLocs.allTextContents();
    const optionValues = await optionLocs.evaluateAll((els) => els.map((e) => e.value));

    // Attach artifacts
    await testInfo.attach('console.json', { body: Buffer.from(JSON.stringify(consoleMsgs, null, 2)), contentType: 'application/json' });
    await testInfo.attach('failedRequests.json', { body: Buffer.from(JSON.stringify(failedRequests, null, 2)), contentType: 'application/json' });
    await testInfo.attach('options.json', { body: Buffer.from(JSON.stringify({ optionTexts, optionValues, apiOk, apiJson }, null, 2)), contentType: 'application/json' });
    const screenshotPath = testInfo.outputPath('creations-dropdown.png');
    await select.screenshot({ path: screenshotPath });
    await testInfo.attach('creations-dropdown.png', { path: screenshotPath, contentType: 'image/png' });

    // Assertions
    expect(consoleMsgs, 'No console errors or warnings are expected').toEqual([]);
    if (apiOk && Array.isArray(apiJson?.items) && apiJson.items.length > 0) {
      expect(optionTexts.length).toBeGreaterThan(1);
      // Select the first real option and verify navigation
      await select.selectOption({ index: 1 });
      await expect(page).toHaveURL(/\/creations\/.+\/index\.html$/);
    } else {
      // If API is not OK, the UI should show failure state and be disabled
      expect(optionTexts.join('\n')).toMatch(/Failed to load creations|No creations found/);
      await expect(select).toBeDisabled();
    }
  });
});


