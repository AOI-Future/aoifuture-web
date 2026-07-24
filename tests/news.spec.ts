import { expect, test } from '@playwright/test';

const directSources = [
  'https://openai.com/index/introducing-openai-presence/',
  'https://github.com/anthropics/anthropic-sdk-python/releases/tag/v0.118.0',
];

const newsRoutes = [
  '/news/',
  '/news/2026-07-23/',
  '/news/context/agent-authority/',
  '/news/archive/',
];

test('News canonicals are singular HTTPS no-www URLs with trailing slashes', async ({ page }) => {
  for (const route of newsRoutes) {
    await page.goto(route);
    const canonicals = page.locator('link[rel="canonical"]');
    await expect(canonicals).toHaveCount(1);
    const href = await canonicals.getAttribute('href');
    expect(href).toBe(`https://aoifuture.com${route}`);
    expect(new URL(href!).protocol).toBe('https:');
    expect(new URL(href!).hostname).toBe('aoifuture.com');
    expect(new URL(href!).pathname.endsWith('/')).toBe(true);
  }
});

test('News exposes M2 JSON-LD, summary metadata, and Rolling Edition feed discovery', async ({ page }) => {
  for (const route of newsRoutes) {
    await page.goto(route);
    await expect(page.locator('link[rel="alternate"][type="application/rss+xml"]')).toHaveAttribute('href', '/news/feed.xml');
    await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
    await expect(page.locator('meta[property="og:description"]')).toHaveCount(1);
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', `https://aoifuture.com${route}`);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary');
    await expect(page.locator('meta[property="og:image"], meta[name="twitter:image"]')).toHaveCount(0);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  }

  await page.goto('/news/2026-07-23/');
  const editionMetadata = await page.locator('script[type="application/ld+json"]').evaluate((node) => JSON.parse(node.textContent ?? ''));
  expect(editionMetadata['@type']).toBe('CollectionPage');
  expect(editionMetadata.dateModified).toBe('2026-07-23T09:05:00+09:00');
  expect(editionMetadata.mainEntity['@type']).toBe('ItemList');
  expect(editionMetadata.mainEntity.itemListElement.map((entry: { url: string }) => entry.url)).toEqual([
    'https://aoifuture.com/news/2026-07-23/#sig-openai-presence-20260722',
    'https://aoifuture.com/news/2026-07-23/#sig-anthropic-sdk-20260722',
  ]);
  expect(JSON.stringify(editionMetadata)).not.toContain('NewsArticle');

  await page.goto('/news/context/agent-authority/');
  const contextMetadata = await page.locator('script[type="application/ld+json"]').evaluate((node) => JSON.parse(node.textContent ?? ''));
  expect(contextMetadata['@type']).toBe('WebPage');
  expect(contextMetadata.dateModified).toBe('2026-07-23T09:00:00+09:00');
  expect(contextMetadata.citation).toHaveLength(2);
});

test('Rolling Edition RSS is valid reviewed-event XML with the correct content type', async ({ page, request }) => {
  const response = await request.get('/news/feed.xml');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toMatch(/^application\/rss\+xml;\s*charset=utf-8/i);
  const xml = await response.text();
  const parseError = await page.evaluate((source) => {
    const document = new DOMParser().parseFromString(source, 'application/xml');
    return document.querySelector('parsererror')?.textContent ?? null;
  }, xml);
  expect(parseError).toBeNull();
  expect(xml).toContain('<rss version="2.0"');
  expect(xml).toContain('AOIFUTURE News Rolling Edition RSS — NON-PRODUCTION SAMPLE');
  expect((xml.match(/<item>/g) ?? [])).toHaveLength(2);
  expect(xml.indexOf('aoi-news-2026-07-23-r002')).toBeLessThan(xml.indexOf('aoi-news-2026-07-23-r001'));
  expect(xml).not.toContain('reviewed_by');
  expect(xml).not.toContain('source_fact');
});

test('News loads self-hosted fonts only and retains readable fallbacks', async ({ page }) => {
  const fontRequests: string[] = [];
  const externalFontRequests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (request.resourceType() === 'font') fontRequests.push(url.href);
    if (/fonts\.(?:googleapis|gstatic)\.com/.test(url.hostname)) externalFontRequests.push(url.href);
  });

  await page.goto('/news/');
  await page.evaluate(() => document.fonts.ready);

  expect(externalFontRequests).toEqual([]);
  expect(fontRequests.length).toBeGreaterThan(0);
  expect(fontRequests.every((url) => new URL(url).origin === 'http://127.0.0.1:4331')).toBe(true);
  expect(await page.locator('.news-body').evaluate((node) => getComputedStyle(node).fontFamily)).toContain('Noto Sans JP');
  expect(await page.locator('.news-nav').evaluate((node) => getComputedStyle(node).fontFamily)).toContain('JetBrains Mono');

  await page.addStyleTag({
    content: '.news-body { --news-body: system-ui, sans-serif; --news-mono: ui-monospace, monospace; }',
  });
  const dimensions = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
});

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
    const sourceLink = page.locator(`a[href="${href}"]`).first();
    await expect(sourceLink).toBeVisible();
    await expect(sourceLink).not.toHaveAttribute('target', '_blank');
  }

  for (const signal of await page.locator('[data-news-signal]').all()) {
    expect(await signal.locator(':scope > [data-news-order]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-news-order')))).toEqual([
      'source',
      'headline',
      'fact',
      'note',
      'metadata',
      'action',
    ]);
  }

  const times = page.locator('time');
  await expect(times).toHaveCount(6);
  for (const time of await times.all()) {
    await expect(time).toHaveAttribute('datetime', /^(?:\d{4}-\d{2}-\d{2}|\d{4}-\d{2}-\d{2}T)/);
    await expect(time).toContainText('JST');
  }
  await expect(page.locator('.news-source-link__title').first()).toHaveAttribute('lang', 'en');
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
  await expect(page.locator('time')).toHaveCount(3);
  for (const time of await page.locator('time').all()) {
    await expect(time).toHaveAttribute('datetime', /T/);
    await expect(time).toContainText('JST');
  }
  await expect(history.locator('a[href="/news/2026-07-23/#sig-openai-presence-20260722"]')).toBeVisible();
  await expect(history.locator('a[href="/news/2026-07-23/#sig-anthropic-sdk-20260722"]')).toBeVisible();
});

test('archive exposes bounded Edition, Context, topic, and source entry points', async ({ page }) => {
  await page.goto('/news/archive/');
  await expect(page.getByText('SAMPLE INDEX — NOT A COMPLETE ARCHIVE', { exact: true })).toBeVisible();
  for (const label of ['By Edition', 'By Context', 'By topic', 'By source']) {
    await expect(page.getByRole('heading', { name: label })).toBeVisible();
  }
  await expect(page.locator('section[aria-labelledby="archive-editions"] time')).toHaveAttribute('datetime', '2026-07-23');
  await expect(page.locator('section[aria-labelledby="archive-editions"] time')).toContainText('JST');
  const retainedSignals = [
    '/news/2026-07-23/#sig-openai-presence-20260722',
    '/news/2026-07-23/#sig-anthropic-sdk-20260722',
  ];
  for (const href of retainedSignals) {
    await expect(page.locator(`#archive-topics-list a[href="${href}"]`)).toHaveCount(1);
    await expect(page.locator(`#archive-sources-list a[href="${href}"]`)).toHaveCount(1);
  }
  expect(await page.locator('#archive-sources-list a').evaluateAll((links) => links.every((link) => !link.hasAttribute('target')))).toBe(true);
  await expect(page.locator('#archive-sources-list a[href^="http"]')).toHaveCount(0);
});

test('visible Signal topic navigation reaches its grouped retained retrospective', async ({ page }) => {
  await page.goto('/news/2026-07-23/');
  const topicLinks = page.locator('[data-news-signal] a[href="/news/archive/#topic-agent-operations"]');
  await expect(topicLinks).toHaveCount(2);

  await topicLinks.first().click();
  await expect(page).toHaveURL(/\/news\/archive\/#topic-agent-operations$/);

  const topicTarget = page.locator('#topic-agent-operations');
  await expect(topicTarget).toBeVisible();
  await expect(topicTarget).toHaveText('エージェント運用');
  const topicGroup = topicTarget.locator('xpath=..');
  for (const href of [
    '/news/2026-07-23/#sig-openai-presence-20260722',
    '/news/2026-07-23/#sig-anthropic-sdk-20260722',
  ]) {
    await expect(topicGroup.locator(`a[href="${href}"]`)).toHaveCount(1);
  }
  await expect(topicGroup.locator('time[datetime="2026-07-23"]')).toHaveCount(2);
});

test('News remains readable with JavaScript disabled', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/news/');
  await expect(page.locator('[data-news-signal]')).toHaveCount(2);
  await expect(page.locator(`a[href="${directSources[0]}"]`)).toBeVisible();
  await context.close();
});

for (const route of newsRoutes) {
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
