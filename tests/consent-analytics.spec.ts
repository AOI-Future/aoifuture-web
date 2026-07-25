import { expect, test } from '@playwright/test';

test('Consult consent uses the Consult surface and persists reject or accept decisions', async ({ browser }) => {
  const rejectedContext = await browser.newContext();
  const rejectedPage = await rejectedContext.newPage();
  const collectRequests: string[] = [];
  rejectedPage.on('request', (request) => {
    const url = new URL(request.url());
    if (url.hostname === 'www.google-analytics.com' && url.pathname === '/g/collect') collectRequests.push(url.href);
  });

  await rejectedPage.goto('/consulting/');
  const banner = rejectedPage.locator('#cookie-banner');
  await expect(banner).toBeVisible();
  await expect(rejectedPage.locator('script#google-analytics-script')).toHaveCount(0);
  const consultStyles = await banner.evaluate((node) => {
    const style = getComputedStyle(node);
    const acceptStyle = getComputedStyle(node.querySelector('#cookie-accept')!);
    return {
      backgroundColor: style.backgroundColor,
      borderTopColor: style.borderTopColor,
      color: style.color,
      position: style.position,
      bottom: style.bottom,
      buttonHeights: Array.from(node.querySelectorAll('button')).map((button) => button.getBoundingClientRect().height),
      acceptBackgroundColor: acceptStyle.backgroundColor,
      acceptColor: acceptStyle.color,
    };
  });
  expect(consultStyles).toEqual({
    backgroundColor: 'rgb(250, 250, 250)',
    borderTopColor: 'rgb(224, 224, 232)',
    color: 'rgb(45, 45, 58)',
    position: 'fixed',
    bottom: '0px',
    buttonHeights: [44, 44],
    acceptBackgroundColor: 'rgb(233, 69, 96)',
    acceptColor: 'rgb(255, 255, 255)',
  });

  await rejectedPage.getByRole('button', { name: '拒否' }).click();
  await expect(banner).toBeHidden();
  await expect.poll(() => rejectedPage.evaluate(() => localStorage.getItem('cookie-consent'))).toBe('rejected');
  await rejectedPage.reload();
  await expect(banner).toBeHidden();
  await expect(rejectedPage.locator('script#google-analytics-script')).toHaveCount(0);
  await rejectedPage.waitForTimeout(750);
  expect(collectRequests).toEqual([]);
  await rejectedContext.close();

  const acceptedContext = await browser.newContext();
  const acceptedPage = await acceptedContext.newPage();
  await acceptedPage.goto('/consulting/');
  await acceptedPage.getByRole('button', { name: '同意' }).click();
  await expect(acceptedPage.locator('script#google-analytics-script')).toHaveCount(1);
  await expect.poll(() => acceptedPage.evaluate(() => localStorage.getItem('cookie-consent'))).toBe('accepted');
  await acceptedPage.reload();
  await expect(acceptedPage.locator('#cookie-banner')).toBeHidden();
  await expect(acceptedPage.locator('script#google-analytics-script')).toHaveCount(1);
  expect(await acceptedPage.evaluate(() => window.dataLayer.filter((entry: IArguments) => {
    const [command, action, value] = Array.from(entry);
    return command === 'consent' && action === 'update' && (value as { analytics_storage?: string }).analytics_storage === 'granted';
  }))).toHaveLength(1);
  await acceptedPage.goto('/privacy');
  await expect(acceptedPage.getByText('Cookie同意バナーの選択結果を')).toBeVisible();
  await expect(acceptedPage.getByText('GA4のスクリプトを読み込みます。')).toBeVisible();
  await acceptedContext.close();
});
