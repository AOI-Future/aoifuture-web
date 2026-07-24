#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validatePublicationBundle } from './news-contract/validator.mjs';

const input = process.argv[2];
if (!input) {
  console.error('Usage: node scripts/validate-news-contract.mjs <import-bundle.json>');
  process.exit(2);
}

let bundle;
try {
  bundle = JSON.parse(readFileSync(resolve(input), 'utf8'));
} catch (cause) {
  console.error(JSON.stringify({ ok: false, errors: [{ code: 'input_read', path: input, message: cause.message }] }, null, 2));
  process.exit(2);
}

const validation = validatePublicationBundle(bundle);
console.log(JSON.stringify(validation, null, 2));
if (!validation.ok) process.exit(1);
