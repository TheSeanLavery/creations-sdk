import { test, expect } from '@playwright/test'

test.describe('Bullet-Hell boss UI and completion', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/creations/bullet-hell/index.html')
    await page.waitForTimeout(400)
  })

  test('Boss HP bar appears and shrinks with damage; level completes on death', async ({ page }) => {
    // Force-spawn/advance to boss: poll and if missing after timeout, damage miniboss if present or skip spawn gating
    // Jump to stage with a boss and force spawn gate
    await page.evaluate(() => window.__debug.setStage && window.__debug.setStage(1))
    await page.evaluate(() => window.__debug.forceSpawnGate && window.__debug.forceSpawnGate())
    await page.waitForTimeout(500)

    const bar = page.locator('[data-testid="boss-hp-bar"]')
    await expect(bar).toBeVisible()

    const w0 = await page.locator('[data-testid="boss-hp-bar"] div').evaluate(el => parseFloat(getComputedStyle(el).width))
    // Apply scripted damage to ensure shrink
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => window.__debug.damageBoss && window.__debug.damageBoss(50))
      await page.waitForTimeout(200)
    }
    const w1 = await page.locator('[data-testid="boss-hp-bar"] div').evaluate(el => parseFloat(getComputedStyle(el).width))
    expect(w1).toBeLessThan(w0)

    // Kill the boss and expect completion overlay
    for (let i = 0; i < 20; i++) {
      await page.evaluate(() => window.__debug.damageBoss && window.__debug.damageBoss(100))
    }
    await expect(page.locator('[data-testid="level-complete"]')).toBeVisible()
  })
})


