import { test, expect } from '@playwright/test';
import { CATEGORIES, PRODUCT_LINK, openMenu, searchBox, tab } from './support/menu';

test.describe('Menu: UI rendering and responsiveness', () => {
  test('core elements are visible: search, filter and category tabs', async ({ page }) => {
    await openMenu(page);
    await expect(searchBox(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Filter results' })).toBeVisible();
    await expect(tab(page, 'ALL')).toBeVisible();
    for (const c of CATEGORIES) {
      await expect(tab(page, c.name)).toBeAttached();
    }
  });

  test('page does not scroll sideways at this viewport', async ({ page }) => {
    await openMenu(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, 'horizontal overflow in px').toBeLessThanOrEqual(1);
  });

  test('product images actually load (not broken)', async ({ page }) => {
    await openMenu(page);
    // Images are lazy-loaded, so scroll each into view and wait until it has really loaded.
    const imgs = page.locator(`${PRODUCT_LINK} img`);
    for (let i = 0; i < 8; i++) {
      await imgs.nth(i).scrollIntoViewIfNeeded();
      await expect
        .poll(() => imgs.nth(i).evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0), {
          message: `image #${i} failed to load`,
          timeout: 15_000,
        })
        .toBe(true);
    }
  });

  test('product grid adapts to screen width (more columns on desktop than mobile)', async ({ page }, info) => {
    await openMenu(page);
    const firstRowCount = await page.$$eval(PRODUCT_LINK, (as) => {
      const top = (as[0] as HTMLElement).getBoundingClientRect().top;
      return as.filter((a) => Math.abs((a as HTMLElement).getBoundingClientRect().top - top) < 5).length;
    });
    if (info.project.name === 'mobile') expect(firstRowCount).toBeLessThanOrEqual(2);
    else if (info.project.name === 'tablet') expect(firstRowCount).toBeGreaterThanOrEqual(2);
    else expect(firstRowCount).toBeGreaterThanOrEqual(3);
  });

  test('cookie banner can be rejected and stays dismissed on reload', async ({ page }) => {
    await page.goto('/menu', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Reject all' }).click();
    await expect(page.getByRole('button', { name: 'Reject all' })).toBeHidden();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    await expect(page.getByRole('button', { name: 'Reject all' })).toBeHidden();
  });
});
