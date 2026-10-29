import { test, expect } from '@playwright/test';
import { openMenu, productLinks, searchBox } from './support/menu';

test.describe('Menu: search', () => {
  test('typing a term narrows results to matching products', async ({ page }) => {
    await openMenu(page);
    const before = (await productLinks(page)).length;
    await searchBox(page).fill('sausage');
    await expect.poll(async () => (await productLinks(page)).length).toBeLessThan(before);
    const results = await productLinks(page);
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) expect(r.text.toLowerCase()).toContain('sausage');
  });

  test('search is case-insensitive', async ({ page }) => {
    await openMenu(page);
    await searchBox(page).fill('SAUSAGE ROLL');
    await expect.poll(async () => (await productLinks(page)).some((r) => /^sausage roll$/i.test(r.text))).toBe(true);
  });

  test('a term with no matches shows a friendly empty state', async ({ page }) => {
    await openMenu(page);
    await searchBox(page).fill('zzzzqqq');
    await expect(page.getByText('WE COULD NOT FIND ANY PRODUCTS MATCHING YOUR CRITERIA')).toBeVisible();
    expect(await productLinks(page)).toHaveLength(0);
  });

  test('clearing the search brings the full menu back', async ({ page }) => {
    await openMenu(page);
    const before = (await productLinks(page)).length;
    await searchBox(page).fill('zzzzqqq');
    await expect(page.getByText('WE COULD NOT FIND ANY PRODUCTS')).toBeVisible();
    await searchBox(page).fill('');
    await expect.poll(async () => (await productLinks(page)).length).toBe(before);
  });
});
