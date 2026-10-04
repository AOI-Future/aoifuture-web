import { test, expect, type Page } from '@playwright/test';
import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { compileTopology } from '../src/lib/backside/compiler';
import { COMPILER_VERSION } from '../src/lib/backside/ir';
import { questReducer } from '../src/lib/backside/quest';
import { sampleTown, sampleQuest } from '../src/lib/backside/fixtures/sample-town';
import { questFor } from '../src/lib/localquest/world-source';
const screenshots = process.env.LOCALQUEST_SCREENSHOT_DIR || '.cache/localquest-screenshots';
const KEY = 'aoi.localquest.v1';
const world = compileTopology(sampleTown);
const anchor = (id: string) => world.questAnchors.find(a => a.id === id)!;
const seedSave = (page: Page, value: unknown) => page.addInitScript(([k, v]) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem(k, v); sessionStorage.setItem('seeded', '1'); } }, [KEY, typeof value === 'string' ? value : JSON.stringify(value)] as const);
const save = (quest: unknown, x: number, z: number, extra = {}) => ({ version:1, sourceId:world.sourceArea.id, compilerVersion:COMPILER_VERSION, seed:world.seed, quest, pos:{ x, z, yaw:0 }, ...extra });

test('fresh entry shows the first step, pause saves, reload resumes', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/play/localquest?world=sample');
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

test('arrow keys look without strafing and light quality is the entry default', async ({ page }) => {
  await page.goto('/play/localquest?world=sample');
  await expect(page.locator('#quality')).toHaveValue('low');
  await expect(page.locator('#scene')).toHaveAttribute('tabindex','0');
  await page.locator('#start').click();await page.locator('#pause').click();
  const before=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),KEY);
  await page.locator('#start').click();await page.locator('#scene').focus();
  await page.keyboard.down('ArrowLeft');
  try {
    await page.waitForFunction(([key,yaw])=>JSON.parse(localStorage.getItem(key)!).pos.yaw>yaw+0.05,
      [KEY,before.pos.yaw] as const,{timeout:15000});
  } finally {await page.keyboard.up('ArrowLeft');}
  await page.locator('#pause').click();
  const after=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),KEY);
  expect(after.pos.yaw).toBeGreaterThan(before.pos.yaw+0.05);
  expect(after.pos.x).toBeCloseTo(before.pos.x,8);expect(after.pos.z).toBeCloseTo(before.pos.z,8);
});

test('reaching the final anchor completes the quest and survives reload', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  let quest = questReducer(questReducer(sampleQuest(), { type:'accept' }), { type:'start' });
  quest = questReducer(quest, { type:'reach', anchor:'konbini' });
  const station = anchor('station');
  await seedSave(page, save(quest, station.x, station.z));
  await page.goto('/play/localquest?world=sample');
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
  await page.goto('/play/localquest?world=sample');
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
    await page.goto('/play/localquest?world=sample');
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
  await page.goto('/play/localquest?world=sample');
  await expect(page.locator('#start')).toBeEnabled();
  expect(await audit(page)).toEqual({ small: [], low: [] });
  await page.locator('#start').click();
  await expect(page.locator('#hud')).toBeVisible();
  expect(await audit(page)).toEqual({ small: [], low: [] });
});

const overlaps = (a: { x:number; y:number; width:number; height:number }, b: typeof a) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test('shows OpenStreetMap attribution on the menu and in play without overlapping the header', async ({ page }) => {
  await page.goto('/play/localquest?world=sample');
  const link = page.locator('.ah-attribution');
  await expect(link).toHaveCount(1);
  await expect(link).toHaveText('© OpenStreetMap contributors');
  await expect(link).toHaveAttribute('href', 'https://www.openstreetmap.org/copyright');
  await expect(link).toHaveAttribute('rel', /noopener/);
  await expect(page.locator('#afterhours')).toHaveAttribute('data-world', 'sample');
  for (const phase of ['menu', 'play']) {
    if (phase === 'play') { await page.locator('#start').click(); await expect(page.locator('#hud')).toBeVisible(); }
    await expect(link, phase).toBeVisible();
    // Read all boxes in one browser round trip; software WebGL can make individual locator calls expensive.
    const { box, others, fontSize } = await page.evaluate(() => {
      const attribution=document.querySelector('.ah-attribution')!;
      const box=attribution.getBoundingClientRect().toJSON();
      const fontSize=parseFloat(getComputedStyle(attribution).fontSize);
      const others=['.ah-brand', '#pause', '.ah-edition', '.ah-location', '.ah-signal', '#mute'].flatMap(selector=>{
        const el=document.querySelector(selector)!;
        const rect=el.getBoundingClientRect(), style=getComputedStyle(el);
        return rect.width&&rect.height&&style.visibility!=='hidden'&&!el.closest('[hidden]')
          ?[{selector,box:rect.toJSON()}]:[];
      });
      return {box,others,fontSize};
    });
    expect(fontSize, phase).toBeGreaterThanOrEqual(12);
    expect(box.height, phase).toBeGreaterThanOrEqual(44);
    expect(box.x + box.width, phase).toBeLessThanOrEqual(page.viewportSize()!.width);
    for (const other of others) expect(overlaps(box, other.box), `${phase} ${other.selector}`).toBe(false);
  }
});

// The generated world is a gitignored local file; without it the page must fall back to the sample town.
const hasGenerated = existsSync('src/lib/localquest/generated/world.json');
const generated = hasGenerated ? JSON.parse(readFileSync('src/lib/localquest/generated/world.json', 'utf8')) as typeof world : undefined;

test('falls back to the sample town when no generated world is present', async ({ page }) => {
  test.skip(hasGenerated, 'a generated world is present locally');
  await page.goto('/play/localquest');
  await expect(page.locator('#afterhours')).toHaveAttribute('data-world', 'sample');
});

test('the generated world loads and can be walked in first person', async ({ page }) => {
  test.setTimeout(90000);
  test.skip(!hasGenerated, 'run npm run test:localquest:generated for a network-free generated fixture');
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/play/localquest');
  await expect(page.locator('#afterhours')).toHaveAttribute('data-world', 'generated');
  await page.locator('#quality').selectOption('low');
  await page.locator('#start').click();
  await expect(page.locator('#hud')).toBeVisible();
  await expect(page.locator('#count')).toHaveText('1/2');
  await page.locator('#pause').click();
  const before = await page.evaluate(k => JSON.parse(localStorage.getItem(k)!), KEY);
  await page.locator('#start').click();
  await expect(page.locator('#hud')).toBeVisible();
  await page.locator('canvas').first().focus();
  await page.keyboard.down('w');
  try {
    // Movement advances on capped simulation frames, not wall-clock time; software WebGL may render slowly.
    await page.waitForFunction(({x,z})=>{
      const [px,pz]=(document.getElementById('coordinates')?.textContent??'').split('/').map(Number);
      return Math.hypot(px-x,pz-z)>0.6;
    },before.pos,{timeout:20000,polling:100});
  } finally {await page.keyboard.up('w');}
  await page.locator('#pause').click();
  const after = await page.evaluate(k => JSON.parse(localStorage.getItem(k)!), KEY);
  expect(Math.hypot(after.pos.x - before.pos.x, after.pos.z - before.pos.z)).toBeGreaterThan(0.5);
  expect(after.sourceId).toBe(generated!.sourceArea.id);
  expect(after.seed).toBe(generated!.seed);
  expect(after.sourceId).not.toBe(world.sourceArea.id);
  expect(errors).toEqual([]);
});

test('generated POI quest reaches both anchors and restores completion after reload without provider requests', async ({ page }) => {
  test.skip(!generated, 'run npm run test:localquest:generated for a network-free generated fixture');
  const w=generated!, quest=questFor(w);
  const first=w.questAnchors.find(a=>a.id===quest.steps[0].anchor)!;
  const home=w.questAnchors.find(a=>a.id===quest.steps[1].anchor)!;
  const errors:string[]=[], providerRequests:string[]=[];
  page.on('pageerror', e=>errors.push(e.message));
  page.on('request', r=>{if(/overpass|api\.openai\.com/.test(r.url())) providerRequests.push(r.url());});
  // Controlled starting positions exercise the game's reach reducer, not physical traversal of the full route.
  await seedSave(page, {version:1,sourceId:w.sourceArea.id,compilerVersion:w.version,seed:w.seed,quest,pos:{x:first.x,z:first.z,yaw:0}});
  await page.goto('/play/localquest');
  await expect(page.locator('#afterhours')).toHaveAttribute('data-world','generated');
  await page.locator('#start').click();
  await expect(page.locator('#count')).toHaveText('2/2');
  await page.locator('#pause').click();
  const progressed=await page.evaluate(k=>JSON.parse(localStorage.getItem(k)!),KEY);
  expect(progressed.quest.status).toBe('ACTIVE');
  expect(progressed.quest.step).toBe(1);
  expect(progressed.sourceId).toBe(w.sourceArea.id);
  // Close first: the game's pagehide save must finish before installing the next controlled position.
  const context=page.context();await page.close();
  const resumed=await context.newPage();
  resumed.on('pageerror', e=>errors.push(e.message));
  resumed.on('request', r=>{if(/overpass|api\.openai\.com/.test(r.url())) providerRequests.push(r.url());});
  await seedSave(resumed,{...progressed,pos:{x:home.x,z:home.z,yaw:0}});
  await resumed.goto('/play/localquest');
  await expect(resumed.locator('#start')).toContainText('続き');
  await resumed.locator('#start').click();
  await expect(resumed.locator('#menu-title')).toHaveText('クエスト完了');
  const completed=await resumed.evaluate(k=>JSON.parse(localStorage.getItem(k)!),KEY);
  expect(completed.quest.status).toBe('COMPLETED');
  expect(completed.quest.step).toBe(2);
  expect(completed.seed).toBe(w.seed);
  await resumed.reload();
  await expect(resumed.locator('#afterhours')).toHaveAttribute('data-world','generated');
  await expect(resumed.locator('#menu-title')).toHaveText('クエスト完了');
  expect(await resumed.evaluate(k=>JSON.parse(localStorage.getItem(k)!),KEY)).toMatchObject({
    sourceId:w.sourceArea.id,compilerVersion:w.version,seed:w.seed,quest:completed.quest,
  });
  expect(errors).toEqual([]);
  expect(providerRequests).toEqual([]);
});
