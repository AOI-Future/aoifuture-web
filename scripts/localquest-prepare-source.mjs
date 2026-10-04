#!/usr/bin/env node
/** One tiny developer/build acquisition; public players read the deployed snapshot, NEVER Overpass.
 * Map data © OpenStreetMap contributors (ODbL). This asset is distributed with attribution/source access, but NEVER committed. */
import {build} from 'esbuild';import {mkdir,readFile,writeFile} from 'node:fs/promises';import {existsSync} from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'..');
const bundle=await build({stdin:{contents:"export {LIVE_AREA,OVERPASS_URL,areaKey,query,compileLive,readLimitedResponse} from './src/lib/localquest/live-geography';export {fromOverpass} from './src/lib/backside/providers/overpass';export {isWorldShape} from './src/lib/localquest/world-source';",resolveDir:root,loader:'ts'},bundle:true,platform:'node',format:'esm',write:false});
const p=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const out=path.join(root,'public/localquest/source-area.json'),cache=path.join(root,'.cache/localquest-source.json');
let raw;
if(existsSync(out))raw=JSON.parse(await readFile(out,'utf8'));
else if(existsSync(cache))raw=JSON.parse(await readFile(cache,'utf8'));
else {
  console.log('Acquire fixed 400m OSM area once for deployment; no runtime/provider/LLM requests by visitors.');
  const response=await fetch(p.OVERPASS_URL,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'aoifuture-web small fixed-area public trial (https://github.com/AOI-Future/aoifuture-web)'},body:new URLSearchParams({data:p.query}),signal:AbortSignal.timeout(35000)});
  if(!response.ok)throw Error('Overpass acquisition HTTP '+response.status);
  raw=await p.readLimitedResponse(response);
  raw={...raw,aoiArea:p.areaKey,aoiQuery:p.query,license:'ODbL-1.0',attribution:'Map data © OpenStreetMap contributors',licenseUrl:'https://opendatacommons.org/licenses/odbl/',sourceUrl:'https://www.openstreetmap.org/copyright'};
}
if(raw.aoiArea!==p.areaKey||raw.aoiQuery!==p.query)throw Error('Existing source snapshot is for another area/query; do not overwrite it.');
if(raw.license!=='ODbL-1.0'||raw.sourceUrl!=='https://www.openstreetmap.org/copyright')throw Error('Missing OSM license/source metadata');
if(!Array.isArray(raw.elements)||raw.elements.length>15000)throw Error('Invalid/oversize source');
const snapshot=p.fromOverpass(raw,p.LIVE_AREA),world=p.compileLive(snapshot);
if(snapshot.ways.length>2000||!p.isWorldShape(world))throw Error('Invalid or oversized compiled source');
const bytes=JSON.stringify(raw);if(Buffer.byteLength(bytes)>1024*1024)throw Error('Snapshot exceeds 1MB');
await mkdir(path.dirname(out),{recursive:true});await mkdir(path.dirname(cache),{recursive:true});
if(!existsSync(cache))await writeFile(cache,bytes,{flag:'wx'});
if(!existsSync(out))await writeFile(out,bytes,{flag:'wx'});
console.log(`OSM source snapshot ready: ${snapshot.nodes.length} nodes / ${snapshot.ways.length} ways; ${world.sectors.length} finite sectors. Source/ODbL download included. No generated world stored.`);
