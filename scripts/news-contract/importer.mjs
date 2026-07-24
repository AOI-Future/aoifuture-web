import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
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
  if (existsSync(written[0])) {
    let existing;
    try {
      existing = JSON.parse(readFileSync(written[0], 'utf8'));
    } catch {
      return {
        ok: false,
        errors: [{ code: 'edition_route_collision', path: '/edition/edition_id', message: `Edition route destination is unreadable: ${written[0]}` }],
        written: [],
      };
    }
    if (existing.edition_id !== bundle.edition.edition_id) {
      return {
        ok: false,
        errors: [{ code: 'edition_route_collision', path: '/edition/edition_id', message: `Edition route destination is owned by ${String(existing.edition_id)}` }],
        written: [],
      };
    }
  }
  atomicWrite(written[0], stableJson(bundle.edition));
  bundle.contexts.forEach((context, index) => atomicWrite(written[index + 1], stableJson(context)));
  return { ok: true, errors: [], written };
}
