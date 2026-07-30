import { test, expect } from '@playwright/test';

const route = '/support/kumamoto-2026/';

test.describe('令和8年熊本地震 支援ガイド', () => {
  test('route and metadata identify the safe official-information guide', async ({ page }) => {
    await page.goto(route);
    await expect(page).toHaveTitle('令和8年熊本地震 支援ガイド | AOI Future');
    await expect(page.locator('h1')).toHaveText('令和8年熊本地震 支援ガイド');
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://aoifuture.com/support/kumamoto-2026/');
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', '令和8年熊本地震 支援ガイド | AOI Future');
    await expect(page.getByText('公的機関のサイトではありません')).toBeVisible();
    await expect(page.getByText('公式情報を確認できる支援ガイド')).toBeVisible();
  });

  test('shows the three data-driven cards and answers who receives support and why', async ({ page }) => {
    await page.goto(route);
    const cards = page.locator('[data-relief-card]');
    await expect(cards).toHaveCount(3);
    await expect(page.getByText('熊本県義援金')).toBeVisible();
    await expect(page.getByText('ボラサポ・令和8年熊本地震')).toBeVisible();
    await expect(page.getByText('熊本県災害ボランティア情報')).toBeVisible();

    for (const card of await cards.all()) {
      const text = await card.innerText();
      expect(text.indexOf('支援を受ける人・つながる先')).toBeLessThan(text.indexOf('公式'));
      expect(text.indexOf('使われ方')).toBeLessThan(text.indexOf('公式'));
    }
    await expect(page.getByRole('heading', { name: '支援は、どこに・何に届くのか' })).toBeVisible();
  });

  test('makes status, policy, and safety guidance visible', async ({ page }) => {
    await page.goto(route);
    await expect(page.getByRole('heading', { name: '掲載方針' })).toBeVisible();
    await expect(page.getByText('公式一次情報を優先')).toBeVisible();
    await expect(page.getByText(/Xは掲載根拠でなく候補検知/)).toBeVisible();
    await expect(page.getByText(/公式更新日：ページ上で確認できず/)).toBeVisible();
    await expect(page.getByText(/物資の無断送付/)).toBeVisible();
    await expect(page.getByText(/独自の現地訪問/)).toBeVisible();
    await expect(page.getByText(/SNS投稿のみを根拠に送金せず/)).toBeVisible();
    await expect(page.getByText(/口座番号・決済フォーム・寄付受付を置いていません/)).toBeVisible();
  });

  test('external links have safe attributes and the document has no analytics', async ({ page }) => {
    await page.goto(route);
    const externalLinks = page.locator('a[href^="https://"]');
    expect(await externalLinks.count()).toBeGreaterThan(0);
    for (const link of await externalLinks.all()) {
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', /noopener/);
      await expect(link).toHaveAttribute('rel', /noreferrer/);
    }
    const html = await page.locator('html').innerHTML();
    expect(html).not.toMatch(/googletagmanager|google-analytics|gtag\s*\(|dataLayer|vercel-insights/i);
  });
});
