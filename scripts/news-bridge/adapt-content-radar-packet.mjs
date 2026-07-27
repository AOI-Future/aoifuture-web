#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizePrivateSourceUrl } from './private-gate-validator.mjs';
import { validEditionId } from '../news-contract/validator.mjs';

const contentRadarPacketKeys = new Set(['schema', 'version', 'generated_at', 'selected_count', 'items', 'integrity']);
const contentRadarItemKeys = new Set(['source', 'observed_at', 'headline', 'summary', 'source_type', 'provenance_locator']);
const contentRadarSourceKeys = new Set(['url', 'title', 'domain', 'kind']);
const integrityKeys = new Set(['algorithm', 'content_sha256']);
const configKeys = new Set(['schema_version', 'candidate_language', 'edition']);
const editionKeys = new Set(['edition_id', 'edition_date', 'coverage_kind', 'coverage_observed_at', 'generated_at', 'published_at', 'title', 'dek', 'edition_note', 'topics']);
const topicKeys = new Set(['id', 'label_ja', 'label_en', 'description']);
const upstreamV1SourceKindByHost = new Map([
  ['arxiv.org', 'paper'],
  ['github.com', 'repository'],
]);
const languages = new Set(['ja', 'en', 'other']);
const error = (code, path, message) => ({ code, path, message });
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const validDate = (value) => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const validDateTime = (value) => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  && validDate(value.slice(0, 10))
  && !Number.isNaN(Date.parse(value));
const validText = (value, minimum, maximum, allowEmpty = false) => typeof value === 'string'
  && value.length <= maximum
  && (allowEmpty ? true : value.trim().length >= minimum);
const sortValue = (value) => {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])]));
};
const stableJson = (value) => `${JSON.stringify(sortValue(value), null, 2)}\n`;
const contentHash = (packet) => createHash('sha256')
  .update(JSON.stringify(sortValue(Object.fromEntries(Object.entries(packet).filter(([key]) => key !== 'integrity')))), 'utf8')
  .digest('hex');
const opaqueCandidateId = (sourceUrl, upstreamHash) => `cr-${createHash('sha256').update(`${sourceUrl}\n${upstreamHash}`, 'utf8').digest('hex')}`;

function addUnknownAndMissing(errors, value, expectedKeys, path) {
  if (!isObject(value)) {
    errors.push(error('schema', path, 'must be an object'));
    return false;
  }
  for (const key of Object.keys(value)) if (!expectedKeys.has(key)) errors.push(error('schema', `${path}/${key}`, 'unknown field'));
  for (const key of expectedKeys) if (!Object.hasOwn(value, key)) errors.push(error('schema', `${path}/${key}`, 'is required'));
  return true;
}

function validateContentRadarPacket(packet) {
  const errors = [];
  if (!addUnknownAndMissing(errors, packet, contentRadarPacketKeys, '')) return { errors, normalizedItems: [] };
  if (packet.schema !== 'content-radar.private-candidate-packet.v1' || packet.version !== 1) errors.push(error('schema', '/schema', 'must be Content Radar private candidate packet v1'));
  if (!validDateTime(packet.generated_at)) errors.push(error('schema', '/generated_at', 'must be an RFC 3339 date-time'));
  if (!Number.isInteger(packet.selected_count) || packet.selected_count < 1 || packet.selected_count > 1000) errors.push(error('schema', '/selected_count', 'must be an integer from 1 through 1000'));
  if (!Array.isArray(packet.items) || packet.items.length < 1 || packet.items.length > 1000) errors.push(error('schema', '/items', 'must contain from 1 through 1000 items'));
  else if (packet.selected_count !== packet.items.length) errors.push(error('schema', '/selected_count', 'must equal the item count'));

  const normalizedItems = [];
  if (Array.isArray(packet.items)) packet.items.forEach((item, index) => {
    const path = `/items/${index}`;
    if (!addUnknownAndMissing(errors, item, contentRadarItemKeys, path)) return;
    if (!addUnknownAndMissing(errors, item.source, contentRadarSourceKeys, `${path}/source`)) return;
    if (!validText(item.source.title, 1, 160)) errors.push(error('schema', `${path}/source/title`, 'must be 1 through 160 non-blank characters'));
    if (!validText(item.source.domain, 1, 253)) errors.push(error('schema', `${path}/source/domain`, 'must be 1 through 253 non-blank characters'));
    if (!validText(item.source.kind, 1, 64)) errors.push(error('schema', `${path}/source/kind`, 'must be 1 through 64 non-blank characters'));
    if (!validText(item.headline, 1, 280)) errors.push(error('schema', `${path}/headline`, 'must be 1 through 280 non-blank characters'));
    if (!validText(item.summary, 0, 600, true)) errors.push(error('schema', `${path}/summary`, 'must be a string of at most 600 characters'));
    if (!validText(item.source_type, 1, 64)) errors.push(error('schema', `${path}/source_type`, 'must be 1 through 64 non-blank characters'));
    if (!validText(item.provenance_locator, 1, 512)) errors.push(error('schema', `${path}/provenance_locator`, 'must be 1 through 512 non-blank characters'));
    if (!validDateTime(item.observed_at)) errors.push(error('schema', `${path}/observed_at`, 'must be an RFC 3339 date-time'));
    try {
      const sourceUrl = normalizePrivateSourceUrl(item.source.url);
      const sourceHost = new URL(sourceUrl).hostname.toLowerCase();
      if (sourceHost !== item.source.domain.toLowerCase()) errors.push(error('schema', `${path}/source/domain`, 'must match the source URL hostname'));
      const expectedSourceKind = upstreamV1SourceKindByHost.get(sourceHost) ?? 'unknown';
      if (item.source.kind !== expectedSourceKind) errors.push(error('source_kind_mismatch', `${path}/source/kind`, 'must match the upstream v1 exact source host mapping'));
      if (item.source.kind === 'unknown') errors.push(error('unsupported_source_kind', `${path}/source/kind`, 'unknown upstream source kinds are not accepted downstream'));
      normalizedItems.push({ sourceUrl, sourceKind: item.source.kind, observedAt: item.observed_at });
    } catch {
      errors.push(error('schema', `${path}/source/url`, 'must be a credential-free HTTPS URL'));
    }
  });

  if (!addUnknownAndMissing(errors, packet.integrity, integrityKeys, '/integrity')) return { errors, normalizedItems };
  if (packet.integrity.algorithm !== 'sha256' || typeof packet.integrity.content_sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(packet.integrity.content_sha256)) {
    errors.push(error('schema', '/integrity', 'must contain a lowercase SHA-256 content hash'));
  } else if (contentHash(packet) !== packet.integrity.content_sha256) {
    errors.push(error('integrity', '/integrity/content_sha256', 'does not match canonical packet content'));
  }

  const seenUrls = new Set();
  normalizedItems.forEach(({ sourceUrl }, index) => {
    if (seenUrls.has(sourceUrl)) errors.push(error('duplicate_source_url', `/items/${index}/source/url`, 'canonical source URL is duplicated'));
    seenUrls.add(sourceUrl);
  });
  return { errors, normalizedItems };
}

function validateConfig(config) {
  const errors = [];
  if (!addUnknownAndMissing(errors, config, configKeys, '')) return errors;
  if (config.schema_version !== 'aoi.news.content-radar-adapter-config.v1') errors.push(error('schema', '/schema_version', 'must equal the adapter config version'));
  if (!languages.has(config.candidate_language)) errors.push(error('schema', '/candidate_language', 'must be a supported language'));
  if (!isObject(config.edition)) {
    errors.push(error('schema', '/edition', 'must be an object'));
    return errors;
  }
  for (const key of Object.keys(config.edition)) if (!editionKeys.has(key)) errors.push(error('schema', `/edition/${key}`, 'unknown field'));
  for (const key of ['edition_id', 'edition_date', 'coverage_kind', 'coverage_observed_at', 'generated_at', 'published_at', 'title', 'topics']) {
    if (!Object.hasOwn(config.edition, key)) errors.push(error('schema', `/edition/${key}`, 'is required'));
  }
  if (!validEditionId(config.edition.edition_id) || config.edition.edition_date !== config.edition.edition_id?.slice(0, 10)) errors.push(error('edition_date_coherence', '/edition/edition_date', 'must match the valid edition ID date'));
  if (config.edition.coverage_kind !== 'selection-snapshot') errors.push(error('schema', '/edition/coverage_kind', 'must be selection-snapshot'));
  for (const key of ['coverage_observed_at', 'generated_at', 'published_at']) if (!validDateTime(config.edition[key])) errors.push(error('schema', `/edition/${key}`, 'must be an RFC 3339 date-time'));
  for (const [key, maximum] of [['title', 200], ['dek', 500], ['edition_note', 1000]]) if (Object.hasOwn(config.edition, key) && !validText(config.edition[key], 1, maximum)) errors.push(error('schema', `/edition/${key}`, `must be 1 through ${maximum} non-blank characters`));
  if (!Array.isArray(config.edition.topics) || config.edition.topics.length === 0) errors.push(error('schema', '/edition/topics', 'must contain at least one topic'));
  else config.edition.topics.forEach((topic, index) => {
    const path = `/edition/topics/${index}`;
    if (!isObject(topic)) return errors.push(error('schema', path, 'must be an object'));
    for (const key of Object.keys(topic)) if (!topicKeys.has(key)) errors.push(error('schema', `${path}/${key}`, 'unknown field'));
    for (const key of ['id', 'label_ja']) if (!Object.hasOwn(topic, key)) errors.push(error('schema', `${path}/${key}`, 'is required'));
    if (typeof topic.id !== 'string' || !/^[a-z0-9][a-z0-9-]{2,79}$/.test(topic.id)) errors.push(error('schema', `${path}/id`, 'must be a valid topic ID'));
    for (const [key, maximum] of [['label_ja', 100], ['label_en', 100], ['description', 500]]) if (Object.hasOwn(topic, key) && !validText(topic[key], 1, maximum)) errors.push(error('schema', `${path}/${key}`, `must be 1 through ${maximum} non-blank characters`));
  });
  return errors;
}

function adaptContentRadarPacket(packet, config) {
  const upstream = validateContentRadarPacket(packet);
  const errors = [...upstream.errors, ...validateConfig(config)];
  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    packet: {
      schema_version: 'aoi.news.private-candidate-packet.v1',
      edition: config.edition,
      candidates: upstream.normalizedItems.map((item) => ({
        candidate_id: opaqueCandidateId(item.sourceUrl, packet.integrity.content_sha256),
        source_url: item.sourceUrl,
        source_kind: item.sourceKind,
        language: config.candidate_language,
        observed_at: item.observedAt,
        context_ids: [],
      })),
    },
  };
}

function isWithin(path, root) {
  const pathFromRoot = relative(root, path);
  return pathFromRoot === '' || (!pathFromRoot.startsWith(`..${sep}`) && pathFromRoot !== '..' && !isAbsolute(pathFromRoot));
}

function resolvePhysicalPath(path) {
  const missingSegments = [];
  let existingPath = resolve(path);
  while (true) {
    try {
      return missingSegments.reduce((physicalPath, segment) => join(physicalPath, segment), realpathSync(existingPath));
    } catch (cause) {
      if (!['ENOENT', 'ENOTDIR'].includes(cause.code)) throw cause;
      const parentPath = dirname(existingPath);
      if (parentPath === existingPath) throw cause;
      missingSegments.unshift(basename(existingPath));
      existingPath = parentPath;
    }
  }
}

function assertPrivateOutputPath(outputPath, inputPaths = []) {
  const resolvedOutputPath = resolve(outputPath);
  try {
    if (lstatSync(resolvedOutputPath).isSymbolicLink()) throw new TypeError('Refusing symlink adapter output path');
  } catch (cause) {
    if (cause.code !== 'ENOENT') throw cause;
  }
  const physicalOutputPath = resolvePhysicalPath(resolvedOutputPath);
  for (const inputPath of inputPaths) {
    const resolvedInputPath = resolve(inputPath);
    if (physicalOutputPath === resolvePhysicalPath(resolvedInputPath)) throw new TypeError('Output path must not alias an input path');
    try {
      const outputStat = statSync(resolvedOutputPath);
      const inputStat = statSync(resolvedInputPath);
      if (outputStat.dev === inputStat.dev && outputStat.ino === inputStat.ino) throw new TypeError('Output path must not alias an input path');
    } catch (cause) {
      if (cause.code !== 'ENOENT') throw cause;
    }
  }
  if (isWithin(resolvedOutputPath, repositoryRoot) || isWithin(physicalOutputPath, resolvePhysicalPath(repositoryRoot))) {
    throw new TypeError('Adapter output must be outside the repository private workspace boundary');
  }
  return resolvedOutputPath;
}

function writeAtomically(outputPath, packet, inputPaths) {
  const resolvedOutputPath = assertPrivateOutputPath(outputPath, inputPaths);
  const temporaryPath = `${resolvedOutputPath}.${process.pid}.tmp`;
  mkdirSync(dirname(resolvedOutputPath), { recursive: true });
  assertPrivateOutputPath(outputPath, inputPaths);
  try {
    writeFileSync(temporaryPath, stableJson(packet), { encoding: 'utf8', flag: 'wx' });
    renameSync(temporaryPath, resolvedOutputPath);
  } finally {
    rmSync(temporaryPath, { force: true });
  }
  return resolvedOutputPath;
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!['--packet', '--config', '--output'].includes(name) || !value || options[name]) throw new TypeError('Usage: adapt-content-radar-packet.mjs --packet <path> --config <path> --output <path>');
    options[name] = value;
  }
  if (Object.keys(options).length !== 3) throw new TypeError('Usage: adapt-content-radar-packet.mjs --packet <path> --config <path> --output <path>');
  if (resolve(options['--output']) === resolve(options['--packet']) || resolve(options['--output']) === resolve(options['--config'])) throw new TypeError('Output path must not replace an input path');
  assertPrivateOutputPath(options['--output'], [options['--packet'], options['--config']]);
  return options;
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(resolve(path), 'utf8'));
  } catch (cause) {
    throw new TypeError(`Cannot read JSON input: ${resolve(path)} (${cause.message})`);
  }
}

export { adaptContentRadarPacket, stableJson };

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const options = parseArguments(process.argv.slice(2));
    const result = adaptContentRadarPacket(readJson(options['--packet']), readJson(options['--config']));
    if (!result.ok) throw new TypeError(`Content Radar packet validation failed: ${JSON.stringify(result.errors)}`);
    process.stdout.write(`${writeAtomically(options['--output'], result.packet, [options['--packet'], options['--config']])}\n`);
  } catch (cause) {
    process.stderr.write(`${cause.message}\n`);
    process.exitCode = 1;
  }
}
