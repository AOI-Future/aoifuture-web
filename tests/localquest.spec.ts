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

});

test('saves from another world, compiler or with a malformed quest reset safely', async ({ browser }) => {
  const active = questReducer(questReducer(sampleQuest(), { type:'accept' }), { type:'start' });
  const cases: [string, unknown][] = [
    ['control', save(active, 0, 0)],
    ['version', save(active, 0, 0, { version:2 })],
    ['sourceId', save(active, 0, 0, { sourceId:'other-town' })],
    ['seed', save(active, 0, 0, { seed:world.seed + 1 })],
    ['compilerVersion', save(active, 0, 0, { compilerVersion:'backside-compiler/0.0.0' })],
    ['status', save({ ...active, status:'PAUSED' }, 0, 0)],
    ['anchor', save({ ...active, steps:[{ anchor:'nowhere', title:'x', ja:'x' }] }, 0, 0)],
    ['step', save({ ...active, step:active.steps.length }, 0, 0)],
    ['steps', save({ ...active, steps:[] }, 0, 0)],
  ];
  for (const [name, value] of cases) {
    const context = await browser.newContext(), page = await context.newPage();
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await seedSave(page, value);
    await page.goto('/play/localquest');
    await expect(page.locator('#start'), name).toBeEnabled();
    if (name === 'control') await expect(page.locator('#start'), name).toContainText('続き');
    else await expect(page.locator('#start'), name).not.toContainText('続き');
    expect(errors, name).toEqual([]);
    await context.close();
  }
});

// AGENTS.md: tap targets >= 44px, text contrast >= 4.5:1. Transparent backgrounds resolve to the #000 page.
const audit = (page: Page) => page.evaluate(() => {
  const rgba = (s: string) => { const m = s.match(/[\d.]+/g)!.map(Number); return [m[0], m[1], m[2], m[3] ?? 1]; };
  const lum = ([r, g, b]: number[]) => { const f = (c: number) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const over = (top: number[], under: number[]) => [0, 1, 2].map(i => top[i] * top[3] + under[i] * (1 - top[3]));
  const bgOf = (el: Element | null): number[] => {
    const layers: number[][] = [];
    for (; el; el = el.parentElement) { const c = rgba(getComputedStyle(el).backgroundColor); if (c[3] > 0) layers.push(c); if (c[3] === 1) break; }
    return layers.reverse().reduce((under, top) => over(top, under), [0, 0, 0]);
  };
  const visible = (el: Element) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && Number(s.opacity) > 0 && !el.closest('[hidden]'); };
  const small = [...document.querySelectorAll('button, a, input, select, [role=button]')].filter(visible)
    .map(el => { const r = el.getBoundingClientRect(); const box = (el.closest('label') ?? el).getBoundingClientRect(); return { id: el.id || el.textContent!.trim().slice(0, 20), w: Math.max(r.width, box.width), h: Math.max(r.height, box.height) }; })
    .filter(t => t.w < 44 || t.h < 44);
  const low = [...document.querySelectorAll('body *')].filter(el => visible(el) && [...el.childNodes].some(n => n.nodeType === 3 && n.textContent!.trim()))
    .map(el => { const bg = bgOf(el); const s = getComputedStyle(el); const fg = rgba(s.color); const op = Number(s.opacity); const c = over([fg[0], fg[1], fg[2], fg[3] * op], bg); const [a, b] = [lum(c), lum(bg)].sort((x, y) => y - x); return { text: el.textContent!.trim().slice(0, 24), ratio: +((a + 0.05) / (b + 0.05)).toFixed(2) }; })
    .filter(t => t.ratio < 4.5);
  return { small, low };
});

test('menu and HUD meet tap target and contrast minimums', async ({ page }) => {
  await page.goto('/play/localquest');
  await expect(page.locator('#start')).toBeEnabled();
  expect(await audit(page)).toEqual({ small: [], low: [] });
  await page.locator('#start').click();
  await expect(page.locator('#hud')).toBeVisible();
  expect(await audit(page)).toEqual({ small: [], low: [] });
});
