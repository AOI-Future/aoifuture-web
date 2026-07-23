import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { normalizeEditionForImport, validatePublicationBundle } from './validator.mjs';

const stableValue = (value) => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
};

export const stableJson = (value) => `${JSON.stringify(stableValue(value), null, 2)}\n`;

function atomicWrite(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}`;
  try {
    writeFileSync(temporary, content, { encoding: 'utf8', flag: 'wx' });
    renameSync(temporary, path);
  } finally {
    rmSync(temporary, { force: true });
  }
}

export function importNewsBundle(rawBundle, outputDirectory) {
  const bundle = structuredClone(rawBundle);
  bundle.edition = normalizeEditionForImport(bundle.edition);
  const validation = validatePublicationBundle(bundle);
  if (!validation.ok) return { ...validation, written: [] };

  const written = [
    join(outputDirectory, 'editions', `${bundle.edition.edition_id}.json`),
    ...bundle.contexts.map((context) => join(outputDirectory, 'contexts', `${context.slug}.json`)),
  ];
  atomicWrite(written[0], stableJson(bundle.edition));
  bundle.contexts.forEach((context, index) => atomicWrite(written[index + 1], stableJson(context)));
  return { ok: true, errors: [], written };
}
