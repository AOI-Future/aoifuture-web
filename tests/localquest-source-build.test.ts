import {describe,it,expect,vi,afterEach} from 'vitest';
import {mkdtemp,rm,readFile,mkdir,writeFile} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';
import {prepareSource,PUBLISHED_SOURCE_URL} from '../scripts/localquest-prepare-source.mjs';
import {LIVE_AREA,OVERPASS_URL,areaKey,query,compileLive,readLimitedResponse} from '../src/lib/localquest/live-geography';
import {fromOverpass} from '../src/lib/backside/providers/overpass';import {isWorldShape} from '../src/lib/localquest/world-source';
import {liveFixture} from './helpers/live-geography-fixture';
const processor={LIVE_AREA,OVERPASS_URL,areaKey,query,compileLive,readLimitedResponse,fromOverpass,isWorldShape};
const roots:string[]=[];
async function root(){const r=await mkdtemp(path.join(tmpdir(),'localquest-source-'));roots.push(r);return r;}
function source(){return {...liveFixture(),license:'ODbL-1.0',attribution:'Map data © OpenStreetMap contributors',licenseUrl:'https://opendatacommons.org/licenses/odbl/',sourceUrl:'https://www.openstreetmap.org/copyright'};}
afterEach(async()=>{for(const r of roots.splice(0))await rm(r,{recursive:true,force:true});});
describe('permanent-source build lifecycle',()=>{
  it('reuses published licensed geography without Overpass, then reuses local asset',async()=>{
    const r=await root(),raw=source(),fetcher=vi.fn(async(_url:string)=>Response.json(raw));
    expect((await prepareSource({root:r,processor,fetcher})).origin).toBe('published Vercel snapshot');
    expect(fetcher).toHaveBeenCalledTimes(1);expect(fetcher.mock.calls[0][0]).toBe(PUBLISHED_SOURCE_URL);
    expect(JSON.parse(await readFile(path.join(r,'public/localquest/source-area.json'),'utf8'))).toEqual(raw);
    expect((await prepareSource({root:r,processor,fetcher})).origin).toBe('local asset');expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('bootstraps once if the permanent source is not yet published',async()=>{
    const r=await root(),fetcher=vi.fn(async(url:string)=>url===PUBLISHED_SOURCE_URL?new Response('',{status:404}):Response.json(liveFixture()));
    expect((await prepareSource({root:r,processor,fetcher})).origin).toBe('Overpass bootstrap');
    expect(fetcher.mock.calls.map(c=>c[0])).toEqual([PUBLISHED_SOURCE_URL,OVERPASS_URL]);
    expect(JSON.parse(await readFile(path.join(r,'public/localquest/source-area.json'),'utf8')).license).toBe('ODbL-1.0');
  });
  it('does not publish a malformed/partial remote snapshot',async()=>{
    const r=await root(),bad={...source(),remark:'runtime error: timeout'},fetcher=vi.fn(async(url:string)=>url===PUBLISHED_SOURCE_URL?Response.json(bad):new Response('',{status:429}));
    await expect(prepareSource({root:r,processor,fetcher})).rejects.toThrow('HTTP 429');
    await expect(readFile(path.join(r,'public/localquest/source-area.json'))).rejects.toHaveProperty('code','ENOENT');
  });
  it('rejects existing mismatched data without modifying it or fetching',async()=>{
    const r=await root(),out=path.join(r,'public/localquest/source-area.json'),raw=JSON.stringify({...source(),aoiArea:'other area'});
    await mkdir(path.dirname(out),{recursive:true});await writeFile(out,raw);const fetcher=vi.fn();
    await expect(prepareSource({root:r,processor,fetcher})).rejects.toThrow('area/query mismatch');
    expect(await readFile(out,'utf8')).toBe(raw);expect(fetcher).not.toHaveBeenCalled();
  });
});
