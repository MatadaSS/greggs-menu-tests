import { test, expect } from '@playwright/test';
import { ALLERGENS, CATEGORIES, PRODUCT_LINK, applyAllergenFilter, filterDialog, openFilters, openMenu, productAllergens, productCount, productLinks } from './support/menu';

test.describe('Menu: filters (calories and allergens)', () => {
  test('filter dialog opens and shows calories, all 11 allergens and categories', async ({ page }, info) => {
    await openMenu(page);
    const dlg = await openFilters(page);
    await expect(dlg.getByRole('heading', { name: 'Filters' })).toBeVisible();
    await expect(dlg.getByRole('heading', { name: 'Calories' })).toBeVisible();
    await expect(dlg.locator('input[type="range"]')).toBeAttached();
    await expect(dlg.getByRole('heading', { name: 'Allergens' })).toBeVisible();
    for (const a of ALLERGENS) await expect(dlg.getByText(`No ${a}`, { exact: true })).toBeVisible();
    await expect(dlg.getByRole('link', { name: /allergen and nutrition page/i })).toHaveAttribute('href', /nutrition/);
    // The "Back" button is only shown on larger screens; on a phone the close X is the way out.
    const buttons = info.project.name === 'mobile' ? ['Clear all', 'Apply filters'] : ['Back', 'Clear all', 'Apply filters'];
    for (const name of buttons) await expect(dlg.getByRole('button', { name: new RegExp(name, 'i') })).toBeVisible();
  });

  test('dialog closes with Back, the close button and Escape', async ({ page }, info) => {
    await openMenu(page);
    let dlg = await openFilters(page);
    if (info.project.name !== 'mobile') {
      await dlg.getByRole('button', { name: 'Back' }).click();
      await expect(dlg).toBeHidden();
      dlg = await openFilters(page);
    }
    await dlg.getByRole('button').first().click(); // the "X" (it has no text label)
    await expect(dlg).toBeHidden();
    test.skip(info.project.name === 'mobile', 'Escape key is a desktop interaction');
    dlg = await openFilters(page);
    await page.keyboard.press('Escape');
    await expect(dlg).toBeHidden();
  });

  test('an allergen filter reduces the list, shows a chip, and removing it restores everything', async ({ page }) => {
    await openMenu(page);
    const total = await productCount(page);
    await applyAllergenFilter(page, ['Milk']);
    await expect.poll(() => productCount(page)).toBeLessThan(total);
    expect(await productCount(page)).toBeGreaterThan(0);
    await expect(page.getByRole('button', { name: /remove filter/i })).toHaveCount(1); // one active-filter chip
    await page.getByRole('button', { name: /remove filter/i }).first().click();
    await expect.poll(() => productCount(page)).toBe(total);
  });

  for (const allergen of ['Wheat', 'Eggs']) {
    test(`DATA CORRECTNESS: with "No ${allergen}" applied, products really do not list ${allergen} (sample of 4)`, async ({ page }) => {
      await openMenu(page);
      await applyAllergenFilter(page, [allergen]);
      const hrefs = (await productLinks(page)).map((l) => l.href).filter((_, i, a) => i % Math.ceil(a.length / 4) === 0).slice(0, 4);
      expect(hrefs.length).toBeGreaterThan(0);
      for (const href of hrefs) {
        const listed = await productAllergens(page, href);
        expect.soft(listed, `${href} lists allergens ${listed.join(', ')}`).not.toContain(allergen.toLowerCase());
      }
    });
  }

  test('combining two allergen filters never shows more products than one alone', async ({ page }) => {
    await openMenu(page);
    await applyAllergenFilter(page, ['Milk']);
    await expect.poll(() => productCount(page)).toBeGreaterThan(0);
    const one = await productCount(page);
    // second filter is added on top of the first (the dialog remembers the Milk tick)
    await applyAllergenFilter(page, ['Wheat']);
    await expect.poll(() => productCount(page)).toBeLessThanOrEqual(one);
  });

  test('calorie slider narrows the list, and shown products are at or under the limit (sample of 3)', async ({ page }) => {
    await openMenu(page);
    const total = await productCount(page);
    const dlg = await openFilters(page);
    await dlg.locator('input[type="range"]').fill('100');
    await dlg.getByRole('button', { name: /apply filters/i }).click();
    await expect.poll(() => productCount(page)).toBeLessThan(total);
    const hrefs = (await productLinks(page)).map((l) => l.href).slice(0, 3);
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      await page.goto(href, { waitUntil: 'domcontentloaded' });
      const text = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
      const kcal = Number(text.match(/Energy\s*\d+\s*kJ\s*(\d+)\s*kcal/i)?.[1]);
      expect.soft(kcal, `${href} kcal`).toBeLessThanOrEqual(100);
    }
  });

  test('selected filters are remembered when the dialog is reopened, and Clear all resets them', async ({ page }) => {
    await openMenu(page);
    const total = await productCount(page);
    await applyAllergenFilter(page, ['Milk']);
    await expect.poll(() => productCount(page)).toBeLessThan(total);
    const dlg = await openFilters(page);
    await expect(dlg.locator('input#Milk')).toBeChecked();
    await dlg.getByRole('button', { name: /clear all/i }).click();
    await expect(dlg.locator('input#Milk')).not.toBeChecked();
    await expect.poll(() => productCount(page)).toBe(total);
  });

  test('DATA CONSISTENCY: category counts in the filter dialog match the real lists and add up to the total', async ({ page }) => {
    await openMenu(page);
    const total = await productCount(page);
    const dlg = await openFilters(page);
    const text = (await dlg.innerText()).replace(/\s+/g, ' ');
    let sum = 0;
    for (const c of CATEGORIES) {
      const m = text.match(new RegExp(`${c.name.replace('&', '&')}\\s*\\((\\d+)\\)`, 'i'));
      expect(m, `no count shown for ${c.name}`).not.toBeNull();
      const shown = Number(m![1]);
      sum += shown;
      // Count what the real category page lists (deep link), in a second tab so the dialog stays open.
      const other = await page.context().newPage();
      await other.goto(`/menu?category=${c.slug}`, { waitUntil: 'domcontentloaded' });
      await expect(other.locator(PRODUCT_LINK).first()).toBeVisible();
      const real = await other.locator(PRODUCT_LINK).count();
      await other.close();
      expect.soft(real, `${c.name}: dialog says ${shown}`).toBe(shown);
    }
    expect(sum, 'category counts should add up to all products').toBe(total);
  });
});
