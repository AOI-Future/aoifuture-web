import {test,expect} from '@playwright/test';
import {liveFixture} from './helpers/live-geography-fixture';
import {compileLive,GEO_CACHE_KEY} from '../src/lib/localquest/live-geography';
import {fromOverpass} from '../src/lib/backside/providers/overpass';
import {LIVE_AREA} from '../src/lib/localquest/live-geography';
import {questFor} from '../src/lib/localquest/world-source';
import {questReducer} from '../src/lib/backside/quest';
test('live generation, source-map comparison, cache restoration and trial completion',async({page})=>{
  test.setTimeout(120000);let requests=0;const errors:string[]=[],llm:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/openai|anthropic|generativelanguage|overpass-api\.de/.test(r.url()))llm.push(r.url());});
  await page.route('**/localquest/source-area.json',async route=>{requests++;await route.fulfill({json:liveFixture()});});
  await page.goto('/play/localquest?world=sample');
  await page.locator('#generate-area').click();
  await expect(page.locator('#geography-status')).toContainText('地理snapshot読込完了');
  await expect(page.locator('#afterhours')).toHaveAttribute('data-world','generated');
  await page.locator('#source-map-toggle').click();
  await expect(page.locator('#source-map-dialog')).toBeVisible();
  await expect(page.locator('#source-map')).toBeVisible();
  expect(await page.locator('#source-map polyline').count()).toBeGreaterThan(0);
  await expect(page.locator('#source-map polyline').first()).toHaveAttribute('points',/-?\d/);
  await expect(page.locator('#source-map-caption')).toContainText('半径400m');
  await page.locator('#source-map-close').click();
  await page.locator('#generate-area').click();
  await expect(page.locator('#geography-status')).toContainText('キャッシュ再利用');expect(requests).toBe(1);
  await page.locator('#start').click();await expect(page.locator('#hud')).toBeVisible();
  await page.locator('#source-map-toggle').click();await expect(page.locator('#hud')).toBeHidden();
  await expect(page.locator('#source-map-dialog')).toBeVisible();await page.locator('#source-map-close').click();
  await page.goto('/play/localquest');
  await expect(page.locator('#afterhours')).toHaveAttribute('data-world','generated');
  await expect(page.locator('#geography-status')).toContainText('前回');expect(requests).toBe(1);
  expect(await page.evaluate(k=>!!localStorage.getItem(k),GEO_CACHE_KEY)).toBe(true);
  const world=compileLive(fromOverpass(liveFixture(),LIVE_AREA));let q=questFor(world);
  q=questReducer(questReducer(q,{type:'accept'}),{type:'start'});q=questReducer(q,{type:'reach',anchor:q.steps[0].anchor});
  const home=world.questAnchors.find(a=>a.id===q.steps[1].anchor)!;
  // Control the final position after unloading the previous scene; not a full route walkthrough.
  await page.goto('about:blank');
  await page.addInitScript(({world,q,home})=>{
    if(location.pathname.includes('/play/localquest')&&!sessionStorage.getItem('live-final')){
      localStorage.setItem('aoi.localquest.v1',JSON.stringify({version:1,sourceId:world.sourceArea.id,compilerVersion:world.version,seed:world.seed,quest:q,pos:{x:home.x,z:home.z,yaw:0}}));sessionStorage.setItem('live-final','1');
    }
  },{world,q,home});
  await page.goto('/play/localquest');await page.locator('#start').click();
  await expect(page.locator('#menu-title')).toHaveText('クエスト完了');await expect(page.locator('#start')).toBeDisabled();
  await page.reload();await expect(page.locator('#menu-title')).toHaveText('クエスト完了');await expect(page.locator('#start')).toBeDisabled();
  expect(errors).toEqual([]);expect(llm).toEqual([]);expect(requests).toBe(1);
});
test('completed sample can be replaced by a fresh real-data world',async({page})=>{
  const {compileTopology}=await import('../src/lib/backside/compiler');
  const {sampleTown,sampleQuest}=await import('../src/lib/backside/fixtures/sample-town');
  const world=compileTopology(sampleTown);let q=sampleQuest();
  q=questReducer(questReducer(q,{type:'accept'}),{type:'start'});
  for(const step of q.steps)q=questReducer(q,{type:'reach',anchor:step.anchor});
  await page.addInitScript(({world,q})=>localStorage.setItem('aoi.localquest.v1',JSON.stringify({version:1,sourceId:world.sourceArea.id,compilerVersion:world.version,seed:world.seed,quest:q,pos:{x:world.spawn.x,z:world.spawn.z,yaw:0}})),{world,q});
  await page.route('**/localquest/source-area.json',r=>r.fulfill({json:liveFixture()}));
  await page.goto('/play/localquest?world=sample');
  await expect(page.locator('#menu-title')).toHaveText('クエスト完了');await expect(page.locator('#start')).toBeDisabled();
  await page.locator('#generate-area').click();await expect(page.locator('#geography-status')).toContainText('地理snapshot読込完了');
  await expect(page.locator('#menu-title')).toHaveText('最初の信号を拾う。');await expect(page.locator('#menu-copy')).not.toContainText('試遊は終了');
  await expect(page.locator('#start')).toBeEnabled();await page.locator('#start').click();await expect(page.locator('#hud')).toBeVisible();
});
test('provider failure is explicit and does not claim real generation',async({page})=>{
  await page.route('**/localquest/source-area.json',r=>r.fulfill({status:429,body:'busy'}));
  await page.goto('/play/localquest?world=sample');await page.locator('#generate-area').click();
  await expect(page.locator('#geography-status')).toContainText('429');
  await expect(page.locator('#afterhours')).toHaveAttribute('data-world','sample');await expect(page.locator('#generate-area')).toBeEnabled();
});
