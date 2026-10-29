import { test, expect } from '@playwright/test';
import { PRODUCT_LINK, applyAllergenFilter, openFilters, openMenu, productAllergens, productLinks, searchBox } from './support/menu';

/**
 * "Tests for the tests". Each case deliberately sabotages the page (or asks a wrong question) and runs the SAME
 * kind of assertion used in the real suite. test.fail() means: this test passes only if the assertion inside
 * really fails. If one of these ever shows as "unexpectedly passed", the matching real test has lost its teeth.
 */
test.describe('Negative controls: do our checks actually catch problems?', () => {
  test.beforeEach(async ({}, info) => {
    test.skip(info.project.name !== 'desktop', 'one viewport is enough to prove the checks have teeth');
  });

  test('missing alt text WOULD be caught', async ({ page }) => {
    test.fail();
    await page.addInitScript(() => {
      new MutationObserver(() => document.querySelectorAll('a[href*="/menu/product/"] img').forEach((i) => i.removeAttribute('alt'))).observe(document, { subtree: true, childList: true });
    });
    await openMenu(page);
    const alts = await page.$$eval(`${PRODUCT_LINK} img`, (is) => is.map((i) => i.getAttribute('alt')));
    for (const a of alts) expect(a).toBeTruthy();
  });

  test('broken product images WOULD be caught', async ({ page }) => {
    test.fail();
    await page.route(/\.(png|jpe?g|webp|avif)(\?.*)?$/i, (r) => r.abort());
    await openMenu(page);
    const imgs = page.locator(`${PRODUCT_LINK} img`);
    await imgs.first().scrollIntoViewIfNeeded();
    await expect.poll(() => imgs.first().evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0), { timeout: 5_000 }).toBe(true);
  });

  test('a fake 200 on an unknown product URL WOULD be caught', async ({ page }) => {
    test.fail();
    await page.route('**/menu/product/not-a-real-thing-999', (r) => r.fulfill({ status: 200, contentType: 'text/html', body: '<h1>ok</h1>' }));
    const res = await page.goto('/menu/product/not-a-real-thing-999');
    expect(res?.status()).toBe(404);
  });

  test('a product that lists the filtered allergen WOULD be caught', async ({ page }) => {
    test.fail();
    await openMenu(page);
    await applyAllergenFilter(page, ['Milk']); // genuine filter...
    const hrefs = (await productLinks(page)).map((l) => l.href).slice(0, 6);
    // ...but ask about an allergen that many of those products DO contain (wheat): the real check must object.
    for (const href of hrefs) expect(await productAllergens(page, href)).not.toContain('wheat');
  });

  test('a wrong category count in the filter dialog WOULD be caught', async ({ page }) => {
    test.fail();
    await openMenu(page);
    const dlg = await openFilters(page);
    await dlg.evaluate((d) => { d.innerHTML = d.innerHTML.replace(/Breakfast \(\d+\)/i, 'Breakfast (1)'); });
    const shown = Number((await dlg.innerText()).match(/Breakfast\s*\((\d+)\)/i)![1]);
    const other = await page.context().newPage();
    await other.goto('/menu?category=breakfast', { waitUntil: 'domcontentloaded' });
    await expect(other.locator(PRODUCT_LINK).first()).toBeVisible();
    expect(await other.locator(PRODUCT_LINK).count()).toBe(shown);
  });

  test('search that ignores the term WOULD be caught', async ({ page }) => {
    test.fail();
    await openMenu(page);
    await searchBox(page).fill('sausage');
    // pretend the site matched on something else: demand every result contains "bacon"
    await expect.poll(async () => (await productLinks(page)).length).toBeGreaterThan(0);
    for (const r of await productLinks(page)) expect(r.text.toLowerCase()).toContain('bacon');
  });

  test('a page that is too slow WOULD be caught by the performance budget', async ({ page }) => {
    test.fail();
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 1500, downloadThroughput: 50_000, uploadThroughput: 50_000 });
    const t0 = Date.now();
    // give up waiting after 15s, then judge the elapsed time against the same 5s budget the real test uses
    await page.goto('/menu', { waitUntil: 'domcontentloaded', timeout: 15_000 }).catch(() => {});
    expect(Date.now() - t0, 'load time with throttled network').toBeLessThan(5_000);
  });
});
