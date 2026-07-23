import { expect, test } from '@playwright/test';

const directSources = [
  'https://openai.com/index/introducing-openai-presence/',
  'https://github.com/anthropics/anthropic-sdk-python/releases/tag/v0.118.0',
];

test('Edition is finite, source-first, labeled, and explicitly non-production', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/news/2026-07-23/');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('検証用 AOIFUTURE News');
  await expect(page.locator('.news-sample-label--hero')).toHaveText('NON-PRODUCTION SAMPLE');
  await expect(page.locator('[data-news-signal]')).toHaveCount(2);
  await expect(page.getByText('Source fact', { exact: true })).toHaveCount(2);
  await expect(page.getByText('AOI note', { exact: true })).toHaveCount(2);
  await expect(page.getByText('Caveat', { exact: true })).toHaveCount(2);
  for (const href of directSources) {
    await expect(page.locator(`a[href="${href}"]`).first()).toBeVisible();
  }
  expect(errors).toEqual([]);
});

test('Active Context renders current view before preserved chronology and links evidence', async ({ page }) => {
  await page.goto('/news/context/agent-authority/');
  const current = page.locator('#current-view');
  const history = page.locator('#context-history');
  await expect(current).toBeVisible();
  await expect(page.getByRole('heading', { name: 'How we got here' })).toBeVisible();
  expect(await current.evaluate((node) => node.compareDocumentPosition(document.querySelector('#context-history')!) & Node.DOCUMENT_POSITION_FOLLOWING)).toBeTruthy();
  await expect(history.locator('article')).toHaveCount(2);
  await expect(history.locator('a[href="/news/2026-07-23/#sig-openai-presence-20260722"]')).toBeVisible();
  await expect(history.locator('a[href="/news/2026-07-23/#sig-anthropic-sdk-20260722"]')).toBeVisible();
});

test('archive exposes bounded Edition, Context, topic, and source entry points', async ({ page }) => {
  await page.goto('/news/archive/');
  await expect(page.getByText('SAMPLE INDEX — NOT A COMPLETE ARCHIVE', { exact: true })).toBeVisible();
  for (const label of ['By Edition', 'By Context', 'By topic', 'By source']) {
    await expect(page.getByRole('heading', { name: label })).toBeVisible();
  }
});

test('News remains readable with JavaScript disabled', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/news/');
  await expect(page.locator('[data-news-signal]')).toHaveCount(2);
  await expect(page.locator(`a[href="${directSources[0]}"]`)).toBeVisible();
  await context.close();
});

for (const route of ['/news/', '/news/2026-07-23/', '/news/context/agent-authority/', '/news/archive/']) {
  test(`${route} has no horizontal overflow at mobile and desktop widths`, async ({ page }) => {
    for (const width of [320, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(route);
      const dimensions = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        offenders: Array.from(document.querySelectorAll('*'))
          .filter((element) => element.getBoundingClientRect().right > document.documentElement.clientWidth + 1)
          .slice(0, 5)
          .map((element) => ({ tag: element.tagName, className: element.className })),
      }));
      expect(dimensions.offenders, JSON.stringify({ route, width, dimensions })).toEqual([]);
      expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
    }
  });
}

test('skip link and primary controls are keyboard reachable with visible focus', async ({ page }) => {
  await page.goto('/news/');
  await page.keyboard.press('Tab');
  await expect(page.locator('.news-skip-link')).toBeFocused();
  await expect(page.locator('.news-skip-link')).toHaveCSS('outline-style', 'solid');
  await page.keyboard.press('Enter');
  await expect(page.locator('#news-main')).toBeFocused();
  const targets = await page.locator('a.news-source-link, .news-nav a').evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height));
  expect(targets.every((height) => height >= 44)).toBe(true);
});

test('unknown News date and Context routes are 404 and Navigator has a direct NEWS entry', async ({ page, request }) => {
  expect((await request.get('/news/2099-01-01/')).status()).toBe(404);
  expect((await request.get('/news/context/missing-context/')).status()).toBe(404);
  await page.goto('/');
  await expect(page.getByRole('link', { name: /NEWS/ })).toHaveAttribute('href', '/news/');
  await page.goto('/#nictia');
  await expect(page).toHaveURL(/#nictia$/);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
