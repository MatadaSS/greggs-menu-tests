import { test, expect } from '@playwright/test';
import { CATEGORIES, PRODUCT_LINK, openMenu, productLinks, tab } from './support/menu';

test.describe('Menu: categories and navigation', () => {
  test('landing page shows heading, all 6 categories and products', async ({ page }) => {
    await openMenu(page);
    await expect(page).toHaveTitle(/Menu/);
    for (const c of CATEGORIES) {
      await expect(page.getByRole('heading', { level: 2, name: c.name })).toBeVisible();
    }
    expect((await productLinks(page)).length).toBeGreaterThan(50);
  });

  for (const c of CATEGORIES) {
    test(`category tab "${c.name}" filters the list and updates the URL`, async ({ page }) => {
      await openMenu(page);
      await tab(page, c.name).click();
      await expect(page).toHaveURL(new RegExp(`category=${c.slug}$`));
      await expect(page.getByRole('heading', { level: 2, name: c.name })).toBeVisible();
      // Only the chosen category's section should remain
      for (const other of CATEGORIES.filter((o) => o.slug !== c.slug)) {
        await expect(page.getByRole('heading', { level: 2, name: other.name })).toHaveCount(0);
      }
      expect((await productLinks(page)).length).toBeGreaterThan(0);
    });
  }

  test('deep link /menu?category=... opens that category directly', async ({ page }) => {
    await openMenu(page, '/menu?category=sweet-treats');
    await expect(page.getByRole('heading', { level: 2, name: 'SWEET TREATS' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'BREAKFAST' })).toHaveCount(0);
  });

  test('"ALL" tab restores every category after filtering', async ({ page }) => {
    await openMenu(page);
    await tab(page, 'HOT FOOD').click();
    await tab(page, 'ALL').click();
    for (const c of CATEGORIES) {
      await expect(page.getByRole('heading', { level: 2, name: c.name })).toBeVisible();
    }
  });

  test('clicking a product opens its detail page, and Back returns to the menu', async ({ page }) => {
    await openMenu(page);
    const first = page.locator(PRODUCT_LINK).first();
    const name = (await first.innerText()).trim().replace(/\s+/g, ' ');
    await first.click();
    await expect(page).toHaveURL(/\/menu\/product\/.+-\d+$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(new RegExp(name, 'i'));
    await page.goBack();
    await expect(page).toHaveURL(/\/menu/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('OUR MENU');
  });

  test('unknown product URL returns a 404 page', async ({ page }) => {
    const res = await page.goto('/menu/product/not-a-real-thing-999');
    expect(res?.status()).toBe(404);
  });
});
