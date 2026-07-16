import { expect, test } from '@playwright/test';

const routes = [
  '/agent-security/',
  '/agent-security/checklist/',
  '/agent-security/evidence-demo/',
  '/agent-security/reference/tool-and-action-safety/',
];

for (const route of routes) {
  test(`${route} renders at 320 / 768 / 1440 without page overflow`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: width === 320 ? 720 : 900 });
      await page.goto(route);
      await expect(page.locator('h1')).toBeVisible();
      const overflow = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        offenders: Array.from(document.querySelectorAll('*'))
          .filter((element) =>
            element.getBoundingClientRect().right > document.documentElement.clientWidth + 1
            && !element.closest('.as-table-wrap')
          )
          .slice(0, 10)
          .map((element) => ({ tag: element.tagName, className: element.className, right: element.getBoundingClientRect().right })),
      }));
      expect(overflow.offenders, JSON.stringify({ route, width, ...overflow })).toEqual([]);
      expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);

      const buttons = await page.locator('.as-button').evaluateAll((elements) =>
        elements.map((element) => element.getBoundingClientRect().height)
      );
      expect(buttons.every((height) => height >= 44)).toBe(true);
    }
    expect(errors).toEqual([]);
  });
}

test('evidence downloads and tracked Gumroad URL are public', async ({ page, request }) => {
  await page.goto('/agent-security/evidence-demo/');
  const download = await request.get('/agent-security/evidence-demo/AI-Agent-Security-Sample-Evidence.zip');
  expect(download.status()).toBe(200);
  expect((await download.body()).length).toBeGreaterThan(10_000);

  const pdf = await request.get('/agent-security/evidence-demo/sample-verification-fail.pdf');
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()['content-type']).toContain('application/pdf');

  const gumroad = page.locator('a[data-as-track="gumroad_click"]').first();
  await expect(gumroad).toHaveAttribute('href', /utm_source=aoifuture_reference/);
  await expect(gumroad).toHaveAttribute('href', /utm_campaign=agent_security_funnel/);
});

test('checklist stays in local storage and can reset', async ({ page }) => {
  await page.goto('/agent-security/checklist/');
  const first = page.locator('#security-checklist input[type="checkbox"]').first();
  await first.check();
  await expect(page.locator('#check-count')).toContainText('1 /');
  await page.reload();
  await expect(first).toBeChecked();
  await page.locator('#reset-checklist').click();
  await expect(first).not.toBeChecked();
});

test('terminology guide explains the traceability chain without opening the book', async ({ page }) => {
  await page.goto('/agent-security/reference/tool-and-action-safety/');
  await page.getByRole('link', { name: '4つの記号の読み方' }).click();
  await expect(page).toHaveURL(/\/agent-security\/#how-to-read$/);
  await expect(page.getByRole('heading', { name: 'この4つだけ分かれば、記号は読めます。' })).toBeVisible();
  for (const term of ['脅威', 'コントロール', '要件', '検証テスト']) {
    await expect(page.locator('.as-notation-heading h3').filter({ hasText: term })).toBeVisible();
  }
  await expect(page.getByText('VT-S-011-SHELL', { exact: true }).first()).toBeVisible();
  await expect(page.locator('#how-to-read')).toContainText('一対一の変換でも、総合点でもなく');
});
