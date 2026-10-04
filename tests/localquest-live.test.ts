import {describe,it,expect,vi} from 'vitest';
import {cachedGeography,compileLive,loadGeography,GEO_CACHE_KEY,MAX_RESPONSE_BYTES} from '../src/lib/localquest/live-geography';
import {liveFixture} from './helpers/live-geography-fixture';
const now=1800000000000;
function store(){const m=new Map<string,string>();return {getItem:(k:string)=>m.get(k)??null,setItem:(k:string,v:string)=>{m.set(k,v);}};}
const ok=()=>new Response(JSON.stringify(liveFixture()),{status:200});
describe('live geography without LLM',()=>{
  it('fetches once, compiles deterministically, and reuses the cache',async()=>{
    const s=store(),fetcher=vi.fn(async()=>ok());
    const first=await loadGeography({store:s,fetcher,now});
    expect(first.cached).toBe(false);const a=compileLive(first.snapshot);
    expect(a.sectors.length).toBeGreaterThan(2);expect(a.sourceArea.id).toBe('real:live-gakugeidai');
    const second=await loadGeography({store:s,fetcher,now:now+5000});
    expect(second.cached).toBe(true);expect(compileLive(second.snapshot)).toEqual(a);expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.length).toBe(2);
  });
  it('rejects partial responses without caching, and enforces retry delay',async()=>{
    const s=store(),fetcher=vi.fn(async()=>new Response(JSON.stringify({...liveFixture(),remark:'runtime error'})));
    await expect(loadGeography({store:s,fetcher,now})).rejects.toThrow(/remark/);
    expect(s.getItem(GEO_CACHE_KEY)).toBeNull();
    await expect(loadGeography({store:s,fetcher,now:now+1000})).rejects.toThrow(/1分/);expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('rejects oversized responses and HTTP failures',async()=>{
    const s=store();await expect(loadGeography({store:s,now,fetcher:async()=>new Response('x'.repeat(MAX_RESPONSE_BYTES+1))})).rejects.toThrow(/1MB/);
    await expect(loadGeography({store:store(),now,fetcher:async()=>new Response('',{status:429})})).rejects.toThrow(/429/);
  });
  it('cancels an in-flight fetch on caller abort without caching',async()=>{
    const s=store(),controller=new AbortController();let started!:()=>void;
    const ready=new Promise<void>(r=>{started=r;});
    const fetcher:typeof fetch=async(_url,options)=>new Promise((_resolve,reject)=>{
      options!.signal!.addEventListener('abort',()=>reject(options!.signal!.reason),{once:true});started();
    });
    const pending=loadGeography({store:s,fetcher,now,signal:controller.signal});
    await ready;controller.abort();await expect(pending).rejects.toHaveProperty('name','AbortError');
    expect(s.getItem(GEO_CACHE_KEY)).toBeNull();
  });
  it('cancels a pending response reader',async()=>{
    const s=store(),controller=new AbortController();let cancelled=false,started!:()=>void;
    const ready=new Promise<void>(r=>{started=r;});
    const response=new Response(new ReadableStream({pull(){started();},cancel(){cancelled=true;}},{highWaterMark:0}));
    const pending=loadGeography({store:s,fetcher:async()=>response,now,signal:controller.signal});
    await ready;controller.abort();await expect(pending).rejects.toHaveProperty('name','AbortError');
    expect(cancelled).toBe(true);expect(s.getItem(GEO_CACHE_KEY)).toBeNull();
  });
  it('rejects malformed cache and supports stale snapshot restoration without a network request',async()=>{
    const s=store();s.setItem(GEO_CACHE_KEY,'{bad');expect(cachedGeography(s,now)).toBeUndefined();
    await loadGeography({store:s,fetcher:async()=>ok(),now});
    expect(cachedGeography(s,now+86400001)).toBeUndefined();
    expect(cachedGeography(s,now+86400001,true)).toBeDefined();
  });
});
