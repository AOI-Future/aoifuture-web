import * as THREE from 'three';
import { World, ROOM } from '../afterhours/world';
import { Soundscape } from '../afterhours/audio';
import { compiledLayout } from '../backside/compiler';
import { COMPILER_VERSION } from '../backside/ir';
import { questReducer, currentStep, isQuest, type Quest } from '../backside/quest';
import { pickWorld } from './world-source';
import { generatedWorld } from './generated-world';
import { relativeBearing } from './navigation';

export const SAVE_KEY = 'aoi.localquest.v1';
type Save = { version:1; sourceId:string; compilerVersion:string; seed:number; quest:Quest; pos:{x:number;z:number;yaw:number} };

export function initLocalQuest(candidate:unknown=generatedWorld,{forceSample=new URLSearchParams(location.search).get('world')==='sample'}:{forceSample?:boolean}={}) {
  const el = (id: string) => document.getElementById(id)!;
  const root = el('afterhours'), canvas = el('scene') as HTMLCanvasElement;
  // A locally generated world when one is present and valid; `?world=sample` forces the bundled sample town.
  const source = pickWorld(candidate, { forceSample });
  const backside = source.world, layout = compiledLayout(backside);
  root.dataset.world = source.source;
  const anchorOf = (id:string) => backside.questAnchors.find(a => a.id === id);
  const anchorIds = new Set(backside.questAnchors.map(a => a.id));

  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true }); }
  catch { el('status').textContent = 'この端末ではWebGLを開始できませんでした。'; (el('start') as HTMLButtonElement).disabled = true; return; }
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(68, 1, .08, 180);
  scene.add(new THREE.HemisphereLight(0xfff6d7, 0x4c463d, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.1); sun.position.set(3, 8, 2); scene.add(sun);
  const sound = new Soundscape();

  const ringGeometry = new THREE.TorusGeometry(.65, .025, 8, 48), coreGeometry = new THREE.OctahedronGeometry(.16);
  const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xbaffff });
  const ring = new THREE.Group(); ring.add(new THREE.Mesh(ringGeometry, ringMaterial), new THREE.Mesh(coreGeometry, ringMaterial)); scene.add(ring);

  const fresh = (): Save => ({ version:1, sourceId:backside.sourceArea.id, compilerVersion:COMPILER_VERSION, seed:backside.seed, quest:source.quest(), pos:{ x:backside.spawn.x, z:backside.spawn.z, yaw:0 } });
  const load = (): { state:Save; saved:boolean } => {
    try {
      const raw = localStorage.getItem(SAVE_KEY); if (!raw) return { state:fresh(), saved:false };
      const s = JSON.parse(raw) as Save;
      const ok = s && s.version === 1 && s.sourceId === backside.sourceArea.id && s.compilerVersion === COMPILER_VERSION && s.seed === backside.seed
        && isQuest(s.quest, anchorIds) && [s.pos?.x, s.pos?.z, s.pos?.yaw].every(Number.isFinite);
      return ok ? { state:s, saved:true } : { state:fresh(), saved:false };
    } catch { return { state:fresh(), saved:false }; }
  };
  let { state, saved } = load();
  let world = new World(scene, backside.seed, 0, layout);
  let started = false, active = false, toastUntil = 0, travel = 0, locationKey = '', pitch = 0, last = performance.now(), hudAt = 0, saveAt = 0, frame = 0;
  const keys = new Set<string>(); let sprint = false, stick = { x:0, y:0 };
  const abort = new AbortController(), options = { signal: abort.signal };

  const save = () => { if (!started && !saved) return; try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); saved = true; } catch { el('status').textContent = '保存できませんでした。'; } };
  const radius = () => (el('quality') as HTMLSelectElement).value === 'low' ? 2 : 3;
  const resize = () => { renderer.setPixelRatio(Math.min(devicePixelRatio, radius() === 2 ? 1 : 1.5)); renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); };
  const safePosition = () => {
    if (!world.blocked(state.pos.x, state.pos.z)) return;
    for (let r = .5; r < ROOM; r += .5) for (let a = 0; a < 16; a++) {
      const px = state.pos.x + Math.cos(a / 16 * Math.PI * 2) * r, pz = state.pos.z + Math.sin(a / 16 * Math.PI * 2) * r;
      if (!world.blocked(px, pz)) { state.pos.x = px; state.pos.z = pz; return; }
    }
    state.pos.x = backside.spawn.x; state.pos.z = backside.spawn.z;
  };
  const toast = (text: string, ms = 2600) => { el('toast').textContent = text; toastUntil = performance.now() + ms; };
  const target = () => { const step = currentStep(state.quest); return step ? anchorOf(step.anchor) : undefined; };

  const showMenu = (title: string, copy: string, startText: string) => {
    el('menu-title').textContent = title; el('menu-copy').textContent = copy; el('start').textContent = startText;
    root.classList.remove('playing'); el('menu').hidden = false; el('hud').hidden = true; el('pause').hidden = true; el('menu-footer').hidden = false;
  };
  const pause = (message = '一時停止中') => {
    if (!active) return; active = false; keys.clear(); stick = { x:0, y:0 }; save(); sound.pause();
    if (document.pointerLockElement) document.exitPointerLock();
    showMenu(message, 'クエストは保存されています。', '探索を再開する ↗'); el('new-game').hidden = false;
  };
  const complete = () => {
    ring.visible = false; save();
    active = false; sound.pause(); if (document.pointerLockElement) document.exitPointerLock();
    showMenu('クエスト完了', `「${state.quest.ja}」を達成しました。この小エリアの試遊は終了です。元地図で読み替えを確認できます。`, '試遊終了'); (el('start') as HTMLButtonElement).disabled = true; el('new-game').hidden = false;
  };
  const begin = () => {
    if (state.quest.status === 'DRAFT') state.quest = questReducer(state.quest, { type:'accept' });
    if (state.quest.status === 'ACCEPTED') state.quest = questReducer(state.quest, { type:'start' });
    (el('start') as HTMLButtonElement).disabled = false;
    started = true; active = true; root.classList.add('playing'); el('menu').hidden = true; el('hud').hidden = false; el('pause').hidden = false; el('menu-footer').hidden = true;
    void sound.start().catch(() => toast('音を開始できませんでした。無音で探索できます。', 5000));
    canvas.focus(); last = performance.now(); save();
  };

  document.addEventListener('localquest:pause',()=>pause(),options);
  el('start').addEventListener('click', begin, options);
  el('pause').addEventListener('click', () => pause(), options);
  el('new-game').addEventListener('click', () => {
    if (saved && !confirm('現在のクエストを破棄して最初から始めますか？')) return;
    state = fresh(); ring.visible = true; locationKey = ''; pitch = 0; safePosition(); begin();
  }, options);
  el('volume').addEventListener('input', e => sound.setVolume(Number((e.target as HTMLInputElement).value) / 100), options);
  el('quality').addEventListener('change', resize, options);
  el('mute').addEventListener('click', () => {
    sound.toggle(); el('mute').textContent = sound.muted ? 'SOUND OFF' : 'SOUND ON';
    el('mute').setAttribute('aria-pressed', String(sound.muted)); el('mute').setAttribute('aria-label', sound.muted ? '音をオン' : '音をミュート');
  }, options);
  el('sprint').addEventListener('click', () => { sprint = !sprint; el('sprint').setAttribute('aria-pressed', String(sprint)); }, options);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); }, options);
  window.addEventListener('blur', () => pause(), options);
  window.addEventListener('keydown', e => { if (e.code === 'Escape') pause(); else if (active) keys.add(e.code); }, options);
  window.addEventListener('keyup', e => keys.delete(e.code), options);
  window.addEventListener('resize', resize, options);
  const fine = matchMedia('(pointer: fine)'), reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  canvas.addEventListener('click', () => { if (active && fine.matches) void canvas.requestPointerLock?.(); }, options);
  document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && active && fine.matches) pause(); }, options);
  document.addEventListener('mousemove', e => { if (document.pointerLockElement === canvas) { state.pos.yaw -= e.movementX * .0024; pitch = Math.max(-1.2, Math.min(1.2, pitch - e.movementY * .0024)); } }, options);
  let drag: number | undefined, dragX = 0, dragY = 0;
  canvas.addEventListener('pointerdown', e => { if (!active || e.pointerType === 'mouse') return; drag = e.pointerId; dragX = e.clientX; dragY = e.clientY; canvas.setPointerCapture(e.pointerId); }, options);
  canvas.addEventListener('pointermove', e => { if (e.pointerId !== drag) return; state.pos.yaw -= (e.clientX - dragX) * .005; pitch = Math.max(-1.2, Math.min(1.2, pitch - (e.clientY - dragY) * .005)); dragX = e.clientX; dragY = e.clientY; }, options);
  const endDrag = (e: PointerEvent) => { if (e.pointerId === drag) drag = undefined; };
  canvas.addEventListener('pointerup', endDrag, options); canvas.addEventListener('pointercancel', endDrag, options);
  const joy = el('joystick'), knob = el('stick'); let joyId: number | undefined;
  const moveStick = (e: PointerEvent) => { const b = joy.getBoundingClientRect(); let x = (e.clientX - b.left - b.width / 2) / 36, y = (e.clientY - b.top - b.height / 2) / 36; const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } stick = { x, y }; knob.style.transform = `translate(${x * 36}px,${y * 36}px)`; };
  const endStick = (e: PointerEvent) => { if (e.pointerId !== joyId) return; joyId = undefined; stick = { x:0, y:0 }; knob.style.transform = ''; };
  joy.addEventListener('pointerdown', e => { joyId = e.pointerId; joy.setPointerCapture(e.pointerId); moveStick(e); }, options);
  joy.addEventListener('pointermove', e => { if (e.pointerId === joyId) moveStick(e); }, options);
  joy.addEventListener('pointerup', endStick, options); joy.addEventListener('pointercancel', endStick, options);
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); pause('描画が中断されました'); (el('start') as HTMLButtonElement).disabled = true; }, options);
  window.addEventListener('pagehide', () => { save(); sound.pause(); }, options);

  const loop = (now: number) => {
    frame = requestAnimationFrame(loop);
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    const goal = target();
    if (active) {
      if (keys.has('ArrowLeft')) state.pos.yaw += dt * 1.6;
      if (keys.has('ArrowRight')) state.pos.yaw -= dt * 1.6;
      let fx = 0, fz = 0;
      if (keys.has('KeyW') || keys.has('ArrowUp')) fz += 1; if (keys.has('KeyS') || keys.has('ArrowDown')) fz -= 1;
      if (keys.has('KeyA')) fx -= 1; if (keys.has('KeyD')) fx += 1;
      fx += stick.x; fz -= stick.y;
      const len = Math.hypot(fx, fz);
      if (len > .05) {
        const speed = (sprint || keys.has('ShiftLeft') || keys.has('ShiftRight') ? 7 : 3.6) * dt / Math.max(1, len);
        const s = Math.sin(state.pos.yaw), c = Math.cos(state.pos.yaw);
        const dx = (-s * fz + c * fx) * speed, dz = (-c * fz - s * fx) * speed;
        if (!world.blocked(state.pos.x + dx, state.pos.z)) state.pos.x += dx;
        if (!world.blocked(state.pos.x, state.pos.z + dz)) state.pos.z += dz;
        travel += Math.hypot(dx, dz);
      }
      const room = layout.describe(Math.round(state.pos.x / ROOM), Math.round(state.pos.z / ROOM), backside.seed);
      const key = `${room.x},${room.z}`;
      if (key !== locationKey) { if (locationKey) toast(room.ja ?? room.place.ja); locationKey = key; sound.space(room.place.echo); }
      if (travel > 1.7) { sound.step(room.place.surface); travel %= 1.7; }
      if (goal) {
        const d = Math.hypot(goal.x - state.pos.x, goal.z - state.pos.z);
        sound.tick(room.index, Math.exp(-d / 85), Math.sin(relativeBearing(state.pos.yaw, state.pos, goal)));
        if (d < 1.5) {
          const done = currentStep(state.quest)!;
          state.quest = questReducer(state.quest, { type:'reach', anchor:goal.id }); sound.collect(); toast(`${done.ja} — 達成`);
          if (state.quest.status === 'COMPLETED') complete();
        }
      }
      if (now > hudAt) {
        hudAt = now + 120;
        el('zone').textContent = room.label ?? room.place.name;
        el('place-name').textContent = `${room.ja ?? room.place.ja} · ${room.id}`;
        el('coordinates').textContent = `${state.pos.x.toFixed(1)} / ${state.pos.z.toFixed(1)}`;
        el('count').textContent = `${Math.min(state.quest.step + 1, state.quest.steps.length)}/${state.quest.steps.length}`;
        const step = currentStep(state.quest), g = target();
        if (step && g) {
          const d = Math.hypot(g.x - state.pos.x, g.z - state.pos.z);
          el('distance').textContent = `${step.ja} · ${Math.round(d)}m`;
          el('signal-meter').style.width = `${Math.max(2, 100 * Math.exp(-d / 70))}%`;
          el('bearing').style.transform = `rotate(${relativeBearing(state.pos.yaw, state.pos, g)}rad)`;
        }
        if (now > toastUntil) el('toast').textContent = '';
      }
      if (now > saveAt) { saveAt = now + 5000; save(); }
    } else if (!reducedMotion.matches) state.pos.yaw += dt * .02;
    world.update(state.pos.x, state.pos.z, radius());
    world.ambience(state.pos.x, state.pos.z, dt, !reducedMotion.matches);
    if (goal) { ring.visible = true; ring.position.set(goal.x, 1.6 + (reducedMotion.matches ? 0 : Math.sin(now / 600) * .08), goal.z); if (!reducedMotion.matches) ring.rotation.y += dt * .8; }
    else ring.visible = false;
    camera.position.set(state.pos.x, 1.7, state.pos.z);
    camera.rotation.set(pitch, state.pos.yaw, 0, 'YXZ');
    renderer.render(scene, camera);
  };

  resize(); safePosition(); world.update(state.pos.x, state.pos.z, radius()); world.ambience(state.pos.x, state.pos.z, 10, false);
  if (state.quest.status === 'COMPLETED') { ring.visible = false; showMenu('クエスト完了', `「${state.quest.ja}」は達成済みです。この試遊は終了です。`, '試遊終了'); }
  else showMenu('最初の信号を拾う。','光る輪をたどって目的地へ。すべての地点に着くとクエスト達成。',saved?'続きから歩く ↗':'この空間を探索する ↗');
  el('new-game').hidden = !saved;
  (el('start') as HTMLButtonElement).disabled = state.quest.status === 'COMPLETED'; el('status').textContent = `${backside.sourceArea.name} · 準備完了`;
  frame = requestAnimationFrame(loop);
  let disposed=false;
  const dispose=()=>{
    if(disposed)return;disposed=true;
    cancelAnimationFrame(frame); save(); abort.abort();
    if(document.pointerLockElement===canvas)document.exitPointerLock();
    sound.dispose(); world.dispose();
    ringGeometry.dispose(); coreGeometry.dispose(); ringMaterial.dispose(); renderer.dispose();
  };
  document.addEventListener('astro:before-swap',dispose,{once:true,signal:abort.signal});
  return dispose;
}
