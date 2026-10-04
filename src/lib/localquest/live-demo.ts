import { initLocalQuest } from './game';
import { cachedGeography,compileLive,loadGeography,LIVE_AREA } from './live-geography';
import { renderSourceMap } from './source-map';
export function initLiveDemo() {
  const el=(id:string)=>document.getElementById(id)!;
  const build=el('generate-area') as HTMLButtonElement,status=el('geography-status');
  const dialog=el('source-map-dialog') as HTMLDialogElement,toggle=el('source-map-toggle') as HTMLButtonElement;
  const abort=new AbortController(),options={signal:abort.signal};
  const memory=new Map<string,string>();let store:Pick<Storage,'getItem'|'setItem'>;
  try {store=localStorage;}catch {store={getItem:k=>memory.get(k)??null,setItem:(k,v)=>{memory.set(k,v);}};}
  let cleanup:(()=>void)|undefined, busy=false;
  const install=(snapshot:Parameters<typeof compileLive>[0])=>{
    const began=performance.now(),world=compileLive(snapshot);
    cleanup?.();cleanup=initLocalQuest(world,{forceSample:false});
    if(!cleanup)throw Error('WebGL描画を開始できませんでした。');
    renderSourceMap(el('source-map') as unknown as SVGSVGElement,snapshot);toggle.hidden=false;
    el('source-map-caption').textContent=`${LIVE_AREA.name} / 半径${LIVE_AREA.radius}m / snapshot ${snapshot.fetchedAt??'時刻不明'}。道路→回廊、交差点→吹き抜け、POI→部屋。外観・実距離の再現ではありません。`;
    return `${world.sectors.length}セクター / ${world.questAnchors.length}地点 / 変換・描画準備 ${Math.round(performance.now()-began)}ms`;
  };
  const forceSample=new URLSearchParams(location.search).get('world')==='sample';
  const previous=forceSample?undefined:cachedGeography(store,Date.now(),true);
  try {if(previous)status.textContent=`前回の地理snapshotから復元。${install(previous)}`;else cleanup=initLocalQuest();}
  catch {cleanup=initLocalQuest();status.textContent='前回の地理データを復元できませんでした。再生成してください。';}
  build.addEventListener('click',async()=>{
    if(busy)return;busy=true;build.disabled=true;status.textContent='公開地理snapshotを読み込み中（最大35秒）。LLMは使用しません。';
    try {
      const {snapshot,cached}=await loadGeography({store,signal:abort.signal});
      if(abort.signal.aborted)return;
      status.textContent='接続関係を抽出し、有限の裏世界へ変換しています…';
      await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
      if(abort.signal.aborted)return;
      const stats=install(snapshot);status.textContent=`${cached?'キャッシュ再利用':'地理snapshot読込完了'}。${stats}。1クエストで試遊終了。`;
    } catch(e) {if(!abort.signal.aborted)status.textContent=`生成できませんでした：${e instanceof Error?e.message:'地理取得エラー'} 現在の空間は架空データ、または前回のsnapshotです。`;}
    finally {busy=false;if(!abort.signal.aborted)build.disabled=false;}
  },options);
  toggle.addEventListener('click',()=>{document.dispatchEvent(new Event('localquest:pause'));dialog.showModal();},options);
  el('source-map-close').addEventListener('click',()=>dialog.close(),options);
  document.addEventListener('astro:before-swap',()=>{abort.abort();cleanup?.();},{once:true,signal:abort.signal});
}
