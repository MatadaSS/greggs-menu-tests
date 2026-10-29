import { test, expect } from '@playwright/test';
import { CATEGORIES, PRODUCT_LINK, openMenu, productLinks } from './support/menu';

test.describe('Menu: data consistency', () => {
  test('every product link has a name, a slug and a numeric id', async ({ page }) => {
    await openMenu(page);
    const links = await productLinks(page);
    for (const l of links) {
      expect.soft(l.text, `link ${l.href} has no visible name`).not.toBe('');
      expect.soft(l.href, 'malformed product URL').toMatch(/^\/menu\/product\/[a-z0-9-]+-\d+$/);
    }
  });

  test('no product appears twice within the same category', async ({ page }) => {
    await openMenu(page);
    const sections = await page.$$eval('h2', (hs) =>
      hs
        .map((h) => {
          const wrap = h.closest('section') ?? h.parentElement!;
          return {
            category: (h as HTMLElement).innerText.trim(),
            hrefs: [...wrap.querySelectorAll('a[href*="/menu/product/"]')].map((a) => a.getAttribute('href')),
          };
        })
        .filter((s) => s.hrefs.length > 0),
    );
    expect(sections.length).toBeGreaterThanOrEqual(6);
    for (const s of sections) {
      expect.soft(new Set(s.hrefs).size, `duplicates in ${s.category}`).toBe(s.hrefs.length);
    }
  });

  test('every product card has an image with alt text', async ({ page }) => {
    await openMenu(page);
    const imgs = await page.$$eval(`${PRODUCT_LINK} img`, (is) =>
      is.map((i) => ({ alt: i.getAttribute('alt'), src: i.getAttribute('src') })),
    );
    expect(imgs.length).toBeGreaterThan(50);
    for (const i of imgs) {
      expect.soft(i.alt, `image ${i.src} missing alt`).toBeTruthy();
    }
  });

  test('card name matches the product page heading (sample of 5 products)', async ({ page }) => {
    await openMenu(page);
    const links = (await productLinks(page)).filter((_, i) => i % 15 === 0).slice(0, 5);
    for (const l of links) {
      await page.goto(l.href, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(new RegExp(`^${l.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'));
    }
  });

  test('product page shows a nutrition table with energy in kcal', async ({ page }) => {
    await page.goto('/menu/product/sausage-roll-1000446', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Nutritional Information' })).toBeVisible();
    await expect(page.locator('main')).toContainText(/Energy\s*\d+\s*kJ\s*\d+\s*kcal/i);
  });

  for (const c of CATEGORIES) {
    test(`first product in "${c.name}" has a complete product page`, async ({ page }) => {
      await openMenu(page, `/menu?category=${c.slug}`);
      const first = (await productLinks(page))[0];
      const res = await page.goto(first.href, { waitUntil: 'domcontentloaded' });
      expect(res?.status()).toBe(200);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(new RegExp(`^${first.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'));
      const img = page.locator('main img').first();
      await expect(img).toBeVisible();
      expect(await img.getAttribute('alt'), 'product image alt text').toBeTruthy();
      await expect(page.getByRole('heading', { name: 'Nutritional Information' })).toBeVisible();
      const text = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
      expect.soft(text, 'energy kJ/kcal').toMatch(/Energy\s*\d+\s*kJ\s*\d+\s*kcal/i);
      expect.soft(text, 'allergens line').toMatch(/Allergens\*?:/i);
    });
  }
});
