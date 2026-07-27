#!/usr/bin/env node
import { mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validatePrivateGates, normalizePrivateSourceUrl } from './private-gate-validator.mjs';
import { validatePublicCatalog, validEditionId } from '../news-contract/validator.mjs';

const packetKeys = new Set(['schema_version', 'edition', 'candidates']);
const editionKeys = new Set(['edition_id', 'edition_date', 'coverage_kind', 'coverage_observed_at', 'generated_at', 'published_at', 'title', 'dek', 'edition_note', 'topics']);
const packetCandidateKeys = new Set(['candidate_id', 'source_url', 'source_kind', 'language', 'published_at', 'observed_at', 'context_ids']);
const requiredPacketCandidateKeys = new Set(['candidate_id', 'source_url', 'source_kind', 'language', 'observed_at', 'context_ids']);
const topicKeys = new Set(['id', 'label_ja', 'label_en', 'description']);
const error = (code, path, message) => ({ code, path, message });
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isRfc3339DateTime = (value) => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  && !Number.isNaN(Date.parse(value))
  && new Date(`${value.slice(0, 10)}T00:00:00Z`).toISOString().slice(0, 10) === value.slice(0, 10);
const stableJson = (value) => `${JSON.stringify(sortValue(value), null, 2)}\n`;
const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const publicOutputRoots = [
  resolve(repositoryRoot, 'src/content/news'),
  resolve(repositoryRoot, 'dist/client'),
];
const sortValue = (value) => {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortValue(value[key])]));
};

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

function assertPrivateOutputDirectory(outputDirectory) {
  const resolvedOutputDirectory = resolve(outputDirectory);
  const physicalOutputDirectory = resolvePhysicalPath(resolvedOutputDirectory);
  const publicRoot = publicOutputRoots.find((root) => (
    isWithin(resolvedOutputDirectory, root) || isWithin(physicalOutputDirectory, resolvePhysicalPath(root))
  ));
  if (publicRoot) throw new TypeError(`Refusing to write review candidate beneath public output root: ${publicRoot}`);
  return resolvedOutputDirectory;
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!['--packet', '--receipts', '--decisions', '--output-dir'].includes(name) || !value || options[name]) {
      throw new TypeError('Usage: prepare-review-candidate.mjs --packet <path> --receipts <path> --decisions <path> --output-dir <directory>');
    }
    options[name] = value;
  }
  if (Object.keys(options).length !== 4) throw new TypeError('Usage: prepare-review-candidate.mjs --packet <path> --receipts <path> --decisions <path> --output-dir <directory>');
  return options;
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(resolve(path), 'utf8'));
  } catch (cause) {
    throw new TypeError(`Cannot read JSON input: ${resolve(path)} (${cause.message})`);
  }
}

function validatePacket(packet) {
  const errors = [];
  if (!isObject(packet)) return [error('schema', '', 'packet must be an object')];
  for (const key of Object.keys(packet)) if (!packetKeys.has(key)) errors.push(error('schema', `/${key}`, 'unknown field'));
  for (const key of packetKeys) if (!Object.hasOwn(packet, key)) errors.push(error('schema', `/${key}`, 'is required'));
  if (packet.schema_version !== 'aoi.news.private-candidate-packet.v1') errors.push(error('schema', '/schema_version', 'must equal the private packet version'));
  if (!isObject(packet.edition)) errors.push(error('schema', '/edition', 'must be an object'));
  else {
    for (const key of Object.keys(packet.edition)) if (!editionKeys.has(key)) errors.push(error('schema', `/edition/${key}`, 'unknown field'));
    for (const key of ['edition_id', 'edition_date', 'coverage_kind', 'coverage_observed_at', 'generated_at', 'published_at', 'title', 'topics']) {
      if (!Object.hasOwn(packet.edition, key)) errors.push(error('schema', `/edition/${key}`, 'is required'));
    }
    if (!validEditionId(packet.edition.edition_id) || packet.edition.edition_date !== packet.edition.edition_id.slice(0, 10)) errors.push(error('edition_date_coherence', '/edition/edition_date', 'must match the valid edition ID date'));
    if (packet.edition.coverage_kind !== 'selection-snapshot') errors.push(error('schema', '/edition/coverage_kind', 'must be selection-snapshot'));
    if (!Array.isArray(packet.edition.topics) || packet.edition.topics.length === 0) errors.push(error('schema', '/edition/topics', 'must contain at least one topic'));
    else packet.edition.topics.forEach((topic, index) => {
      if (!isObject(topic)) return errors.push(error('schema', `/edition/topics/${index}`, 'must be an object'));
      for (const key of Object.keys(topic)) if (!topicKeys.has(key)) errors.push(error('schema', `/edition/topics/${index}/${key}`, 'unknown field'));
    });
  }
  if (!Array.isArray(packet.candidates) || packet.candidates.length === 0) errors.push(error('schema', '/candidates', 'must contain at least one candidate'));
  else packet.candidates.forEach((candidate, index) => {
    if (!isObject(candidate)) return errors.push(error('schema', `/candidates/${index}`, 'must be an object'));
    for (const key of Object.keys(candidate)) if (!packetCandidateKeys.has(key)) errors.push(error('schema', `/candidates/${index}/${key}`, 'unknown field'));
    for (const key of requiredPacketCandidateKeys) if (!Object.hasOwn(candidate, key)) errors.push(error('schema', `/candidates/${index}/${key}`, 'is required'));
    if (Object.hasOwn(candidate, 'published_at') && !isRfc3339DateTime(candidate.published_at)) {
      errors.push(error('schema', `/candidates/${index}/published_at`, 'must be an RFC 3339 date-time'));
    }
  });
  return errors;
}

function prepareReviewCandidate(packet, receipts, decisions) {
  const errors = validatePacket(packet);
  const gates = validatePrivateGates({
    candidates: Array.isArray(packet?.candidates) ? packet.candidates.map(({ candidate_id, source_url, source_kind }) => ({ candidate_id, source_url, source_kind })) : [],
    receipts,
    decisions,
  });
  errors.push(...gates.errors);
  if (errors.length) return { ok: false, errors };

  const receiptByCandidate = new Map(receipts.map((receipt) => [receipt.candidate_id, receipt]));
  const decisionByCandidate = new Map(decisions.map((decision) => [decision.candidate_id, decision]));
  const topicIds = new Set(packet.edition.topics.map((topic) => topic.id));
  const items = packet.candidates.map((candidate) => {
    const receipt = receiptByCandidate.get(candidate.candidate_id);
    const decision = decisionByCandidate.get(candidate.candidate_id);
    if (!decision.topics.every((topic) => topicIds.has(topic))) errors.push(error('unresolved_topic_reference', `/candidates/${candidate.candidate_id}/topics`, 'editorial topic must exist in the packet edition topics'));
    const sourceUrl = normalizePrivateSourceUrl(candidate.source_url);
    return {
      id: candidate.candidate_id,
      title: decision.public_fields.title,
      source_url: sourceUrl,
      source_title: decision.public_fields.source_title,
      source_domain: new URL(sourceUrl).hostname.toLowerCase(),
      source_kind: candidate.source_kind,
      language: candidate.language,
      ...(candidate.published_at ? { published_at: candidate.published_at } : {}),
      observed_at: candidate.observed_at,
      context_ids: candidate.context_ids,
      change: { kind: 'new' },
      source_fact: decision.public_fields.source_fact,
      selection_reason: decision.public_fields.selection_reason,
      aoi_note: decision.public_fields.aoi_note,
      ...(decision.public_fields.caveat ? { caveat: decision.public_fields.caveat } : {}),
      topics: decision.topics,
      role: decision.role,
      verification: { status: 'verified', checked_at: receipt.checked_at },
    };
  });
  const reviewCandidate = {
    schema_version: 'aoi.news.review-candidate.v1',
    publication_status: 'review-only',
    edition: {
      schema_version: 'aoi.news.edition.v1',
      edition_id: packet.edition.edition_id,
      edition_date: packet.edition.edition_date,
      coverage_kind: 'selection-snapshot',
      coverage_observed_at: packet.edition.coverage_observed_at,
      publication_status: 'review-only',
      generated_at: packet.edition.generated_at,
      published_at: packet.edition.published_at,
      title: packet.edition.title,
      ...(packet.edition.dek ? { dek: packet.edition.dek } : {}),
      ...(packet.edition.edition_note ? { edition_note: packet.edition.edition_note } : {}),
      items,
      topics: packet.edition.topics,
    },
  };
  const catalog = validatePublicCatalog([reviewCandidate.edition], []);
  errors.push(...catalog.errors);
  return errors.length ? { ok: false, errors } : { ok: true, candidate: reviewCandidate };
}

function writeAtomically(outputDirectory, candidate) {
  const resolvedOutputDirectory = assertPrivateOutputDirectory(outputDirectory);
  const outputPath = join(resolvedOutputDirectory, 'review-candidate.json');
  const temporaryPath = `${outputPath}.${process.pid}.tmp`;
  mkdirSync(dirname(outputPath), { recursive: true });
  assertPrivateOutputDirectory(outputDirectory);
  try {
    writeFileSync(temporaryPath, stableJson(candidate), { encoding: 'utf8', flag: 'wx' });
    renameSync(temporaryPath, outputPath);
  } finally {
    rmSync(temporaryPath, { force: true });
  }
  return outputPath;
}

export { prepareReviewCandidate, stableJson };

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const options = parseArguments(process.argv.slice(2));
    const result = prepareReviewCandidate(readJson(options['--packet']), readJson(options['--receipts']), readJson(options['--decisions']));
    if (!result.ok) throw new TypeError(`Review candidate validation failed: ${JSON.stringify(result.errors)}`);
    process.stdout.write(`${writeAtomically(options['--output-dir'], result.candidate)}\n`);
  } catch (cause) {
    process.stderr.write(`${cause.message}\n`);
    process.exitCode = 1;
  }
}
