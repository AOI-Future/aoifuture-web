import { test, expect, type Page } from '@playwright/test';
import { join } from 'node:path';
import { compileTopology } from '../src/lib/backside/compiler';
import { COMPILER_VERSION } from '../src/lib/backside/ir';
import { questReducer } from '../src/lib/backside/quest';
import { sampleTown, sampleQuest } from '../src/lib/backside/fixtures/sample-town';
const screenshots = process.env.LOCALQUEST_SCREENSHOT_DIR || 'test-results/localquest-screenshots';
const KEY = 'aoi.localquest.v1';
const world = compileTopology(sampleTown);
const anchor = (id: string) => world.questAnchors.find(a => a.id === id)!;
const seedSave = (page: Page, value: unknown) => page.addInitScript(([k, v]) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem(k, v); sessionStorage.setItem('seeded', '1'); } }, [KEY, typeof value === 'string' ? value : JSON.stringify(value)] as const);
const save = (quest: unknown, x: number, z: number, extra = {}) => ({ version:1, sourceId:world.sourceArea.id, compilerVersion:COMPILER_VERSION, seed:world.seed, quest, pos:{ x, z, yaw:0 }, ...extra });

test('fresh entry shows the first step, pause saves, reload resumes', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/play/localquest');
  await expect(page.locator('#start')).toBeEnabled();
  await expect(page.locator('#new-game')).toBeHidden();
  await page.screenshot({ path: join(screenshots, `localquest-${info.project.name}-title.png`) });
  await page.locator('#start').click();
  await expect(page.locator('#hud')).toBeVisible();
  await expect(page.locator('#menu-footer')).toBeHidden();
  await expect(page.locator('#count')).toHaveText('1/2');
  await expect(page.locator('#distance')).toContainText('コンビニで信号を拾う');
  await page.screenshot({ path: join(screenshots, `localquest-${info.project.name}-play.png`) });
  await page.locator('#pause').click();
  await expect(page.locator('#menu')).toBeVisible();
  await expect(page.locator('#hud')).toBeHidden();
  const stored = await page.evaluate(k => JSON.parse(localStorage.getItem(k)!), KEY);
  expect(stored.quest.status).toBe('ACTIVE');
  await page.reload();
  await expect(page.locator('#start')).toContainText('続き');
  await expect(page.locator('#new-game')).toBeVisible();
  expect(errors).toEqual([]);
});

test('reaching the final anchor completes the quest and survives reload', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  let quest = questReducer(questReducer(sampleQuest(), { type:'accept' }), { type:'start' });
  quest = questReducer(quest, { type:'reach', anchor:'konbini' });
  const station = anchor('station');
  await seedSave(page, save(quest, station.x, station.z));
  await page.goto('/play/localquest');
  await expect(page.locator('#start')).toContainText('続き');
  await page.locator('#start').click();
  await expect(page.locator('#menu-title')).toHaveText('クエスト完了', { timeout: 8000 });
  await expect(page.locator('#hud')).toBeHidden();
  await page.screenshot({ path: join(screenshots, `localquest-${info.project.name}-complete.png`) });
  const stored = await page.evaluate(k => JSON.parse(localStorage.getItem(k)!), KEY);
  expect(stored.quest.status).toBe('COMPLETED');
  await page.reload();
  await expect(page.locator('#menu-title')).toHaveText('クエスト完了');
  expect(errors).toEqual([]);
});

test('corrupt or mismatched saves reset safely', async ({ page }) => {
  await seedSave(page, '{broken');
  await page.goto('/play/localquest');
  await expect(page.locator('#start')).toBeEnabled();
  await expect(page.locator('#start')).not.toContainText('続き');
  await page.locator('#start').click(); await expect(page.locator('#count')).toHaveText('1/2');

  const other = await page.context().newPage();
  await other.addInitScript(([k, v]) => localStorage.setItem(k, v), [KEY, JSON.stringify(save(sampleQuest(), 0, 0, { compilerVersion:'backside-compiler/0.0.0' }))] as const);
  await other.goto('/play/localquest');
  await expect(other.locator('#start')).toBeEnabled();
  await expect(other.locator('#start')).not.toContainText('続き');
});
