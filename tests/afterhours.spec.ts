import { test, expect } from '@playwright/test';
import { join } from 'node:path';
const screenshots = process.env.AFTERHOURS_SCREENSHOT_DIR || 'test-results/afterhours-screenshots';

test('enter, collect by walking, mute, pause, resume saved exploration', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/play/afterhours');
  await expect(page.locator('#start')).toBeEnabled();
  await page.screenshot({ path: join(screenshots, `afterhours-${info.project.name}-title.png`) });
  await page.locator('#start').click();
  await expect(page.locator('#hud')).toBeVisible();
  await page.keyboard.down('KeyW');
  await expect(page.locator('#count')).toHaveText('01', { timeout: 12000 });
  await page.keyboard.up('KeyW');
  await page.locator('#mute').click();
  await expect(page.locator('#mute')).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: join(screenshots, `afterhours-${info.project.name}-play.png`) });
  await page.locator('#pause').click();
  await expect(page.locator('#menu')).toBeVisible();
  await page.reload();
  await expect(page.locator('#start')).toContainText('続き');
  await page.locator('#start').click();
  await expect(page.locator('#count')).toHaveText('01');
  expect(errors).toEqual([]);
});

test('collection preserves spatial identity and pointer cancellation stops touch movement', async ({ page }, info) => {
  await page.addInitScript(() => localStorage.setItem('aoi.afterhours.v1', JSON.stringify({version:1, seed:42, x:0, z:-10.6, yaw:0, count:2, targetX:0, targetZ:-12})));
  await page.goto('/play/afterhours'); await page.locator('#start').click();
  await expect(page.locator('#count')).toHaveText('03');
  await expect(page.locator('#zone')).toHaveText('ARRIVAL HALL');
  if (info.project.name !== 'desktop') {
    await expect(page.locator('#joystick')).toBeVisible();
    const client = await page.context().newCDPSession(page);
    const box = (await page.locator('#joystick').boundingBox())!;
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    const before = await page.locator('#coordinates').innerText();
    await client.send('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[{x, y:y-38, id:1}] });
    await expect(page.locator('#coordinates')).not.toHaveText(before);
    await client.send('Input.dispatchTouchEvent', { type:'touchCancel', touchPoints:[] });
    await page.waitForTimeout(200);
    const stopped = await page.locator('#coordinates').innerText();
    await page.waitForTimeout(350); await expect(page.locator('#coordinates')).toHaveText(stopped);
    await client.detach();
  }
});

test('apps route reaches the game; corrupt saves fail safely', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('aoi.afterhours.v1', '{broken'));
  await page.goto('/apps'); await page.getByRole('link', { name: /AFTERHOURS/ }).click();
  await page.getByRole('link', { name: 'ブラウザで遊ぶ' }).click();
  await expect(page.locator('#start')).toBeEnabled();
  await page.locator('#start').click(); await expect(page.locator('#count')).toHaveText('00');
});

test('audio starts only after entry, produces a signal, and suspends on pause', async ({ page }) => {
  await page.addInitScript(() => {
    const Native = window.AudioContext;
    (window as any).audioProbe = [];
    window.AudioContext = class extends Native {
      constructor(...args: ConstructorParameters<typeof AudioContext>) { super(...args); (window as any).audioProbe.push(this); }
      createDynamicsCompressor() {
        const node = super.createDynamicsCompressor();
        const analyser = this.createAnalyser(); node.connect(analyser); (this as any).probe = analyser; return node;
      }
    };
  });
  await page.goto('/play/afterhours'); await expect(page.locator('#start')).toBeEnabled();
  expect(await page.evaluate(() => (window as any).audioProbe.length)).toBe(0);
  await page.locator('#start').click();
  await expect.poll(() => page.evaluate(() => (window as any).audioProbe[0]?.state)).toBe('running');
  await expect.poll(() => page.evaluate(() => {
    const a = (window as any).audioProbe[0].probe; const samples = new Float32Array(a.fftSize);
    a.getFloatTimeDomainData(samples); return Math.max(...samples.map(Math.abs));
  })).toBeGreaterThan(.001);
  await page.locator('#pause').click();
  await expect.poll(() => page.evaluate(() => (window as any).audioProbe[0].state)).toBe('suspended');
});


test('walk to another room and return to a bookmarked address', async ({ page }) => {
  await page.goto('/play/afterhours'); await page.locator('#start').click();
  await expect(page.locator('#zone')).toHaveText('ARRIVAL HALL');
  await page.locator('#bookmark').click();
  await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW');
  await expect(page.locator('#zone')).toHaveText('THE STACKS', {timeout:10000});
  await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
  await page.locator('#pause').click();
  await page.locator('.ah-notebook summary').click();
  await expect(page.locator('#discovery-count')).toHaveText('2 / 8 種類の空間');
  await page.locator('#bookmarks .ah-note-go').click();
  await expect(page.locator('#guide-type')).toHaveText('BOOKMARK');
  await page.keyboard.down('ShiftLeft');await page.keyboard.down('KeyS');
  await expect(page.locator('#zone')).toHaveText('ARRIVAL HALL',{timeout:10000});
  await page.keyboard.up('KeyS');await page.keyboard.up('ShiftLeft');
  await page.locator('#pause').click();await page.reload();
  await page.locator('.ah-notebook summary').click();
  await expect(page.locator('#bookmarks')).toContainText('E0 / S0');
  await expect(page.locator('#discovery-count')).toHaveText('2 / 8 種類の空間');
});

test('eight spaces render without errors', async ({ page },info) => {
  test.setTimeout(60000);
  const errors:string[]=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{const fixture=sessionStorage.getItem('afterhours.fixture');if(fixture)localStorage.setItem('aoi.afterhours.v1',fixture);});
  const expectedNames=['ARRIVAL HALL','THE STACKS','STILLWATER','THE OCULUS','OVERTIME','SOFT EXHIBIT','UNDERWORKS','WINTER GARDEN'];
  const rooms=[['arrival',0,0],['archive',0,-1],['pool',-1,0],['atrium',1,0],['office',0,1],['gallery',-1,-1],['service',1,-1],['garden',1,1]] as const;
  await page.goto('/play/afterhours');
  for(const[name,x,z]of rooms){
    await page.evaluate(({x,z})=>sessionStorage.setItem('afterhours.fixture',JSON.stringify({version:1,seed:42,x:x*32,z:z*32+5,yaw:-.35,count:10,targetX:0,targetZ:-12})),{x,z});
    await page.reload();await page.locator('#start').click();
    await expect(page.locator('#zone')).toHaveText(expectedNames[rooms.findIndex(r=>r[0]===name)]);
    await page.screenshot({path:join(screenshots,`afterhours-${info.project.name}-${name}.png`)});
  }
  expect(errors).toEqual([]);
});


test('streaming releases offscreen room resources', async ({ page },info) => {
  test.skip(info.project.name !== 'desktop','Shared world lifecycle is device-independent.');
  await page.goto('/play/afterhours');await expect(page.locator('#start')).toBeEnabled();
  const result=await page.evaluate(async()=>{
    const {World}=await import('/src/lib/afterhours/world.ts');
    const THREE=await import('/node_modules/.vite/deps/three.js');
    const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(68,1,.1,100), renderer=new THREE.WebGLRenderer();
    renderer.setSize(64,64);scene.add(new THREE.HemisphereLight(0xffffff,0x777777,2));
    // Physically based materials allocate a renderer-owned DFG lookup texture.
    const dummy=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());scene.add(dummy);camera.position.set(0,0,4);renderer.render(scene,camera);scene.remove(dummy);dummy.geometry.dispose();dummy.material.dispose();renderer.render(scene,camera);
    const baseline=renderer.info.memory.textures;
    const world=new World(scene,42);let maxChunks=0,maxTextures=0;
    const snapshots=[];
    for(let i=0;i<36;i++){
      world.setFloor(i%5);world.update(i*96,-i*64,2);camera.position.set(i*96,1.7,-i*64);renderer.render(scene,camera);
      maxChunks=Math.max(maxChunks,world.chunks.size);maxTextures=Math.max(maxTextures,renderer.info.memory.textures);
      if(i===0||i===35)snapshots.push(renderer.info.memory.textures);
    }
    world.dispose();renderer.render(scene,camera);const after=renderer.info.memory.textures;renderer.dispose();
    return {maxChunks,maxTextures,snapshots,after,baseline};
  });
  expect(result.maxChunks).toBe(25);expect(result.maxTextures).toBeLessThanOrEqual(105);
  expect(result.snapshots[1]).toBeLessThanOrEqual(result.snapshots[0]+10);
  expect(result.after).toBe(result.baseline);
});


test('fall into a lower floor, save there, and return using the lift', async ({page},info)=>{
  await page.addInitScript(()=>{
    if(!sessionStorage.getItem('depth-fixture')) {
      localStorage.setItem('aoi.afterhours.v1',JSON.stringify({version:1,seed:42,x:9.3,z:12.8,yaw:0,count:4,targetX:96,targetZ:0,level:0,targetLevel:0,seen:1,marks:[{x:0,z:0,level:0}]}));
      sessionStorage.setItem('depth-fixture','1');
    }
  });
  await page.goto('/play/afterhours');await page.locator('#start').click();
  await page.keyboard.down('KeyW');
  await expect(page.locator('#place-name')).toContainText('B1',{timeout:12000});
  await page.keyboard.up('KeyW');
  await expect(page.locator('#distance')).toContainText('昇降機');
  await expect(page.locator('#lift')).toBeVisible();
  await page.screenshot({path:join(screenshots,`afterhours-${info.project.name}-lower-floor.png`)});
  await page.locator('#pause').click();await page.reload();await page.locator('#start').click();
  await expect(page.locator('#place-name')).toContainText('B1');
  if(info.project.name==='desktop')await page.keyboard.press('KeyE');else await page.locator('#lift').tap();
  await expect(page.locator('#place-name')).toContainText('L0');
  await expect(page.locator('#count')).toHaveText('04');
  await expect(page.locator('#lift')).toBeHidden();
});

test('new sources are distant after the introductory collection',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('aoi.afterhours.v1',JSON.stringify({version:1,seed:42,x:0,z:-10.6,yaw:0,count:0,targetX:0,targetZ:-12})));
  await page.goto('/play/afterhours');await page.locator('#start').click();
  await expect(page.locator('#count')).toHaveText('01');
  await page.locator('#pause').click();
  const save=await page.evaluate(()=>JSON.parse(localStorage.getItem('aoi.afterhours.v1')!));
  expect(Math.hypot(save.targetX-save.x,save.targetZ-save.z)).toBeGreaterThan(70);
});
