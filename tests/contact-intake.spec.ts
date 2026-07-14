import { test, expect } from '@playwright/test';

test('general contact uses the shared endpoint without a stage', async ({ page }) => {
  let payload: Record<string, unknown> | undefined;
  await page.route('**/api/contact-intake', async route => {
    payload = route.request().postDataJSON();
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ ok: true, receiptId: 'AOI-CONTACT1', duplicate: false }) });
  });
  await page.goto('/contact');
  await page.getByLabel(/お問い合わせの種類/).selectOption('Interview / Speaking');
  await page.getByLabel(/内容/).fill('公開イベントでの登壇について相談したいです。');
  await page.getByLabel(/返信先メールアドレス/).fill('test@example.com');
  await page.getByLabel(/機密情報/).check();
  await page.getByLabel(/プライバシーポリシー/).check();
  await page.waitForTimeout(3_100);
  await page.getByRole('button', { name: '送信する' }).click();
  await expect(page.getByText(/AOI-CONTACT1/)).toBeVisible();
  expect(payload).toMatchObject({ source: 'aoifuture.com/contact', inquiryType: 'Interview / Speaking' });
  expect(payload).not.toHaveProperty('stage');
});