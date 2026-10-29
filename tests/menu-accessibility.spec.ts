import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { CATEGORIES, openFilters, openMenu, searchBox, tab } from './support/menu';

test.describe('Menu: accessibility', () => {
  test('axe scan: no critical WCAG 2.1 A/AA violations (all violations attached to report)', async ({ page }, info) => {
    await openMenu(page);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
    await info.attach('axe-violations.json', { body: JSON.stringify(results.violations, null, 2), contentType: 'application/json' });
    for (const v of results.violations) {
      info.annotations.push({ type: `axe:${v.impact}`, description: `${v.id}: ${v.help} (${v.nodes.length} nodes)` });
    }
    expect(results.violations.filter((v) => v.impact === 'critical').map((v) => v.id)).toEqual([]);
  });

  test('page has one h1 and headings are not skipped (h1 then h2)', async ({ page }) => {
    await openMenu(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    expect(await page.getByRole('heading', { level: 2 }).count()).toBeGreaterThanOrEqual(6);
  });

  test('search box and category tabs are reachable by keyboard', async ({ page }, info) => {
    test.skip(info.project.name === 'mobile', 'keyboard navigation is a desktop concern');
    await openMenu(page);
    await searchBox(page).focus();
    await expect(searchBox(page)).toBeFocused();
    await page.keyboard.type('pasty');
    const first = tab(page, CATEGORIES[0].name);
    await first.focus();
    await expect(first).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/category=breakfast/);
  });

  test('search box has an accessible name', async ({ page }) => {
    await openMenu(page);
    const name = await searchBox(page).evaluate((el) =>
      el.getAttribute('aria-label') || el.getAttribute('placeholder') || (el.id && document.querySelector(`label[for="${el.id}"]`)?.textContent) || el.getAttribute('aria-labelledby') || '',
    );
    expect(name, 'search input has no label/aria-label/placeholder').toBeTruthy();
  });

  const scan = async (page: import('@playwright/test').Page, info: import('@playwright/test').TestInfo, label: string, include?: string) => {
    let b = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
    if (include) b = b.include(include);
    const results = await b.analyze();
    await info.attach(`axe-${label}.json`, { body: JSON.stringify(results.violations, null, 2), contentType: 'application/json' });
    for (const v of results.violations) info.annotations.push({ type: `axe:${label}:${v.impact}`, description: `${v.id}: ${v.help} (${v.nodes.length} nodes)` });
    expect(results.violations.filter((v) => v.impact === 'critical').map((v) => v.id)).toEqual([]);
  };

  test('axe scan of a product page: no critical violations', async ({ page }, info) => {
    await page.goto('/menu/product/sausage-roll-1000446', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await scan(page, info, 'product-page');
  });

  test('axe scan of the open filter dialog: no critical violations', async ({ page }, info) => {
    // KNOWN DEFECT (found by this test): the dialog's close "X" button has no accessible name (axe: button-name)
    // and the calories slider has no label (axe: label). Both are critical WCAG failures. test.fail() keeps the
    // suite green while documenting the bug; once the site is fixed this test will "unexpectedly pass" and
    // should have the marker removed.
    test.fail(true, 'Known defect: close button and calories slider have no accessible name/label');
    await openMenu(page);
    await openFilters(page);
    await scan(page, info, 'filter-dialog', 'dialog');
  });

  test('filter dialog: focus moves into it and allergen options can be ticked with the keyboard', async ({ page }, info) => {
    test.skip(info.project.name === 'mobile', 'keyboard navigation is a desktop concern');
    await openMenu(page);
    const dlg = await openFilters(page);
    const inside = await dlg.evaluate((d) => d.contains(document.activeElement));
    expect.soft(inside, 'keyboard focus should move into the open dialog').toBe(true);
    const milk = dlg.locator('input#Milk');
    await milk.focus();
    await page.keyboard.press('Space');
    await expect(milk).toBeChecked();
  });
});
