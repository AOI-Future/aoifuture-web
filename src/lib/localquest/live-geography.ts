import { fromOverpass, overpassQuery, type OverpassResponse } from '../backside/providers/overpass';
import { compileReality } from '../backside/compile-reality';
import type { GeoSnapshot } from '../backside/reality';

/** Public trial: one fixed area. Public geodata snapshot is acquired at build time; visitors never query Overpass. */
export const LIVE_AREA={id:'live-gakugeidai',name:'学芸大学駅周辺',lat:35.6289,lon:139.6852,radius:400};
export const OVERPASS_URL='https://overpass-api.de/api/interpreter';
export const SOURCE_URL='/localquest/source-area.json';
export const GEO_CACHE_KEY='aoi.localquest.geography.v1';
export const GEO_COOLDOWN_KEY='aoi.localquest.geography.request-at';
export const MAX_RESPONSE_BYTES=1024*1024;
const TTL=24*60*60*1000, COOLDOWN=60000;
type Store=Pick<Storage,'getItem'|'setItem'>;
export const areaKey=JSON.stringify(LIVE_AREA),query=overpassQuery(LIVE_AREA);
function parseResponse(raw:unknown):GeoSnapshot {
  const r=raw as OverpassResponse & {aoiArea?:string;aoiQuery?:string};
  if(r?.aoiArea!==areaKey||r?.aoiQuery!==query)throw Error('公開snapshotの対象範囲が一致しません。');
  if(!r||!Array.isArray(r.elements)||r.elements.length>15000) throw Error('地理データが大きすぎるか不正です。');
  const snapshot=fromOverpass(r,LIVE_AREA);
  if(snapshot.ways.length>2000) throw Error('道路数が試験上限を超えました。');
  return snapshot;
}
export function cachedGeography(store:Store,now=Date.now(),allowStale=false):GeoSnapshot|undefined {
  try {
    const text=store.getItem(GEO_CACHE_KEY);if(!text||text.length>MAX_RESPONSE_BYTES) return;
    const r=JSON.parse(text);
    if(r.area!==areaKey||r.query!==query||!Number.isFinite(r.at)||r.at>now||(!allowStale&&now-r.at>TTL)) return;
    return parseResponse(r.response);
  } catch {return;}
}
export function compileLive(snapshot:GeoSnapshot) {
  return compileReality(snapshot,{maxJunctions:24,maxPois:8});
}
export async function loadGeography({store,fetcher=fetch,now=Date.now(),signal}:{store:Store;fetcher?:typeof fetch;now?:number;signal?:AbortSignal}) {
  signal?.throwIfAborted();
  const cached=cachedGeography(store,now);if(cached) return {snapshot:cached,cached:true};
  let previous=0;try {previous=Number(store.getItem(GEO_COOLDOWN_KEY))||0;}catch{}
  if(previous>0&&now-previous<COOLDOWN) throw Error('取得は1分に1回までです。少し待って再試行してください。');
  try {store.setItem(GEO_COOLDOWN_KEY,String(now));}catch{}
  const controller=new AbortController(),forward=()=>controller.abort(signal?.reason);
  signal?.addEventListener('abort',forward,{once:true});
  const timer=setTimeout(()=>controller.abort(new DOMException('地理snapshot読込タイムアウト','TimeoutError')),35000);
  try {
    const response=await fetcher(SOURCE_URL,{signal:controller.signal});
    controller.signal.throwIfAborted();
    if(!response.ok) throw Error(`地理取得に失敗しました（HTTP ${response.status}）。`);
    const raw=await readLimitedResponse(response,controller.signal);controller.signal.throwIfAborted();
    const snapshot=parseResponse(raw);compileLive(snapshot);
    try {store.setItem(GEO_CACHE_KEY,JSON.stringify({area:areaKey,query,at:now,response:raw}));}catch{}
    return {snapshot,cached:false};
  } finally {clearTimeout(timer);signal?.removeEventListener('abort',forward);}
}
export async function readLimitedResponse(response:Response,signal?:AbortSignal):Promise<unknown> {
  const reader=response.body?.getReader();if(!reader) throw Error('地理応答を読み取れません。');
  const chunks:Uint8Array[]=[];let bytes=0;
  const cancel=()=>{void reader.cancel(signal?.reason).catch(()=>{});};
  signal?.addEventListener('abort',cancel,{once:true});
  try {for(;;){signal?.throwIfAborted();const {value,done}=await reader.read();signal?.throwIfAborted();if(done)break;bytes+=value.byteLength;if(bytes>MAX_RESPONSE_BYTES)throw Error('地理応答が1MBの試験上限を超えました。');chunks.push(value);}}
  catch(e){await reader.cancel().catch(()=>{});throw e;}finally{signal?.removeEventListener('abort',cancel);reader.releaseLock();}
  const buffer=new Uint8Array(bytes);let offset=0;for(const c of chunks){buffer.set(c,offset);offset+=c.length;}
  return JSON.parse(new TextDecoder().decode(buffer));
}
