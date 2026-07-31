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

  test('shows the four data-driven cards and answers who receives support and why', async ({ page }) => {
    await page.goto(route);
    const cards = page.locator('[data-relief-card]');
    await expect(cards).toHaveCount(4);
    await expect(page.getByText('熊本県義援金')).toBeVisible();
    await expect(page.getByText('ボラサポ・令和8年熊本地震')).toBeVisible();
    await expect(page.getByText('熊本県災害ボランティア情報')).toBeVisible();
    await expect(page.getByText('日本財団｜令和8年熊本地震 支援金')).toBeVisible();
    await expect(page.getByText(/管理費には使わない/)).toBeVisible();
    await expect(page.getByText(/将来災害の被災地/)).toBeVisible();
    await expect(page.getByRole('heading', { name: '支援の届き方から選ぶ' })).toBeVisible();
    await expect(page.getByText('掲載順は優劣や資金効率の順位ではありません。支援の届き方・用途の違いを分けて表示しています。')).toBeVisible();
    await expect(cards.locator('.relief-card-category').filter({ hasText: '被災された方への義援金' })).toHaveCount(1);
    await expect(cards.locator('.relief-card-category').filter({ hasText: '現地で活動する団体への支援金' })).toHaveCount(2);
    await expect(cards.locator('.relief-card-category').filter({ hasText: '公式情報の確認入口' })).toHaveCount(1);

    for (const card of await cards.all()) {
      const text = await card.innerText();
      expect(text.indexOf('支援の種類')).toBeLessThan(text.indexOf('支援を受ける人・つながる先'));
      expect(text.indexOf('支援の種類')).toBeLessThan(text.indexOf('使われ方'));
      expect(text.indexOf('支援を受ける人・つながる先')).toBeLessThan(text.indexOf('根拠：'));
      expect(text.indexOf('使われ方')).toBeLessThan(text.indexOf('根拠：'));
    }
    await expect(page.getByRole('heading', { name: '支援の届き方から選ぶ' })).toBeVisible();
  });

  test('does not make unsupported comparison claims', async ({ page }) => {
    await page.goto(route);
    const text = await page.locator('body').innerText();
    expect(text).not.toMatch(/中間マージン|手数料|最も届く|一番効果|効率順位|直接性の順位/);
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

  test('provides a safe candidate-submission route according to the consultation feature flag', async ({ page }, testInfo) => {
    await page.goto(route);
    const consultationEnabled = testInfo.project.metadata?.consultationFlag !== 'disabled';
    const section = page.getByRole('region', { name: consultationEnabled ? '公式情報の掲載候補をお寄せください' : '公式情報の掲載候補について' });
    await expect(section).toBeVisible();
    await expect(section).toContainText('個人情報・口座番号・決済情報は送らない');
    await expect(section).toContainText('SNS投稿だけでは掲載しません');
    await expect(section).toContainText('AOI Futureが公式一次情報を確認できたものだけ掲載候補');
    await expect(section).toContainText('AOI Futureは寄付金を受け取らず');
    await expect(section).toContainText('掲載を保証しません');

    if (consultationEnabled) {
      await expect(section).toContainText('公式URL・団体名・分かる範囲の受付状況');
      await expect(section).toContainText('民間団体やNPO等の公式支援情報');
      await expect(section).toContainText('お問い合わせフォームで「その他」を選択');
      const link = section.getByRole('link', { name: 'お問い合わせ（その他）から情報を送る' });
      await expect(link).toHaveAttribute('href', '/contact');
      await expect(link).not.toHaveAttribute('target');
      await link.focus();
      await expect(link).toHaveCSS('outline-style', 'solid');
      await expect(link).toHaveCSS('min-height', '48px');
    } else {
      await expect(section).toContainText('この情報提供フォームは現在利用できません');
      await expect(section).toContainText('現在は情報提供を受け付けていません');
      await expect(section.getByRole('link', { name: 'お問い合わせ（その他）から情報を送る' })).toHaveCount(0);
      await expect(section).not.toContainText('お問い合わせフォームで「その他」を選択');
    }
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
