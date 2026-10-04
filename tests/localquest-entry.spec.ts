import {test,expect} from '@playwright/test';
test('home reaches Local Quest through APPS and retains both games',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/');
  const nav=page.getByRole('navigation',{name:'Main'});
  await expect(nav.getByRole('link',{name:/LOCAL QUEST/})).toHaveCount(0);
  const entry=nav.getByRole('link',{name:/APPS/});
  await expect(entry).toBeVisible();await expect(entry).toHaveAttribute('href','/apps');
  const bounds=await entry.boundingBox();expect(bounds!.height).toBeGreaterThanOrEqual(44);
  const viewport=page.viewportSize()!;expect(bounds!.y).toBeGreaterThanOrEqual(0);expect(bounds!.y+bounds!.height).toBeLessThanOrEqual(viewport.height);
  await entry.click();await expect(page).toHaveURL(/\/apps\/?$/);
  await expect(page.getByRole('link',{name:/AFTERHOURS/})).toBeVisible();
  await page.getByRole('link',{name:/LOCAL QUEST/}).click();await expect(page).toHaveURL(/\/apps\/localquest\/?$/);
  await page.getByRole('link',{name:'ブラウザで遊ぶ'}).click();await expect(page.locator('#generate-area')).toBeVisible();expect(errors).toEqual([]);
});
