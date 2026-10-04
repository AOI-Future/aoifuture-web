import {test,expect} from '@playwright/test';
test('home directly launches Local Quest and APPS retains both games',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  const entry=page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:/LOCAL QUEST/});
  await expect(entry).toBeVisible();await expect(entry).toHaveAttribute('href','/play/localquest/');
  const bounds=await entry.boundingBox();expect(bounds!.height).toBeGreaterThanOrEqual(44);
  const viewport=page.viewportSize()!;expect(bounds!.y).toBeGreaterThanOrEqual(0);expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(viewport.height);
  await entry.click();await expect(page).toHaveURL(/\/play\/localquest\/?$/);await expect(page.locator('#generate-area')).toBeVisible();
  await page.goto('/');await page.getByRole('navigation',{name:'Main'}).getByRole('link',{name:/APPS/}).click();
  await expect(page.getByRole('link',{name:/AFTERHOURS/})).toBeVisible();
  await page.getByRole('link',{name:/LOCAL QUEST/}).click();await expect(page).toHaveURL(/\/apps\/localquest\/?$/);
  await page.getByRole('link',{name:'ブラウザで遊ぶ'}).click();await expect(page.locator('#generate-area')).toBeVisible();expect(errors).toEqual([]);
});
