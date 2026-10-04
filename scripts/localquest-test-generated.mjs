#!/usr/bin/env node
/** Network-free generated-world E2E. Never overwrite a developer's existing world or fetch OSM data. */
import { mkdir, readFile, writeFile, unlink } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import Ajv from 'ajv';

const root=join(dirname(fileURLToPath(import.meta.url)), '..');
const out=join(root,'src/lib/localquest/generated/world.json');
const bundle=await build({
  stdin:{contents:[
    "import { compileReality } from './src/lib/backside/compile-reality';",
    "import { fromOverpass } from './src/lib/backside/providers/overpass';",
    "import { gridArea, gridResponse } from './src/lib/backside/fixtures/overpass-grid';",
    'export const generate=()=>compileReality(fromOverpass(gridResponse(),gridArea));',
  ].join('\n'),resolveDir:root,loader:'ts'},
  bundle:true,format:'esm',platform:'node',write:false,logLevel:'silent',
});
const {generate}=await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].text).toString('base64')}`);
const world=generate();
assert.deepEqual(generate(),world,'fixture compilation must be deterministic');
const schema=JSON.parse(await readFile(join(root,'src/lib/backside/backside-world.schema.json'),'utf8'));
const validate=new Ajv({allErrors:true}).compile(schema);
assert.ok(validate(world),JSON.stringify(validate.errors));
const bytes=JSON.stringify(world,null,2)+'\n';
await mkdir(dirname(out),{recursive:true});
// EEXIST is intentional: preserve any real or independently generated world, even after an interrupted previous run.
await writeFile(out,bytes,{flag:'wx'});
console.log('Generated synthetic grid fixture (no provider network). Existing worlds are never overwritten.');
try {
  const child=spawn(process.execPath,[join(root,'node_modules/@playwright/test/cli.js'),'test','--config=playwright.localquest.config.ts',...process.argv.slice(2)],{
    cwd:root,stdio:'inherit',env:{...process.env,CI:'1'},
  });
  const interrupt=()=>child.kill('SIGINT'), terminate=()=>child.kill('SIGTERM');
  process.on('SIGINT',interrupt);process.on('SIGTERM',terminate);
  try {
    process.exitCode=await new Promise((resolve,reject)=>{
      child.once('error',reject);child.once('exit',(code)=>resolve(code??1));
    });
  } finally {
    process.off('SIGINT',interrupt);process.off('SIGTERM',terminate);
  }
} finally {
  // Best-effort cleanup of our byte-identical fixture, not an atomic compare-and-delete.
  // Other world writers/builds must NOT run concurrently; detectable edits are preserved.
  if(await readFile(out,'utf8')===bytes) await unlink(out);
  else {console.error('Generated world changed during the run; preserved it.');process.exitCode=1;}
}
