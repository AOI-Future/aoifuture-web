#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { importNewsBundle } from './news-contract/importer.mjs';

const args = process.argv.slice(2);
const inputIndex = args.indexOf('--input');
const outputIndex = args.indexOf('--output');
if (inputIndex === -1 || outputIndex === -1 || !args[inputIndex + 1] || !args[outputIndex + 1]) {
  console.error('Usage: node scripts/import-news-contract.mjs --input <bundle.json> --output <staging-directory>');
  process.exit(2);
}

let bundle;
try {
  bundle = JSON.parse(readFileSync(resolve(args[inputIndex + 1]), 'utf8'));
} catch (cause) {
  console.error(JSON.stringify({ ok: false, errors: [{ code: 'input_read', path: args[inputIndex + 1], message: cause.message }] }, null, 2));
  process.exit(2);
}

const imported = importNewsBundle(bundle, resolve(args[outputIndex + 1]));
console.log(JSON.stringify(imported, null, 2));
if (!imported.ok) process.exit(1);
