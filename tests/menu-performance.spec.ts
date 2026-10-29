import { test, expect } from '@playwright/test';
import { openMenu, tab } from './support/menu';

// Budgets are deliberately generous: this hits a live production site over the public internet.
const BUDGET = { domContentLoadedMs: 5_000, lcpMs: 4_000, cls: 0.25 };

test.describe('Menu: performance', () => {
  async function measure(page: import('@playwright/test').Page) {
    await page.addInitScript(() => {
      (window as any).__lcp = 0;
      (window as any).__cls = 0;
      new PerformanceObserver((l) => { for (const e of l.getEntries()) (window as any).__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver((l) => { for (const e of l.getEntries() as any[]) if (!e.hadRecentInput) (window as any).__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
    });
    await openMenu(page);
    await page.waitForLoadState('load');
    await page.waitForTimeout(1500);
    return page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return { domContentLoadedMs: Math.round(nav.domContentLoadedEventEnd), lcpMs: Math.round((window as any).__lcp), cls: +(window as any).__cls.toFixed(3) };
    });
  }

  test('load time and Largest Contentful Paint are within budget', async ({ page }, info) => {
    const m = await measure(page);
    await info.attach('performance-metrics.json', { body: JSON.stringify(m, null, 2), contentType: 'application/json' });
    console.log(`[${info.project.name}] perf`, m);
    expect.soft(m.domContentLoadedMs, 'DOMContentLoaded').toBeLessThan(BUDGET.domContentLoadedMs);
    expect.soft(m.lcpMs, 'Largest Contentful Paint').toBeLessThan(BUDGET.lcpMs);
  });

  test('layout shift (CLS) is within budget', async ({ page }, info) => {
    // KNOWN DEFECT (found by this test): at tablet width (820px) CLS is about 0.39 on every run, above Google's
    // 0.25 "poor" threshold (desktop ~0.02, phone ~0.14). test.fail() keeps the suite green while documenting it;
    // when the site is fixed this will "unexpectedly pass" and the marker should be removed.
    test.fail(info.project.name === 'tablet', 'Known defect: CLS about 0.39 at tablet width');
    const m = await measure(page);
    console.log(`[${info.project.name}] cls`, m.cls);
    expect(m.cls, 'Cumulative Layout Shift').toBeLessThan(BUDGET.cls);
  });

  test('no same-site requests fail (4xx/5xx) while loading the menu', async ({ page }) => {
    const failed: string[] = [];
    page.on('response', (r) => {
      if (new URL(r.url()).hostname.endsWith('greggs.com') && r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
    });
    await openMenu(page);
    await page.waitForLoadState('networkidle').catch(() => {});
    expect(failed).toEqual([]);
  });

  test('category filtering responds quickly (no full reload needed)', async ({ page }) => {
    await openMenu(page);
    const t0 = Date.now();
    await tab(page, 'HOT FOOD').click();
    await expect(page.getByRole('heading', { level: 2, name: 'BREAKFAST' })).toHaveCount(0);
    expect(Date.now() - t0).toBeLessThan(3_000);
  });
});
