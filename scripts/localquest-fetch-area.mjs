#!/usr/bin/env node
/**
 * Dev-only: fetch one small fixed area from the public Overpass instance ONCE, compile it, validate it, and write the
 * generated world for local play. Never part of the build or the game; the game only reads the generated file.
 *
 * Raw response:    .cache/localquest/<area id>.overpass.json   (gitignored; reused, so the network is hit at most once)
 * Generated world: src/lib/localquest/generated/world.json     (gitignored)
 *
 * Map data © OpenStreetMap contributors, Open Database License (ODbL). Do not commit either file.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import Ajv from 'ajv';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
// One fixed, small area. The id is neutral and the name never reaches the compiled world.
const AREA = { id:'slice-a', name:'SLICE A', lat:35.628900, lon:139.685200, radius:400 };
const ENDPOINT = 'https://overpass-api.de/api/interpreter';
const USER_AGENT = 'aoifuture-web localquest dev fetch (one-off; https://github.com/AOI-Future/aoifuture-web)';
const rawPath = join(root, '.cache/localquest', `${AREA.id}.overpass.json`);
const outPath = join(root, 'src/lib/localquest/generated/world.json');

/** Load the TypeScript pipeline without a separate runner: bundle it in memory with esbuild (already used by Vite). */
async function pipeline() {
  const result = await build({
    stdin:{ contents:[
      "export { fromOverpass, overpassQuery } from './src/lib/backside/providers/overpass';",
      "export { compileReality } from './src/lib/backside/compile-reality';",
    ].join('\n'), resolveDir:root, loader:'ts' },
    bundle:true, format:'esm', platform:'node', write:false, logLevel:'silent',
  });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}

async function raw(query) {
  if (existsSync(rawPath)) {
    const cached = JSON.parse(await readFile(rawPath, 'utf8'));
    if (JSON.stringify(cached.area) !== JSON.stringify(AREA) || cached.query !== query) throw new Error(`${rawPath} was fetched for another area or query; remove it to fetch again`);
    console.log(`using cached ${rawPath} (no network)`);
    return cached.response;
  }
  console.log(`fetching ${AREA.id} once from ${ENDPOINT}`);
  const res = await fetch(ENDPOINT, { method:'POST', headers:{ 'User-Agent':USER_AGENT, 'Content-Type':'application/x-www-form-urlencoded' }, body:new URLSearchParams({ data:query }) });
  if (!res.ok) throw new Error(`overpass answered ${res.status} ${res.statusText}`);
  const response = await res.json();
  await mkdir(dirname(rawPath), { recursive:true });
  await writeFile(rawPath, JSON.stringify({ area:AREA, query, response }));
  return response;
}

const { fromOverpass, overpassQuery, compileReality } = await pipeline();
const snapshot = fromOverpass(await raw(overpassQuery(AREA)), AREA);
const world = compileReality(snapshot);
const schema = JSON.parse(await readFile(join(root, 'src/lib/backside/backside-world.schema.json'), 'utf8'));
const validate = new Ajv({ allErrors:true }).compile(schema);
if (!validate(world)) throw new Error(`generated world fails the schema: ${JSON.stringify(validate.errors)}`);
await mkdir(dirname(outPath), { recursive:true });
await writeFile(outPath, `${JSON.stringify(world, null, 2)}\n`);
console.log(`wrote ${outPath}: ${world.sectors.length} sectors, ${world.connections.length} connections, ${world.questAnchors.length} anchors, seed ${world.seed}`);
console.log(`${snapshot.attribution} (${snapshot.license}). Do not commit .cache/ or src/lib/localquest/generated/.`);
