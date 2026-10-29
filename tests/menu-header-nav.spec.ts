import { test, expect, Page } from '@playwright/test';
import { CATEGORIES, dismissCookies, openMenu } from './support/menu';

const header = (page: Page) => page.locator('header');

/**
 * Opens the "Menu & allergens" links. On desktop it is a dropdown button in the header; on tablet and mobile the
 * header collapses to a "Menu" burger that opens a drawer, so we open that first when it is visible.
 */
async function openMenuLinks(page: Page) {
  const burger = header(page).getByRole('button', { name: /^menu$/i });
  if (await burger.isVisible()) await burger.click();
  // The "Menu & allergens" section starts collapsed in both layouts, so always expand it.
  await header(page).getByRole('button', { name: /menu & allergens/i }).click();
  await expect(header(page).locator('a[href="/menu?category=breakfast"]').first()).toBeVisible();
}

test.describe('Menu: header "Menu & allergens" navigation', () => {
  test('menu links list every category, View all products and Allergens & Nutrition', async ({ page }) => {
    await openMenu(page);
    await openMenuLinks(page);
    for (const c of CATEGORIES) {
      // Links are matched by href: their accessible names include the picture's alt text.
      await expect(header(page).locator(`a[href="/menu?category=${c.slug}"]`).first()).toBeVisible();
    }
    await expect(header(page).locator('a[href="/menu"]').first()).toBeVisible();
    await expect(header(page).locator('a[href="/nutrition"]').first()).toBeVisible();
  });

  test('choosing a category from the header opens that category', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await dismissCookies(page);
    await openMenuLinks(page);
    await header(page).locator('a[href="/menu?category=drinks-snacks"]').first().click();
    await expect(page).toHaveURL(/\/menu\?category=drinks-snacks/);
    await expect(page.getByRole('heading', { level: 2, name: 'DRINKS & SNACKS' })).toBeVisible();
  });

  test('"Allergens & Nutrition" page loads', async ({ page }) => {
    const res = await page.goto('/nutrition', { waitUntil: 'domcontentloaded' });
    expect(res?.status()).toBe(200);
    await expect(page).toHaveURL(/\/nutrition/);
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
  });

  test('logo returns to the homepage from the menu', async ({ page }) => {
    await openMenu(page);
    await header(page).getByRole('link', { name: /greggs homepage/i }).click();
    await expect(page).toHaveURL(/greggs\.com\/?$/);
  });
});
