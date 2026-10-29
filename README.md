# Greggs.com Menu: Automated Test Suite

End-to-end tests for the **Menu** section of [greggs.com/menu](https://www.greggs.com/menu), built with [Playwright](https://playwright.dev) and TypeScript.

**Latest run (29 Oct 2026): 62 tests × 3 screen sizes = 186 executions → 169 passed, 17 skipped on purpose, 0 failed.**
Two mobile tests passed on their first retry because the product list was slow to load on that attempt (see [limitations](#assumptions-and-limitations)). The run log, JUnit XML and JSON results are in [`reports/`](reports). The HTML report is large, so it is generated locally with `npm run report` after a run.

## How this was built

I used Claude Code, an AI coding assistant, to help build this suite. It wrote most of the code and ran the tests, and I directed the work, reviewed the results and findings, and decided what to cover. I can walk through any test and explain what it checks and why.

## Test strategy in brief

1. **Start with what a customer does**: browse categories, search, filter by allergen or calories, open a product. These are the highest-value paths, so they get the most tests.
2. **Check the data, not only the screen.** A filter that looks right can still be wrong, so some tests open product pages and verify the allergen and calorie claims.
3. **Cover three screen sizes** with the same code, because the menu changes layout (burger menu, fewer buttons on phones).
4. **Add accessibility and performance checks** as quick signals. They do not replace a manual review or a proper performance tool.
5. **Prove the tests can fail** with negative controls, so a green result means something.

## What I tested

| Area | File | What it checks |
|---|---|---|
| Categories and navigation | `menu-navigation.spec.ts` | Landing page shows all 6 categories; each category tab filters the list and updates the URL; deep links like `?category=sweet-treats` work; "ALL" restores everything; clicking a product opens its page and Back returns; unknown product URL gives a real 404 |
| Header navigation | `menu-header-nav.spec.ts` | "Menu & allergens" links (desktop dropdown *and* the tablet/mobile burger drawer) list every category, View all products and Allergens & Nutrition; choosing a category works; `/nutrition` loads; logo returns home |
| Search (dynamic content) | `menu-search.spec.ts` | Results narrow as you type and all contain the term; case-insensitive; friendly empty state; clearing search restores the menu |
| **Filters** (calories and allergens) | `menu-filters.spec.ts` | Dialog shows calories slider, all 11 allergens and categories; closes via Back (larger screens), X and Esc; an allergen filter reduces the list, shows a chip, and removing it restores everything; filter state is remembered and "Clear all" resets it; combining filters never *adds* products |
| Data correctness and consistency | `menu-filters.spec.ts`, `menu-data.spec.ts` | **With "No Wheat" / "No Eggs" applied, sampled product pages really do not list that allergen. With the calorie slider at 100, sampled products are ≤ 100 kcal.** Category counts in the filter dialog match the real category pages and add up to the total; every link has a name, slug and id; no duplicates per category; every image has alt text; card names match product page headings; the first product of every category has a complete page (image, nutrition table, allergens line) |
| UI and responsiveness | `menu-ui.spec.ts` | Search, filter and tabs render; no horizontal scroll; images really load; grid columns adapt to screen width; cookie banner can be rejected and stays dismissed |
| Accessibility | `menu-accessibility.spec.ts` | axe-core WCAG 2.0/2.1 A and AA scans of the menu page, a product page and the open filter dialog; heading structure; keyboard access to search, tabs and filter options; accessible name on search |
| Performance | `menu-performance.spec.ts` | DOMContentLoaded and Largest Contentful Paint within budget; Cumulative Layout Shift within budget; no failing same-site requests; category filtering is quick |
| **Negative controls** | `negative-controls.spec.ts` | "Tests for the tests": deliberately sabotages the page (removes alt text, blocks images, fakes a 200 for a bad URL, shows a wrong count, throttles the network, etc.) and checks the real assertions catch it. See below |

Screen sizes: **desktop** (Chrome), **mobile** (Pixel 7 emulation) and **tablet** (820×1180). 17 executions are skipped on purpose: keyboard tests on touch layouts, and the negative controls outside desktop.

## Observations and recommendations

While testing I noticed some things the Greggs team may want to look at. None of them is a security issue. The first two groups have tests marked as **known issues** (`test.fail`): the suite stays green while the issue is recorded, and the test will report "unexpectedly passed" once it is fixed so the marker can be removed.

| # | Impact | Observation | Where it shows up |
|---|---|---|---|
| 1 | Accessibility, critical (axe `button-name`) | The filter dialog's close "X" button has no accessible name, so a screen reader cannot say what it does | `axe scan of the open filter dialog` (known issue) |
| 2 | Accessibility, critical (axe `label`) | The calories slider has no label | same test |
| 3 | Accessibility, serious (axe `color-contrast`) | Some text does not meet the contrast ratio: 8 elements in the filter dialog and 1 on the menu page | attached to the HTML report as `axe-*.json` |
| 4 | Performance | Layout shift (CLS) is about 0.39 at tablet width, compared with about 0.02 on desktop and 0.14 on a phone. Google rates anything above 0.25 as "poor". | `layout shift (CLS) is within budget` on tablet (known issue) |
| 5 | Minor | The page's own script logs `Auth handleRedirect failed: No response found` about every 3 seconds | seen in run logs, not asserted |
| 6 | Minor | `/menu?category=does-not-exist` returns HTTP 200 rather than 404 (an unknown *product* URL does return 404) | noted, not asserted |
| 7 | Minor | `/nutrition` has five `h1` headings on one page | noted, not asserted |

The axe findings, with the exact elements, are attached to the HTML report after a run.

## Why I chose this approach

- **Playwright**: auto-waits (less flakiness on a dynamic, lazy-loaded page), built-in device emulation, traces and screenshots on failure, and clean axe integration. Selectors use roles and accessible names (`getByRole`) so they also exercise accessibility.
- **Three screen sizes with the same test code** cover responsiveness. Where the layout genuinely differs (burger menu, no "Back" button on phones) the tests handle both.
- **Check the data, not just the screen.** A filter that "looks like it works" is not enough, so the tests open product pages and verify the allergen and calorie claims.
- **Negative controls** prove the checks can fail. A test that cannot fail proves nothing. Each control passes only if its sabotaged assertion fails, and I checked that each fails for the *intended* reason (for example, status 200 where 404 is expected, or a count of 19 versus the sabotaged 1).
- **Live site, read-only**: tests only browse. They never log in, order or submit anything.
- **Soft assertions for data checks**, so one bad item doesn't hide others.

## How to run

Requires Node.js 18+.

```bash
npm install
npx playwright install chromium

npm test                # desktop + mobile + tablet (about 15-20 minutes)
npm run test:desktop
npm run test:mobile
npx playwright test --project=tablet
npm run report          # open the HTML report
```

A manual GitHub Actions workflow (`.github/workflows/playwright.yml`) can run the suite from the repository's Actions tab and upload the report. It is manual on purpose, because the tests drive the live site. Results from GitHub's servers may differ slightly from a laptop (different region and speed).

Outputs go to `reports/`: `junit.xml`, `results.json` and `test-run.log` are committed; `html/` (traces and screenshots, about 30 MB) is git-ignored and regenerated on each run. Failure screenshots and traces go to `reports/artifacts/` (git-ignored). Don't run two test commands at the same time: they share that folder.

## Assumptions and limitations

- **Production site**: product names, counts and menus change. Tests assert *behaviour and structure* (for example "results contain the search term"), not fixed menu contents. A few use stable examples (Sausage Roll, "sausage").
- **Intermittent slow loads**: twice in the final run the product list was still on its "Baking…" spinner after 10 seconds (mobile). Both tests passed on retry. The config uses 2 retries and 1 worker, 15 s action timeouts, and runs one browser at a time to be kind to a production site.
- **Sampling**: allergen and calorie correctness is verified on a sample of products (4 per allergen, 3 for calories), and only for Wheat, Eggs, Milk (counts) and a 100 kcal limit. Checking all 143 products × 11 allergens would be slow against a live site; this would be a good next step with a test environment or the site's API.
- **Performance budgets are generous** (DOMContentLoaded under 5 s, LCP under 4 s, CLS under 0.25) because timings vary with network and machine. This is a smoke check, not a benchmark. Use Lighthouse or WebPageTest for real performance work.
- **Accessibility**: automated tools catch only about a third of WCAG issues. A manual screen-reader and keyboard review is still needed.
- **Browsers**: Chromium only. Tablet and mobile are emulated, not real devices. Firefox and Safari/WebKit are not covered.
- **Cookie banner**: tests click "Reject all" first. The consent flow itself is only lightly tested.
- **Region and language**: `en-GB` locale; availability by location and logged-in behaviour are not tested.
- **Not covered**: ordering and basket flows, Find a Shop, account sign-in, gift cards, and the Pound/price display (none is shown on the menu).

## Project layout

```
playwright.config.ts        projects (desktop, mobile, tablet), timeouts, reporters
.github/workflows/          manual CI run
tests/
  support/menu.ts           shared helpers (open menu, cookie banner, filters, selectors)
  menu-*.spec.ts            the test suites above
  negative-controls.spec.ts tests for the tests
reports/                    JUnit XML, JSON results and run log (HTML report is generated locally)
```
