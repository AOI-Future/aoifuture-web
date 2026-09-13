import * as THREE from 'three';
import { World, ROOM, PLACES, describeRoom, hash } from './world';
import { Soundscape } from './audio';

type Mark = { x: number; z: number };
type Save = { seen: number; marks: Mark[]; version: 1; seed: number; x: number; z: number; yaw: number; count: number; targetX: number; targetZ: number };
const SAVE_KEY = 'aoi.afterhours.v1';
function fresh(): Save { return { seen: 0, marks: [], version: 1, seed: Math.floor(Math.random() * 1e8), x: 0, z: 6, yaw: 0, count: 0, targetX: 0, targetZ: -12 }; }
function readSave(): Save | undefined {
  try {
    const s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (s?.version !== 1 || !['seed', 'x', 'z', 'yaw', 'count', 'targetX', 'targetZ'].every(k => Number.isFinite(s[k]))) return;
    if (!Number.isInteger(s.count) || s.count < 0 || !Number.isInteger(s.seed) || Math.abs(s.x) > 1e9 || Math.abs(s.z) > 1e9 || Math.abs(s.targetX) > 1e9 || Math.abs(s.targetZ) > 1e9) return;
    s.seen = Number.isInteger(s.seen) && s.seen >= 0 && s.seen < 256 ? s.seen : 0;
    s.marks = Array.isArray(s.marks) ? s.marks.filter((m: Mark) => m && Number.isInteger(m.x) && Number.isInteger(m.z) && Math.abs(m.x) < 3e7 && Math.abs(m.z) < 3e7).slice(0,8) : [];
    return s;
  } catch { return; }
}

export function initGame() {
  const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const root = el('afterhours'), canvas = el<HTMLCanvasElement>('scene'), start = el<HTMLButtonElement>('start');
  const menu = el('menu'), hud = el('hud'), status = el('status'), pauseButton = el<HTMLButtonElement>('pause');
  let renderer: THREE.WebGLRenderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'low-power' }); }
  catch { status.textContent = '3D描画を開始できません。WebGL対応ブラウザで開いてください。'; start.textContent = '3D描画を利用できません'; return; }
  const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(68, 1, .08, 180);
  const saved = readSave(); let state = saved || fresh();
  let world = new World(scene, state.seed);
  let location = describeRoom(Math.round(state.x / ROOM), Math.round(state.z / ROOM), state.seed);
  let locationKey = '', guide: Mark | undefined;
  scene.add(new THREE.HemisphereLight(0xfff6d7, 0x4c463d, 2.2));
  const sun = new THREE.DirectionalLight(0xffffff, 1.1); sun.position.set(3, 8, 2); scene.add(sun);
  const sound = new Soundscape();
  const ringGeometry = new THREE.TorusGeometry(.65, .025, 8, 48);
  const ringMaterial = new THREE.MeshBasicMaterial({ color: 0xbaffff });
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  const coreGeometry = new THREE.OctahedronGeometry(.16), core = new THREE.Mesh(coreGeometry, ringMaterial);
  ring.add(core); scene.add(ring);
  const glowCanvas = document.createElement('canvas'); glowCanvas.width = glowCanvas.height = 64;
  const gc = glowCanvas.getContext('2d')!, gradient = gc.createRadialGradient(32, 32, 1, 32, 32, 32);
  gradient.addColorStop(0, '#d0ffffaa'); gradient.addColorStop(.2, '#91ffff55'); gradient.addColorStop(1, '#91ffff00');
  gc.fillStyle = gradient; gc.fillRect(0, 0, 64, 64);
  const glowTexture = new THREE.CanvasTexture(glowCanvas);
  const glowMaterial = new THREE.SpriteMaterial({ map: glowTexture, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const glow = new THREE.Sprite(glowMaterial); glow.scale.set(5, 5, 1); ring.add(glow);
  let active = false, started = false, pitch = 0, frame = 0, previous = 0, travel = 0, lastSave = 0, lastHud = 0, toastUntil = 0;
  let radius = 2, sprint = false, stickX = 0, stickY = 0;
  const keys = new Set<string>(), abort = new AbortController(), options = { signal: abort.signal };
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const motion = el<HTMLInputElement>('motion'); motion.checked = false;
  const save = () => {
    if (!started && !saved) return;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); }
    catch { status.textContent = '保存できないため、このタブの間だけ進行を保持します。'; }
  };
  const resize = () => {
    const quality = el<HTMLSelectElement>('quality').value;
    const low = quality === 'low' || (quality === 'auto' && (innerWidth < 900 || matchMedia('(pointer:coarse)').matches));
    radius = low ? 2 : 3;
    renderer.setPixelRatio(Math.min(devicePixelRatio, low ? 1 : 1.5));
    renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  };
  resize(); world.update(state.x, state.z, radius);
  world.ambience(state.x,state.z,10,false);
  // Earlier saves may now be inside new furniture. Move only to the nearest open aisle.
  if (world.blocked(state.x,state.z)) {
    const cx=Math.round(state.x/ROOM)*ROOM, cz=Math.round(state.z/ROOM)*ROOM;
    if (Math.abs(state.x-cx) < Math.abs(state.z-cz) && !world.blocked(cx,state.z)) state.x=cx;
    else if (!world.blocked(state.x,cz)) state.z=cz;
    else {state.x=cx;state.z=cz;}
  }
  window.addEventListener('resize', resize, options);
  el('quality').addEventListener('change', resize, options);
  el('volume').addEventListener('input', e => sound.setVolume(Number((e.target as HTMLInputElement).value) / 100), options);
  el('mute').addEventListener('click', () => {
    sound.toggle(); el('mute').textContent = sound.muted ? 'SOUND OFF' : 'SOUND ON';
    el('mute').setAttribute('aria-pressed', String(sound.muted)); el('mute').setAttribute('aria-label', sound.muted ? '音をオン' : '音をミュート');
  }, options);
  const resetInput = () => { keys.clear(); stickX = stickY = 0; sprint = false; el('stick').style.transform = ''; el('sprint').setAttribute('aria-pressed', 'false'); };
  function pause(message = 'ひと休み。また、ここから。') {
    if (!active) return;
    active = false; resetInput(); save(); sound.pause();
    if (document.pointerLockElement === canvas) document.exitPointerLock();
    menu.hidden = false; hud.hidden = true; pauseButton.hidden = true; root.classList.remove('playing'); el('menu-footer').hidden = false;
    renderNotes();
    el('menu-title').textContent = message; el('menu-copy').textContent = `${state.count} 個の残響を記録。探索はここから再開できます。`;
    start.textContent = '探索を再開する ↗'; el('new-game').hidden = false; start.focus();
  }
  function begin() {
    if (document.hidden) return;
    active = true; started = true; menu.hidden = true; hud.hidden = false; pauseButton.hidden = false;
    root.classList.add('playing'); el('menu-footer').hidden = true; previous = performance.now();
    void sound.start().catch(() => { el('toast').textContent = '音を開始できませんでした。無音で探索できます。'; toastUntil = performance.now() + 5000; });
    canvas.tabIndex = 0; canvas.focus();
  }
  start.addEventListener('click', begin, options);
  el('new-game').addEventListener('click', () => {
    if (!confirm('保存された探索を置き換えて、新しい空間を始めますか？')) return;
    for (const g of world.chunks.values()) scene.remove(g);
    world.dispose(); state = fresh(); world = new World(scene, state.seed); locationKey = ''; guide = undefined; pitch = 0; renderNotes(); begin(); save();
  }, options);
  pauseButton.addEventListener('click', () => pause(), options);
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); }, options);
  window.addEventListener('blur', () => pause(), options);
  const movementKeys = ['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight'];
  window.addEventListener('keydown', e => {
    if (!active) return;
    if (e.code === 'Escape') { pause(); return; }
    if (e.code === 'KeyB' && !e.repeat) { bookmark(); return; }
    if (movementKeys.includes(e.code)) { e.preventDefault(); keys.add(e.code); }
  }, options);
  window.addEventListener('keyup', e => keys.delete(e.code), options);
  document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement && active) pause(); }, options);
  canvas.addEventListener('click', () => {
    if (active && matchMedia('(pointer:fine)').matches && canvas.requestPointerLock) {
      try { const request = canvas.requestPointerLock(); if (request) void request.catch(() => {}); } catch { /* Drag and keyboard remain available. */ }
    }
  }, options);
  document.addEventListener('mousemove', e => {
    if (active && document.pointerLockElement === canvas) { state.yaw -= e.movementX * .0025; pitch = THREE.MathUtils.clamp(pitch - e.movementY * .0025, -.9, .9); }
  }, options);
  let lookId: number | undefined, lookX = 0, lookY = 0, joyId: number | undefined;
  canvas.addEventListener('pointerdown', e => {
    if (!active || document.pointerLockElement === canvas || lookId !== undefined) return;
    lookId = e.pointerId; lookX = e.clientX; lookY = e.clientY; canvas.setPointerCapture(e.pointerId);
  }, options);
  canvas.addEventListener('pointermove', e => {
    if (!active || e.pointerId !== lookId || document.pointerLockElement === canvas) return;
    state.yaw -= (e.clientX - lookX) * .005; pitch = THREE.MathUtils.clamp(pitch - (e.clientY - lookY) * .004, -.9, .9);
    lookX = e.clientX; lookY = e.clientY;
  }, options);
  const releaseLook = () => { lookId = undefined; };
  canvas.addEventListener('pointerup', releaseLook, options); canvas.addEventListener('pointercancel', releaseLook, options); canvas.addEventListener('lostpointercapture', releaseLook, options);
  const joy = el('joystick');
  const moveStick = (e: PointerEvent) => {
    const rect = joy.getBoundingClientRect(), dx = e.clientX - rect.left - rect.width / 2, dy = e.clientY - rect.top - rect.height / 2;
    const length = Math.max(40, Math.hypot(dx, dy)); stickX = dx / length; stickY = dy / length;
    el('stick').style.transform = `translate(${stickX * 36}px,${stickY * 36}px)`;
  };
  joy.addEventListener('pointerdown', e => { if (!active || joyId !== undefined) return; joyId = e.pointerId; joy.setPointerCapture(e.pointerId); moveStick(e); }, options);
  joy.addEventListener('pointermove', e => { if (e.pointerId === joyId && active) moveStick(e); }, options);
  const releaseJoy = () => { joyId = undefined; stickX = stickY = 0; el('stick').style.transform = ''; };
  joy.addEventListener('pointerup', releaseJoy, options); joy.addEventListener('pointercancel', releaseJoy, options); joy.addEventListener('lostpointercapture', releaseJoy, options);
  el('sprint').addEventListener('click', () => { sprint = !sprint; el('sprint').setAttribute('aria-pressed', String(sprint)); }, options);
  function renderNotes() {
    const discovered = PLACES.filter((_,i)=>state.seen & (1<<i));
    el('discovery-count').textContent = `${discovered.length} / ${PLACES.length} 種類の空間`;
    el('discovered-places').textContent = discovered.length ? discovered.map(p=>p.ja).join(' / ') : 'まだ足を踏み入れていない場所がある。';
    const list = el('bookmarks'); list.replaceChildren();
    for (const mark of state.marks) {
      const room = describeRoom(mark.x,mark.z,state.seed), row=document.createElement('li');
      const go = document.createElement('button'); go.type='button'; go.className='ah-note-go';
      go.textContent = `${room.place.ja} · ${room.id} →`;
      go.addEventListener('click',()=>{guide=mark;begin();});
      const remove=document.createElement('button');remove.type='button';remove.className='ah-note-remove';remove.textContent='×';remove.setAttribute('aria-label',`${room.place.ja} ${room.id}の記録を削除`);
      remove.addEventListener('click',()=>{state.marks=state.marks.filter(m=>m!==mark);if(guide===mark)guide=undefined;save();renderNotes();});
      row.append(go,remove);list.append(row);
    }
    el('bookmark-empty').hidden = state.marks.length>0;
  }
  function bookmark() {
    if (!active) return;
    const room=describeRoom(Math.round(state.x/ROOM),Math.round(state.z/ROOM),state.seed);
    if(state.marks.some(m=>m.x===room.x&&m.z===room.z)) el('toast').textContent='この場所は、すでに手帳に記録している。';
    else if(state.marks.length>=8) el('toast').textContent='手帳は8件まで。一時停止して記録を整理できます。';
    else {state.marks.push({x:room.x,z:room.z});el('toast').textContent=`${room.place.ja}を記録。手帳から帰り道をたどれます。`;save();renderNotes();}
    toastUntil=performance.now()+4500;
  }
  el('bookmark').addEventListener('click',bookmark,options);
  el('follow-resonance').addEventListener('click',()=>{guide=undefined;begin();},options);
  renderNotes();
  function collect(now: number) {
    state.count++; sound.collect();
    const cx = Math.round(state.targetX / ROOM), cz = Math.round(state.targetZ / ROOM);
    const direction = Math.floor(hash(state.count, cx + cz, state.seed) * 4);
    const dirs = [[0, -1], [1, 0], [0, 1], [-1, 0]];
    state.targetX = (cx + dirs[direction][0]) * ROOM; state.targetZ = (cz + dirs[direction][1]) * ROOM;
    el('toast').textContent = `残響 ${String(state.count).padStart(2, '0')} — 次の光が呼んでいる`;
    toastUntil = now + 4200; save();
  }
  function render(now: number) {
    frame = requestAnimationFrame(render);
    if (document.hidden) { previous = now; return; }
    const dt = Math.min((now - previous) / 1000, .05); previous = now;
    if (active) {
      if (keys.has('ArrowLeft')) state.yaw += dt * 1.6;
      if (keys.has('ArrowRight')) state.yaw -= dt * 1.6;
      let forward = Number(keys.has('KeyW') || keys.has('ArrowUp')) - Number(keys.has('KeyS') || keys.has('ArrowDown')) - stickY;
      let strafe = Number(keys.has('KeyD')) - Number(keys.has('KeyA')) + stickX;
      const norm = Math.max(1, Math.hypot(forward, strafe)); forward /= norm; strafe /= norm;
      const speed = sprint || keys.has('ShiftLeft') || keys.has('ShiftRight') ? 7 : 3.6;
      const dx = (-Math.sin(state.yaw) * forward + Math.cos(state.yaw) * strafe) * speed * dt;
      const dz = (-Math.cos(state.yaw) * forward - Math.sin(state.yaw) * strafe) * speed * dt;
      const oldX = state.x, oldZ = state.z;
      if (!world.blocked(state.x + dx, state.z)) state.x += dx;
      if (!world.blocked(state.x, state.z + dz)) state.z += dz;
      const moved = Math.hypot(state.x - oldX, state.z - oldZ); travel += moved;
      location = describeRoom(Math.round(state.x/ROOM),Math.round(state.z/ROOM),state.seed);
      const key = `${location.x},${location.z}`;
      if (key !== locationKey) {
        const discovered = !(state.seen & (1 << location.index));
        state.seen |= 1 << location.index;
        locationKey = key;
        sound.space(location.place.echo);
        el('toast').textContent = `${discovered ? '初めての場所 — ' : ''}${location.place.ja} / ${location.id}`;
        toastUntil = now + 4500;
        el('place-clue').textContent = location.place.clue;
        renderNotes(); save();
      }
      if (travel > 1.7) { sound.step(location.place.surface); travel %= 1.7; }
      const distance = Math.hypot(state.targetX - state.x, state.targetZ - state.z);
      if (distance < 1.5) collect(now);
      sound.tick(location.index, Math.max(0, 1 - distance / 50));
      world.update(state.x, state.z, radius);
      const bob = motion.checked && !reducedMotion.matches && moved > .001 ? Math.sin(now * .009) * .035 : 0;
      camera.position.set(state.x, 1.7 + bob, state.z); camera.rotation.set(pitch, state.yaw, 0, 'YXZ');
      if (now - lastHud > 120) {
        el('count').textContent = String(state.count).padStart(2, '0'); el('zone').textContent = location.place.name;
        el('place-name').textContent = `${location.place.ja} / ${location.id}`;
        el('coordinates').textContent = `${Math.round(state.x)} : ${Math.round(state.z)}`;
        const targetX = guide ? guide.x*ROOM : state.targetX, targetZ = guide ? guide.z*ROOM : state.targetZ;
        const guideDistance = Math.hypot(targetX-state.x,targetZ-state.z);
        el('guide-type').textContent = guide ? 'BOOKMARK' : 'RESONANCE';
        el('distance').textContent = `${guide ? '記録した場所' : '次の残響'}まで ${Math.round(guideDistance)} m`;
        el('signal-meter').style.width = `${Math.max(2, 100 - guideDistance * 2)}%`;
        const targetAngle = Math.atan2(-(targetX - state.x), -(targetZ - state.z));
        if (guide && guideDistance < 2) { guide = undefined; el('toast').textContent = '記録した場所に戻ってきた。'; toastUntil=now+4000; }
        el('bearing').style.transform = `rotate(${state.yaw - targetAngle}rad)`;
        if (now > toastUntil) el('toast').textContent = '';
        lastHud = now;
      }
      if (now - lastSave > 5000) { save(); lastSave = now; }
    } else {
      camera.position.set(state.x, 1.7, state.z);
      camera.rotation.set(0, state.yaw + (reducedMotion.matches ? -.35 : -.35 + Math.sin(now * .00008) * .12), 0, 'YXZ');
    }
    world.ambience(state.x,state.z,dt,!reducedMotion.matches);
    ring.position.set(state.targetX, 1.8 + (reducedMotion.matches ? 0 : Math.sin(now * .0018) * .12), state.targetZ);
    ring.rotation.y = reducedMotion.matches ? 0 : now * .0006; core.rotation.z = reducedMotion.matches ? 0 : now * .0005;
    renderer.render(scene, camera);
  }
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); pause('描画が中断されました。'); start.disabled = true; status.textContent = '進行を保存しました。ページを再読み込みしてください。'; }, options);
  window.addEventListener('pagehide', () => { save(); sound.pause(); }, options);
  window.addEventListener('beforeunload', save, options);
  window.addEventListener('pageshow', e => { if (e.persisted) pause(); }, options);
  start.disabled = false; start.textContent = saved ? '続きから歩く ↗' : '空間に入る ↗';
  status.textContent = saved ? `${saved.count} 個の残響を記録しています` : 'インストール不要 / タッチ・キーボード対応';
  el('new-game').hidden = !saved;
  frame = requestAnimationFrame(render);
  document.addEventListener('astro:before-swap', () => { cancelAnimationFrame(frame); save(); abort.abort(); sound.dispose(); world.dispose(); ringGeometry.dispose(); coreGeometry.dispose(); ringMaterial.dispose(); glowTexture.dispose(); glowMaterial.dispose(); renderer.dispose(); }, { once: true });
}
