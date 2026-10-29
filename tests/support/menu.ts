import { expect, Page } from '@playwright/test';

export const CATEGORIES = [
  { name: 'BREAKFAST', slug: 'breakfast' },
  { name: 'SAVOURIES & BAKES', slug: 'savouries-bakes' },
  { name: 'DRINKS & SNACKS', slug: 'drinks-snacks' },
  { name: 'SANDWICHES & SALADS', slug: 'sandwiches-salads' },
  { name: 'SWEET TREATS', slug: 'sweet-treats' },
  { name: 'HOT FOOD', slug: 'hot-food' },
] as const;

export const PRODUCT_LINK = 'a[href*="/menu/product/"]';

/** Dismiss the cookie banner (if it appears) so it can't cover anything. */
export async function dismissCookies(page: Page) {
  const reject = page.getByRole('button', { name: 'Reject all' });
  // isVisible() does not wait, so use waitFor: the banner can render a moment after load.
  const bannerShown = await reject.waitFor({ state: 'visible', timeout: 8_000 }).then(() => true, () => false);
  if (bannerShown) {
    await reject.click();
    await expect(reject).toBeHidden();
  }
}

/** Open the menu and dismiss the cookie banner. */
export async function openMenu(page: Page, path = '/menu') {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await dismissCookies(page);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('OUR MENU');
  await expect(page.locator(PRODUCT_LINK).first()).toBeVisible();
}

/** Tab buttons are uppercase via CSS only; their accessible names are e.g. "Breakfast". */
export const tab = (page: Page, name: string) =>
  page.getByRole('button', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') });

export const searchBox = (page: Page) => page.locator('#article-search');

export async function productLinks(page: Page) {
  return page.$$eval(PRODUCT_LINK, (as) =>
    as.map((a) => ({
      href: a.getAttribute('href') ?? '',
      text: (a as HTMLElement).innerText.trim().replace(/\s+/g, ' '),
    })),
  );
}

export const ALLERGENS = ['Soya', 'Wheat', 'Sulphites', 'Eggs', 'Milk', 'Oats', 'Barley', 'Mustard', 'Fish', 'Crustaceans', 'Nuts'] as const;

export const filterDialog = (page: Page) => page.locator('dialog');

export async function openFilters(page: Page) {
  await page.getByRole('button', { name: 'Filter results' }).click();
  await expect(filterDialog(page)).toBeVisible();
  return filterDialog(page);
}

export const productCount = (page: Page) => page.locator(PRODUCT_LINK).count();

/** Tick allergens (by their "No X" label) and press Apply. */
export async function applyAllergenFilter(page: Page, allergens: string[]) {
  const dlg = await openFilters(page);
  for (const a of allergens) await dlg.getByText(`No ${a}`, { exact: true }).click();
  await dlg.getByRole('button', { name: /apply filters/i }).click();
  await expect(dlg).toBeHidden();
}

/** The "Allergens*: Soya, Wheat" line on a product page, as a lower-case list. */
export async function productAllergens(page: Page, href: string): Promise<string[]> {
  await page.goto(href, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  const text = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
  const m = text.match(/Allergens\*?:\s*(.*?)\s*\*/i);
  expect(m, `no "Allergens*:" line found on ${href}`).not.toBeNull();
  return m![1].toLowerCase().split(/[,&]| and /).map((s) => s.trim()).filter(Boolean);
}
