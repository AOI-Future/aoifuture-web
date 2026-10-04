#!/usr/bin/env node
/** Licensed geodata snapshot only, never a precompiled world or committed OSM data.
 * Reuse local/build cache, then the existing public Vercel snapshot. Only bootstrap
 * from a checksum-pinned licensed artifact if needed. No build/player Overpass queries. */
import {build} from 'esbuild';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

export const PUBLISHED_SOURCE_URL='https://aoifuture.com/localquest/source-area.json';
export const BOOTSTRAP_SOURCE_URL='https://github.com/AOI-Future/aoifuture-web/releases/download/localquest-source-2026-10-04/source-area.json';
export const BOOTSTRAP_SOURCE_SHA='ea4db426def4300fb74f715721b9d8d37964bac6b940077c9ca10313ed9cc7cd';
const metadata={license:'ODbL-1.0',attribution:'Map data © OpenStreetMap contributors',licenseUrl:'https://opendatacommons.org/licenses/odbl/',sourceUrl:'https://www.openstreetmap.org/copyright'};

async function loadProcessor(root) {
  const bundle=await build({stdin:{contents:"export {LIVE_AREA,areaKey,query,compileLive,readLimitedResponse} from './src/lib/localquest/live-geography';export {fromOverpass} from './src/lib/backside/providers/overpass';export {isWorldShape} from './src/lib/localquest/world-source';",resolveDir:root,loader:'ts'},bundle:true,platform:'node',format:'esm',write:false});
  return import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
}

function validate(raw,p) {
  if(raw?.aoiArea!==p.areaKey||raw?.aoiQuery!==p.query)throw Error('Source snapshot area/query mismatch; do not overwrite existing local data.');
  if(raw.license!==metadata.license||raw.attribution!==metadata.attribution||raw.sourceUrl!==metadata.sourceUrl||raw.licenseUrl!==metadata.licenseUrl)throw Error('Missing OSM license/source metadata');
  if(!Array.isArray(raw.elements)||raw.elements.length>15000)throw Error('Invalid/oversize source');
  const snapshot=p.fromOverpass(raw,p.LIVE_AREA);
  if(snapshot.ways.length>2000)throw Error('Oversized source ways');
  const world=p.compileLive(snapshot);
  if(!p.isWorldShape(world))throw Error('Invalid compiled source');
  const bytes=JSON.stringify(raw);if(Buffer.byteLength(bytes)>1024*1024)throw Error('Snapshot exceeds 1MB');
  return {snapshot,world,bytes};
}

export async function prepareSource({root,processor,fetcher=fetch,bootstrapSha=BOOTSTRAP_SOURCE_SHA}) {
  const p=processor??await loadProcessor(root);
  const out=path.join(root,'public/localquest/source-area.json'),cache=path.join(root,'.cache/localquest-source.json');
  let raw,origin;
  // Local files are authoritative: refuse invalid ones instead of replacing them.
  if(existsSync(out)){raw=JSON.parse(await readFile(out,'utf8'));origin='local asset';}
  else if(existsSync(cache)){raw=JSON.parse(await readFile(cache,'utf8'));origin='local cache';}
  else {
    try {
      const response=await fetcher(PUBLISHED_SOURCE_URL,{signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw Error('Published source unavailable');
      raw=await p.readLimitedResponse(response);validate(raw,p);origin='published Vercel snapshot';
    } catch {
      // Fixed immutable-input artifact, one bounded GET; fail closed on digest/validation errors.
      const response=await fetcher(BOOTSTRAP_SOURCE_URL,{signal:AbortSignal.timeout(35000)});
      if(!response.ok)throw Error('Licensed bootstrap HTTP '+response.status);
      raw=await p.readLimitedResponse(response);
      if(createHash('sha256').update(JSON.stringify(raw)).digest('hex')!==bootstrapSha)throw Error('Bootstrap snapshot checksum mismatch');
      validate(raw,p);origin='pinned licensed bootstrap snapshot';
    }
  }
  const {snapshot,world,bytes}=validate(raw,p);
  await mkdir(path.dirname(out),{recursive:true});await mkdir(path.dirname(cache),{recursive:true});
  if(!existsSync(cache))await writeFile(cache,bytes,{flag:'wx'});
  if(!existsSync(out))await writeFile(out,bytes,{flag:'wx'});
  console.log(`OSM source ready (${origin}): ${snapshot.nodes.length} nodes / ${snapshot.ways.length} ways; ${world.sectors.length} finite sectors. ODbL source download included; no generated world stored.`);
  return {origin,nodes:snapshot.nodes.length,ways:snapshot.ways.length,sectors:world.sectors.length};
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href) {
  await prepareSource({root:path.join(path.dirname(fileURLToPath(import.meta.url)),'..')});
}
