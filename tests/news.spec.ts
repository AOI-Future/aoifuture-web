import { expect, test } from '@playwright/test';

const directSources = [
  'https://openai.com/index/health-in-chatgpt/',
  'https://claude.com/blog/think-through-hard-problems-in-voice-mode',
  'https://github.com/langfuse/langfuse/releases/tag/v4.0.0-rc.0',
  'https://github.com/anthropics/anthropic-sdk-python/releases/tag/v0.119.0',
  'https://cloud.google.com/blog/topics/customers/bringing-delight-to-customer-phone-calls-with-ai/',
  'https://github.com/advisories/GHSA-8fpg-xm3f-6cx3',
];
const production = process.env.VERCEL_ENV === 'production';
const firstPreviousId = production ? '2026-07-23-0430' : '2026-07-23-0900';
const firstPreviousRoute = `/news/${firstPreviousId}/`;
const secondPreviousId = production ? '2026-07-22-0430' : '2026-07-23-0430';

const newsRoutes = [
  '/news/',
  '/news/2026-07-24/',
  '/news/2026-07-23-0430/',
  '/news/2026-07-22-0430/',
  '/news/2026-07-21-0341/',
  '/news/context/connected-ai-boundaries/',
  '/news/context/ai-delivery-evidence/',
  '/news/context/delegated-work-control/',
  '/news/context/operational-ai-authority/',
  '/news/archive/',
  '/news/editorial-policy/',
  ...(!production ? ['/news/2026-07-23-0900/', '/news/context/agent-authority/'] : []),
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
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', production ? 'index, follow' : 'noindex, nofollow');
  }

  await page.goto('/news/2026-07-24/');
  const editionMetadata = await page.locator('script[type="application/ld+json"]').evaluate((node) => JSON.parse(node.textContent ?? ''));
  expect(editionMetadata['@type']).toBe('CollectionPage');
  expect(editionMetadata.dateModified).toBe('2026-07-24T15:01:05+09:00');
  expect(editionMetadata.mainEntity['@type']).toBe('ItemList');
  expect(editionMetadata.mainEntity.numberOfItems).toBe(6);
  expect(editionMetadata.mainEntity.itemListElement.map((entry: { url: string }) => entry.url)).toEqual([
    'https://aoifuture.com/news/2026-07-24/#edition-2026-07-24-sig-openai-health-20260724',
    'https://aoifuture.com/news/2026-07-24/#edition-2026-07-24-sig-claude-voice-tools-20260724',
    'https://aoifuture.com/news/2026-07-24/#edition-2026-07-24-sig-langfuse-v4-rc0-20260724',
    'https://aoifuture.com/news/2026-07-24/#edition-2026-07-24-sig-anthropic-sdk-0119-20260724',
    'https://aoifuture.com/news/2026-07-24/#edition-2026-07-24-sig-google-voicify-story-20260724',
    'https://aoifuture.com/news/2026-07-24/#edition-2026-07-24-sig-authjs-fail-open-20260724',
  ]);
  expect(JSON.stringify(editionMetadata)).not.toContain('NewsArticle');

  await page.goto('/news/context/connected-ai-boundaries/');
  const contextMetadata = await page.locator('script[type="application/ld+json"]').evaluate((node) => JSON.parse(node.textContent ?? ''));
  expect(contextMetadata['@type']).toBe('WebPage');
  expect(contextMetadata.dateModified).toBe('2026-07-24T15:01:05+09:00');
  expect(contextMetadata.citation).toHaveLength(6);
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
  expect(xml).toContain(production ? '<title>AOIFUTURE News Rolling Edition RSS</title>' : 'AOIFUTURE News Rolling Edition RSS — EDITORIAL REVIEW PREVIEW');
  expect((xml.match(/<item>/g) ?? [])).toHaveLength(production ? 4 : 6);
  expect(xml.indexOf('aoi-news-2026-07-21-0341-r001')).toBeLessThan(xml.indexOf('aoi-news-2026-07-24-r001'));
  expect(xml).toContain('<guid isPermaLink="false">aoi-news-2026-07-24-r001</guid>');
  if (!production) expect(xml.indexOf('aoi-news-2026-07-23-0900-r002')).toBeLessThan(xml.indexOf('aoi-news-2026-07-23-0900-r001'));
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

test('reviewed Preview Edition is finite, source-first, labeled, and explicitly outside production', async ({ page }) => {
  test.skip(production, 'review-only presentation');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/news/2026-07-24/');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('接続するAI、運用境界を先に決める');
  await expect(page.locator('.news-sample-label--hero')).toHaveText('EDITORIAL REVIEW PREVIEW');
  await expect(page.locator('.news-site-footer')).toContainText('No production publication or deployment authorized.');
  await expect(page.locator('[data-news-signal]')).toHaveCount(6);
  await expect(page.getByText('Source fact', { exact: true })).toHaveCount(6);
  await expect(page.getByText('AOI note', { exact: true })).toHaveCount(6);
  await expect(page.getByText('Caveat', { exact: true })).toHaveCount(6);
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
      'selection',
      'caveat',
      'note',
      'metadata',
      'action',
    ]);
  }

  const times = page.locator('time');
  await expect(times).toHaveCount(13);
  for (const time of await times.all()) {
    await expect(time).toHaveAttribute('datetime', /^(?:\d{4}-\d{2}-\d{2}|\d{4}-\d{2}-\d{2}T)/);
    await expect(time).toContainText('JST');
  }
  await expect(page.locator('.news-source-link__title').first()).toHaveAttribute('lang', 'en');
  expect(errors).toEqual([]);
});

test('Active Context renders current view before preserved chronology and links evidence', async ({ page }) => {
  test.skip(production, 'review-only Context');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/news/context/agent-authority/');
  const current = page.locator('#current-view');
  const history = page.locator('#context-history');
  await expect(current).toBeVisible();
  await expect(page.getByRole('heading', { name: 'How we got here' })).toBeVisible();
  expect(await current.evaluate((node) => node.compareDocumentPosition(document.querySelector('#context-history')!) & Node.DOCUMENT_POSITION_FOLLOWING)).toBeTruthy();
  await expect(history.locator('article')).toHaveCount(2);
  await expect(history.locator(':scope > .news-section-heading')).toHaveCSS('margin-bottom', '42px');
  await expect(page.locator('time')).toHaveCount(3);
  for (const time of await page.locator('time').all()) {
    await expect(time).toHaveAttribute('datetime', /T/);
    await expect(time).toContainText('JST');
  }
  await expect(history.locator('a[href="/news/2026-07-23-0900/#edition-2026-07-23-0900-sig-openai-presence-20260722"]')).toBeVisible();
  await expect(history.locator('a[href="/news/2026-07-23-0900/#edition-2026-07-23-0900-sig-anthropic-sdk-20260722"]')).toBeVisible();
});

test('reviewed Connected AI Context links all six supporting Signals to the new Edition', async ({ page }) => {
  await page.goto('/news/context/connected-ai-boundaries/');
  await expect(page.locator('.news-sample-label--hero')).toHaveCount(production ? 0 : 1);
  await expect(page.locator('#context-history article')).toHaveCount(1);
  for (const signalId of [
    'sig-openai-health-20260724',
    'sig-claude-voice-tools-20260724',
    'sig-langfuse-v4-rc0-20260724',
    'sig-anthropic-sdk-0119-20260724',
    'sig-google-voicify-story-20260724',
    'sig-authjs-fail-open-20260724',
  ]) {
    await expect(page.locator(`#context-history a[href="/news/2026-07-24/#edition-2026-07-24-${signalId}"]`)).toBeVisible();
  }
});

test('archive exposes bounded Edition, Context, topic, and source entry points', async ({ page }) => {
  await page.goto('/news/archive/');
  if (production) await expect(page.getByRole('heading', { name: 'AOIFUTURE News index' })).toBeVisible();
  else await expect(page.getByText('EDITORIAL REVIEW INDEX — NOT PRODUCTION OR A COMPLETE ARCHIVE', { exact: true })).toBeVisible();
  for (const label of ['By Edition', 'By Context', 'By topic', 'By source']) {
    await expect(page.getByRole('heading', { name: label })).toBeVisible();
  }
  const editionTimes = page.locator('section[aria-labelledby="archive-editions"] time');
  await expect(editionTimes).toHaveCount(production ? 4 : 5);
  await expect(editionTimes.first()).toHaveAttribute('datetime', '2026-07-24');
  await expect(editionTimes.first()).toContainText('JST');
  const retainedSignals = [
    '/news/2026-07-23-0900/#edition-2026-07-23-0900-sig-openai-presence-20260722',
    '/news/2026-07-23-0900/#edition-2026-07-23-0900-sig-anthropic-sdk-20260722',
  ];
  for (const href of production ? [] : retainedSignals) {
    await expect(page.locator(`#archive-topics-list a[href="${href}"]`)).toHaveCount(1);
    await expect(page.locator(`#archive-sources-list a[href="${href}"]`)).toHaveCount(1);
  }
  expect(await page.locator('#archive-sources-list a').evaluateAll((links) => links.every((link) => !link.hasAttribute('target')))).toBe(true);
  await expect(page.locator('#archive-sources-list a[href^="http"]')).toHaveCount(0);
});

test('visible Signal topic navigation reaches its grouped retained retrospective', async ({ page }) => {
  test.skip(production, 'review-only Edition');
  await page.goto('/news/2026-07-23-0900/');
  const topicLinks = page.locator('[data-news-signal] a[href="/news/archive/#topic-agent-operations"]');
  await expect(topicLinks).toHaveCount(2);

  await topicLinks.first().click();
  await expect(page).toHaveURL(/\/news\/archive\/#topic-agent-operations$/);

  const topicTarget = page.locator('#topic-agent-operations');
  await expect(topicTarget).toBeVisible();
  await expect(topicTarget).toHaveText('エージェント運用');
  const topicGroup = topicTarget.locator('xpath=..');
  for (const href of [
    '/news/2026-07-23-0900/#edition-2026-07-23-0900-sig-openai-presence-20260722',
    '/news/2026-07-23-0900/#edition-2026-07-23-0900-sig-anthropic-sdk-20260722',
  ]) {
    await expect(topicGroup.locator(`a[href="${href}"]`)).toHaveCount(1);
  }
  await expect(topicGroup.locator('time[datetime="2026-07-23"]')).toHaveCount(2);
});

test('News remains readable with JavaScript disabled', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/news/');
  await expect(page.locator('[data-news-signal]')).toHaveCount(6);
  await expect(page.locator(`a[href="${directSources[0]}"]`)).toBeVisible();
  const historyLink = page.locator('[data-news-history-loader] a');
  await expect(historyLink).toHaveAttribute('href', firstPreviousRoute);
  await context.close();
});

test('previous Edition appends one exact server Edition with unique IDs, focus, and through history', async ({ page }) => {
  await page.goto('/news/');
  const loader = page.locator('[data-news-history-loader]');
  await expect(page.locator('[data-news-edition]')).toHaveCount(1);
  await loader.getByRole('link', { name: '前のEditionを読む' }).click();
  await expect(page.locator('[data-news-edition]')).toHaveCount(2);
  await expect(page).toHaveURL(new RegExp(`\\?through=${firstPreviousId}$`));
  const appendedHeading = page.locator(`[data-news-edition="${firstPreviousId}"] h2[data-news-edition-heading]`);
  await expect(appendedHeading).toBeFocused();
  await expect(loader.locator('[data-news-history-status]')).toContainText('追加しました');
  const ids = await page.locator('[id]').evaluateAll((nodes) => nodes.map((node) => node.id));
  expect(new Set(ids).size).toBe(ids.length);

  await page.goBack();
  await expect(page.locator('[data-news-edition]')).toHaveCount(1);
  await page.goForward();
  await expect(page.locator('[data-news-edition]')).toHaveCount(2);
  await page.reload();
  await expect(page.locator('[data-news-edition]')).toHaveCount(2);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://aoifuture.com/news/');
});

test('rolling history controls and appended Edition boundaries remain visible across required viewports', async ({ page }) => {
  for (const width of [390, 768, 1024, 1280, 1440, 1728]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/news/');

    const historyLink = page.locator('[data-news-history-loader] a');
    await expect(historyLink).toHaveCSS('border-top-width', '1px');
    await expect(historyLink).toHaveCSS('border-top-style', 'solid');
    await expect(historyLink).toHaveCSS('border-top-color', 'rgb(43, 74, 74)');

    await historyLink.click();
    const appendedEdition = page.locator(`[data-news-history] > [data-news-edition="${firstPreviousId}"]`);
    await expect(appendedEdition).toHaveCSS('border-top-width', '1px');
    await expect(appendedEdition).toHaveCSS('border-top-style', 'solid');
    await expect(appendedEdition).toHaveCSS('border-top-color', 'rgb(43, 74, 74)');
  }
});

test('previous Edition fetch failure appends nothing and keeps the fallback link', async ({ page }) => {
  await page.route(`**${firstPreviousRoute}`, (route) => route.fulfill({ status: 503, contentType: 'text/html', body: 'unavailable' }));
  await page.goto('/news/');
  const link = page.locator('[data-news-history-link]');
  await link.click();
  await expect(page.locator('[data-news-edition]')).toHaveCount(1);
  await expect(page.locator('[data-news-history-status]')).toContainText('読み込めませんでした');
  await expect(link).toHaveAttribute('href', firstPreviousRoute);
  await expect(link).not.toHaveAttribute('aria-disabled', 'true');
});

test('rapid double-click activation stays in rolling history and issues one request', async ({ page }) => {
  let requests = 0;
  await page.route(`**${firstPreviousRoute}`, async (route) => {
    requests += 1;
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.continue();
  });
  await page.goto('/news/');

  await page.locator('[data-news-history-link]').evaluate((link) => {
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
    link.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 2 }));
  });

  await expect(page).toHaveURL(new RegExp(`^http://127\\.0\\.0\\.1:\\d+/news/\\?through=${firstPreviousId}$`));
  await expect(page.locator('[data-news-edition]')).toHaveCount(2);
  expect(requests).toBe(1);
});

test('rapid keyboard activation stays in rolling history and issues one request', async ({ page }) => {
  let requests = 0;
  await page.route(`**${firstPreviousRoute}`, async (route) => {
    requests += 1;
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.continue();
  });
  await page.goto('/news/');
  await page.locator('[data-news-history-link]').focus();

  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL(new RegExp(`^http://127\\.0\\.0\\.1:\\d+/news/\\?through=${firstPreviousId}$`));
  await expect(page.locator('[data-news-edition]')).toHaveCount(2);
  expect(requests).toBe(1);
});

test('activation during history reconciliation is handled without native navigation', async ({ page }) => {
  let firstEditionRequests = 0;
  await page.route(`**${firstPreviousRoute}`, async (route) => {
    firstEditionRequests += 1;
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.continue();
  });
  await page.goto(`/news/?through=${secondPreviousId}`, { waitUntil: 'domcontentloaded' });
  await expect.poll(() => firstEditionRequests).toBe(1);

  await page.locator('[data-news-history-link]').dispatchEvent('click');

  await expect(page).toHaveURL(new RegExp(`/news/\\?through=${secondPreviousId}$`));
  await expect(page.locator('[data-news-edition]')).toHaveCount(3);
  expect(firstEditionRequests).toBe(1);
});

test('editorial policy is discoverable and states the selection boundaries', async ({ page }) => {
  await page.goto('/news/editorial-policy/');
  for (const heading of ['選ぶもの', '選ばないもの', '出典の優先順位', '不確実性と訂正', 'スポンサーと利害関係']) {
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
  }
  await expect(page.locator('main')).toContainText('人気');
  await expect(page.locator('main')).toContainText('掲載料');
  await page.goto('/news/');
  await expect(page.locator('.news-nav a[href="/news/editorial-policy/"]')).toBeVisible();
  await expect(page.locator('[data-news-signal] .news-policy-link')).toHaveCount(6);
});

test('Signal cards have defined boundaries, semantic regions, and source-first order', async ({ page }) => {
  for (const width of [390, 768, 1024, 1280, 1440, 1728]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/news/');
    const metrics = await page.locator('[data-news-signal]').first().evaluate((node) => {
      const style = getComputedStyle(node);
      return {
        background: style.backgroundColor,
        borderWidth: style.borderTopWidth,
        borderStyle: style.borderTopStyle,
        borderColor: style.borderTopColor,
        paddingInline: Number.parseFloat(style.paddingInlineStart),
        paddingBlock: Number.parseFloat(style.paddingBlockStart),
      };
    });
    expect(metrics.background).not.toBe('rgba(0, 0, 0, 0)');
    expect(metrics.borderWidth).toBe('1px');
    expect(metrics.borderStyle).toBe('solid');
    expect(metrics.borderColor).not.toBe('rgb(0, 0, 0)');
    expect(metrics.paddingInline).toBeGreaterThanOrEqual(20);
    expect(metrics.paddingBlock).toBeGreaterThanOrEqual(20);
    await expect(page.locator('[data-news-signal]').first().locator('[data-news-order="fact"], [data-news-order="selection"], [data-news-order="caveat"], [data-news-order="note"], [data-news-order="metadata"]')).toHaveCount(5);
  }
});

test('scroll-triggered history waits for trusted movement and appends one Edition without focus steal', async ({ page }) => {
  const editionRequests: string[] = [];
  page.on('request', (request) => {
    if (/\/news\/\d{4}-\d{2}-\d{2}(?:-\d{4})?\/$/.test(new URL(request.url()).pathname)) editionRequests.push(request.url());
  });
  await page.goto('/news/');
  await page.waitForTimeout(250);
  await expect(page.locator('[data-news-edition]')).toHaveCount(1);
  expect(editionRequests).toEqual([]);

  await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(250);
  await expect(page.locator('[data-news-edition]')).toHaveCount(1);

  await page.evaluate(() => scrollTo(0, 0));
  await page.keyboard.press('End');
  await expect(page.locator('[data-news-edition]')).toHaveCount(2);
  expect(editionRequests).toHaveLength(1);
  await expect(page).toHaveURL(new RegExp(`\\?through=${firstPreviousId}$`));
  await expect(page.locator(`[data-news-edition="${firstPreviousId}"] h2[data-news-edition-heading]`)).not.toBeFocused();
  await page.waitForTimeout(300);
  expect(editionRequests).toHaveLength(1);
});

test('production omits review-only News routes, copy, feed events, and loader target', async ({ page, request }) => {
  test.skip(!production, 'production-only boundary');
  expect((await request.get('/news/2026-07-23-0900/')).status()).toBe(404);
  expect((await request.get('/news/context/agent-authority/')).status()).toBe(404);
  await page.goto('/news/');
  await expect(page.getByText('ROLLING EDITION', { exact: true })).toBeVisible();
  await expect(page.getByText(/PREVIEW|NON-PRODUCTION|sample/i)).toHaveCount(0);
  await expect(page.locator('[data-news-history-link]')).toHaveAttribute('data-target-edition', '2026-07-23-0430');
  const feed = await (await request.get('/news/feed.xml')).text();
  expect(feed).not.toContain('2026-07-23-0900');
  expect(feed).not.toContain('NON-PRODUCTION SAMPLE');
});

test('Edition density is responsive across phone, tablet, and two-column desktop widths', async ({ page }) => {
  const expectations = [
    { width: 390, height: 844, maximumPageHeight: 8100, columns: 1, rows: 6, maximumH1: 30, minimumSignalCopy: 15, minimumSignalHeading: 21, maximumSignalHeading: 22 },
    { width: 768, height: 1024, maximumPageHeight: 5200, columns: 2, rows: 3, maximumH1: 48, minimumSignalCopy: 14, minimumSignalHeading: 24, maximumSignalHeading: 25 },
    { width: 1024, height: 1366, maximumPageHeight: 4600, columns: 2, rows: 3, maximumH1: 48, minimumSignalCopy: 14, minimumSignalHeading: 24, maximumSignalHeading: 25 },
    { width: 1100, height: 1000, maximumPageHeight: 4300, columns: 2, rows: 3, maximumH1: 48, minimumSignalCopy: 14, minimumSignalHeading: 24, maximumSignalHeading: 25 },
    { width: 1101, height: 1000, maximumPageHeight: 5000, columns: 2, rows: 3, maximumH1: 68, minimumSignalCopy: 16, minimumSignalHeading: 28, maximumSignalHeading: 28 },
    { width: 1280, height: 1000, maximumPageHeight: 4600, columns: 2, rows: 3, maximumH1: 68, minimumSignalCopy: 16, minimumSignalHeading: 28, maximumSignalHeading: 28 },
    { width: 1440, height: 1000, maximumPageHeight: 4600, columns: 2, rows: 3, maximumH1: 68, minimumSignalCopy: 16, minimumSignalHeading: 28, maximumSignalHeading: 28 },
    { width: 1728, height: 1000, maximumPageHeight: 4600, columns: 2, rows: 3, maximumH1: 68, minimumSignalCopy: 16, minimumSignalHeading: 28, maximumSignalHeading: 28 },
  ];

  for (const expectation of expectations) {
    await page.setViewportSize({ width: expectation.width, height: expectation.height });
    await page.goto('/news/');
    await page.evaluate(() => document.fonts.ready);
    const metrics = await page.evaluate(() => {
      const root = document.documentElement;
      const signals = Array.from(document.querySelectorAll<HTMLElement>('[data-news-signal]'));
      const interactiveTargets = Array.from(document.querySelectorAll<HTMLElement>('a.news-source-link, .news-nav a'));
      const signalRects = signals.map((signal) => signal.getBoundingClientRect());
      return {
        pageHeight: root.scrollHeight,
        scrollWidth: root.scrollWidth,
        clientWidth: root.clientWidth,
        columns: new Set(signalRects.map((rect) => Math.round(rect.left))).size,
        signalTops: signalRects.map((rect) => Math.round(rect.top)),
        minimumTargetHeight: Math.min(...interactiveTargets.map((target) => target.getBoundingClientRect().height)),
        bodyFontSize: Number.parseFloat(getComputedStyle(document.querySelector('.news-body')!).fontSize),
        h1FontSize: Number.parseFloat(getComputedStyle(document.querySelector('.news-edition h1')!).fontSize),
        signalHeadingFontSize: Number.parseFloat(getComputedStyle(document.querySelector('.news-signal h3')!).fontSize),
        signalCopyFontSize: Number.parseFloat(getComputedStyle(document.querySelector('.news-reading-note p')!).fontSize),
      };
    });

    expect(metrics.pageHeight, JSON.stringify({ expectation, metrics })).toBeLessThanOrEqual(expectation.maximumPageHeight);
    if (expectation.minimumPageHeight) expect(metrics.pageHeight).toBeGreaterThanOrEqual(expectation.minimumPageHeight);
    expect(metrics.columns).toBe(expectation.columns);
    expect(new Set(metrics.signalTops).size).toBe(expectation.rows);
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
    expect(metrics.minimumTargetHeight).toBeGreaterThanOrEqual(44);
    expect(metrics.bodyFontSize).toBeGreaterThanOrEqual(14);
    expect(metrics.h1FontSize).toBeLessThanOrEqual(expectation.maximumH1);
    expect(metrics.signalCopyFontSize).toBeGreaterThanOrEqual(expectation.minimumSignalCopy);
    expect(metrics.signalHeadingFontSize).toBeGreaterThanOrEqual(expectation.minimumSignalHeading);
    expect(metrics.signalHeadingFontSize).toBeLessThanOrEqual(expectation.maximumSignalHeading);
  }
});

for (const route of newsRoutes) {
  test(`${route} has no horizontal overflow at mobile and desktop widths`, async ({ page }) => {
    for (const width of [320, 390, 768, 1024, 1100, 1101, 1280, 1440, 1728]) {
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

test('unknown News date and Context routes are 404', async ({ request }) => {
  expect((await request.get('/news/2099-01-01/')).status()).toBe(404);
  expect((await request.get('/news/context/missing-context/')).status()).toBe(404);
});

test('homepage opens AOIFUTURE News as a Navigator layer and only its panel links to News', async ({ page }) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');

    const newsButton = page.getByRole('button', { name: /NEWS/i });
    await expect(newsButton).toBeVisible();
    await expect(newsButton).toHaveText(/NEWS/);
    await expect(newsButton).toHaveText(/SOURCE DESK/);
    await expect(page.locator('nav a[href="/news/"]')).toHaveCount(0);

    const closedMetrics = await newsButton.evaluate(() => {
      return {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      };
    });
    expect(closedMetrics.scrollWidth).toBeLessThanOrEqual(closedMetrics.clientWidth + 1);

    await page.waitForTimeout(1_000);
    await newsButton.click();
    await expect(page).toHaveURL(/#news$/);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const newsLink = dialog.getByRole('link', { name: /READ AOIFUTURE NEWS/i });
    await expect(newsLink).toHaveAttribute('href', '/news/');
    await expect(newsLink).not.toHaveAttribute('target', /.+/);
    const openMetrics = await dialog.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(openMetrics.scrollWidth).toBeLessThanOrEqual(openMetrics.clientWidth + 1);

    await newsLink.click();
    await expect(page).toHaveURL(/\/news\/$/);
  }
});

test('home and News defer Google collection until consent and grant once after acceptance', async ({ browser }) => {
  for (const route of ['/', '/news/']) {
    for (const width of [390, 1440]) {
      const context = await browser.newContext();
      const page = await context.newPage();
      const collectRequests: string[] = [];
      page.on('request', (request) => {
        if (new URL(request.url()).hostname === 'www.google-analytics.com' && new URL(request.url()).pathname === '/g/collect') collectRequests.push(request.url());
      });
      await page.addInitScript(() => localStorage.clear());
      await page.setViewportSize({ width, height: 900 });
      await page.goto(route);

      await expect(page.locator('script#google-analytics-script')).toHaveCount(0);
      if (route === '/news/') await expect(page.locator('script[data-sdkn="@vercel/analytics/astro"]')).toHaveCount(1);
      await expect(page.getByText('このサイトではGoogle Analyticsを使用しています。')).toBeVisible();
      const bannerMetrics = await page.locator('#cookie-banner').evaluate((banner) => ({
        position: getComputedStyle(banner).position,
        bottom: getComputedStyle(banner).bottom,
        buttonHeights: Array.from(banner.querySelectorAll('button')).map((button) => button.getBoundingClientRect().height),
      }));
      expect(bannerMetrics.position).toBe('fixed');
      expect(bannerMetrics.bottom).toBe('0px');
      expect(bannerMetrics.buttonHeights.every((height) => height >= 44)).toBe(true);
      await page.waitForTimeout(750);
      expect(collectRequests).toEqual([]);
      expect(await page.evaluate(() => window.dataLayer.filter((entry: IArguments) => {
        const [command, action, value] = Array.from(entry);
        return command === 'consent' && action === 'default' && (value as { analytics_storage?: string }).analytics_storage === 'denied' && (value as { ad_storage?: string }).ad_storage === 'denied';
      })).then((entries) => entries)).toHaveLength(1);

      await page.getByRole('button', { name: '同意' }).click();
      await expect(page.getByText('このサイトではGoogle Analyticsを使用しています。')).toBeHidden();
      await expect(page.locator('script#google-analytics-script')).toHaveCount(1);
      expect(await page.evaluate(() => window.dataLayer.filter((entry: IArguments) => {
        const [command, action, value] = Array.from(entry);
        return command === 'consent' && action === 'update' && (value as { analytics_storage?: string }).analytics_storage === 'granted';
      })).then((entries) => entries)).toHaveLength(1);
      await context.close();
    }
  }
});

test('Navigator modal entries retain their hash behavior', async ({ page }) => {
  await page.goto('/#nictia');
  await expect(page).toHaveURL(/#nictia$/);
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
