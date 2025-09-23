import { test, expect } from '@playwright/test';

test.describe('Emulator fullscreen scaling', () => {
  test('toggles fullscreen and scales iframe to container preserving aspect', async ({ page, browserName }) => {
    // Headed recommended, but still run in CI
    await page.goto('/');

    const vp = page.locator('#viewport');
    const frameEl = page.locator('.viewport iframe');
    const fsToggle = page.locator('#emu-fullscreen-toggle');
    const header = page.locator('header');
    const aside = page.locator('aside');

    await expect(vp).toBeVisible();
    await expect(frameEl).toBeVisible();
    await expect(fsToggle).toBeVisible();

    // Ensure starting in non-fullscreen (native 240x254)
    await fsToggle.uncheck({ force: true });
    await page.waitForTimeout(50);
    await expect(header).toBeVisible();

    const baseSize = await frameEl.evaluate((el) => ({ w: el.offsetWidth, h: el.offsetHeight, top: el.style.top, transform: el.style.transform }));
    expect(baseSize.w).toBe(240);
    expect(baseSize.h).toBe(254);
    expect((baseSize.top || '').includes('28px')).toBeTruthy();
    expect(baseSize.transform).toBe('');

    // Enable fullscreen container mode
    await fsToggle.check({ force: true });
    await page.waitForTimeout(150);

    // Host chrome should be hidden
    await expect(header).toBeHidden();
    await expect(aside).toBeHidden();

    // In fullscreen: iframe should be transformed (scaled and translated)
    const fsSize = await frameEl.evaluate((el) => ({ w: el.offsetWidth, h: el.offsetHeight, transform: el.style.transform }));
    expect(fsSize.w).toBe(240);
    expect(fsSize.h).toBe(254);
    expect(fsSize.transform).toContain('scale(');
    expect(fsSize.transform).toContain('translate(');

    // Check centering roughly: left/right letterboxing balanced within 4px
    const vpBox = await page.locator('.viewport').boundingBox();
    const tx = await frameEl.evaluate((el) => {
      const st = getComputedStyle(el);
      const m = st.transform || el.style.transform;
      if (!m || m === 'none') return 0;
      if (m.startsWith('matrix3d(')) { const p = m.slice(9, -1).split(',').map(Number); return p[12] || 0; }
      if (m.startsWith('matrix(')) { const p = m.slice(7, -1).split(',').map(Number); return p[4] || 0; }
      const t = m.match(/translate\(([^,]+),\s*([^\)]+)\)/); return t ? parseFloat(t[1]) : 0;
    });
    const scale = await frameEl.evaluate((el) => {
      const st = getComputedStyle(el);
      const m = st.transform || el.style.transform;
      if (!m || m === 'none') return 1;
      if (m.startsWith('matrix3d(')) { const p = m.slice(9, -1).split(',').map(Number); return p[0] || 1; }
      if (m.startsWith('matrix(')) { const p = m.slice(7, -1).split(',').map(Number); return p[0] || 1; }
      const s = m.match(/scale\(([^\)]+)\)/); return s ? parseFloat(s[1]) : 1;
    });
    const contentW = 240 * scale;
    const expectedLeft = (vpBox.width - contentW) / 2;
    expect(Math.abs(tx - Math.round(expectedLeft))).toBeLessThanOrEqual(4);

    // Exit fullscreen via Escape (toggle is hidden)
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    await expect(header).toBeVisible();

    const reset = await frameEl.evaluate((el) => ({ w: el.offsetWidth, h: el.offsetHeight, transform: el.style.transform, top: el.style.top }));
    expect(reset.w).toBe(240);
    expect(reset.h).toBe(254);
    expect(reset.transform).toBe('');
    expect((reset.top || '').includes('28px')).toBeTruthy();
  });
});


