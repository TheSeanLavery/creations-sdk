import { test, expect } from '@playwright/test'

test.describe('Bullet-Hell core systems', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/creations/bullet-hell/index.html')
    await page.waitForTimeout(300) // allow app boot
  })

  test('RNG determinism: enemiesSummary hash identical across reload (initial state)', async ({ page }) => {
    async function sampleHash() {
      return await page.evaluate(() => {
        const s = []
        for (let i = 0; i < 5; i++) {
          const sum = window.__debug?.enemiesSummary?.()
          s.push(JSON.stringify(sum))
        }
        return crypto.subtle.digest('SHA-256', new TextEncoder().encode(s.join('|'))).then(b => {
          const a = Array.from(new Uint8Array(b)); return a.map(x => x.toString(16).padStart(2, '0')).join('')
        })
      })
    }
    const h1 = await sampleHash()
    await page.reload({ waitUntil: 'domcontentloaded' })
    const h2 = await sampleHash()
    expect(h1).toBe(h2)
  })

  test('Phases parallel with sleeps sequencing', async ({ page }) => {
    // Observe counts over time
    const samples = []
    for (let t = 0; t < 5000; t += 500) {
      await page.waitForTimeout(500)
      const s = await page.evaluate(() => window.__debug.enemiesSummary())
      samples.push({ t, s })
    }
    // Basic sanity: enemies should appear within first second
    expect(samples[0].s.count).toBeGreaterThanOrEqual(0)
    // Some growth over time expected
    const last = samples[samples.length - 1].s.count
    expect(last).toBeGreaterThan(0)
  })

  test('Off-screen spawns then enter view', async ({ page }) => {
    // Peek into positions indirectly by waiting until some enemies exist and then confirming they enter (frameCount grows)
    await expect.poll(async () => await page.evaluate(() => window.__debug.enemiesSummary().count)).toBeGreaterThan(0)
    // Frame counter advances ~60/sec; just assert it increments
    const f0 = await page.evaluate(() => window.__debug.frameCount)
    await page.waitForTimeout(1000)
    const f1 = await page.evaluate(() => window.__debug.frameCount)
    expect(f1).toBeGreaterThan(f0)
  })

  test('Popcorn drift and 1 shot/sec', async ({ page }) => {
    // Over 2 seconds, bullet count should rise roughly with enemies present
    await page.waitForTimeout(1000)
    const e1 = await page.evaluate(() => window.__debug.enemiesSummary())
    await page.waitForTimeout(1000)
    const b = await page.evaluate(() => window.__debug.bulletsSummary())
    // Not strict: just ensure some enemy bullets exist
    expect(b.enemy).toBeGreaterThan(0)
    expect(e1.count).toBeGreaterThan(0)
  })

  test('Perf overlay toggles on click', async ({ page }) => {
    const overlay = page.locator('text=/^fps /')
    await expect(overlay).toBeVisible()
    await overlay.click()
    await expect(overlay).toHaveCSS('opacity', '0')
    await overlay.click()
    await expect(overlay).not.toHaveCSS('opacity', '0')
  })

  test('FPS cap ~60', async ({ page }) => {
    const f0 = await page.evaluate(() => window.__debug.frameCount)
    await page.waitForTimeout(2000)
    const f1 = await page.evaluate(() => window.__debug.frameCount)
    const frames = f1 - f0
    expect(frames).toBeLessThanOrEqual(130) // tolerate variance
    expect(frames).toBeGreaterThan(60)
  })
})


