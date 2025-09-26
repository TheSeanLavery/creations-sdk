import { test, expect } from '@playwright/test'

test.describe('Boss firing behavior', () => {
  test('Boss fires bullets repeatedly', async ({ page }) => {
    await page.goto('/creations/bullet-hell/index.html')
    // Jump to stage with boss and force spawn
    await page.waitForTimeout(300)
    await page.evaluate(() => window.__debug.setStage && window.__debug.setStage(1))
    await page.evaluate(() => window.__debug.forceSpawnGate && window.__debug.forceSpawnGate())
    await page.waitForTimeout(500)

    // Sample enemy bullet counts over time; expect growth
    const counts = []
    for (let t = 0; t < 3000; t += 500) {
      await page.waitForTimeout(500)
      const c = await page.evaluate(() => window.__debug.bulletsSummary().enemy)
      counts.push(c)
    }
    // Ensure there was at least one increase between samples
    let increased = false
    for (let i = 1; i < counts.length; i++) if (counts[i] > counts[i-1]) { increased = true; break }
    expect(increased).toBeTruthy()
  })
})


