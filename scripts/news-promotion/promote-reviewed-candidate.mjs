#!/usr/bin/env node
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, linkSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { validateDocument, validatePublicCatalog } from '../news-contract/validator.mjs';

const error = (code, path, message) => ({ code, path, message });
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const privatePatterns = [
  /\bcandidate_id\b/i,
  /\bnormalized_source_url\b/i,
  /\bclaim_locator\b/i,
  /\breviewed_by\b/i,
  /\bdecision_reason\b/i,
  /\bsource_body\b/i,
  /\braw_source_text\b/i,
  /\barticle_text\b/i,
  /\/(?:Users|private|tmp|var\/folders)\//i,
  /\bfile:\/\//i,
  /\b[A-Z]:\\/i,
  /\bcontent-radar\b/i,
];

const stableValue = (value) => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
};
const stableJson = (value) => `${JSON.stringify(stableValue(value), null, 2)}\n`;
const candidateHash = (candidate) => createHash('sha256').update(stableJson(candidate)).digest('hex');
const sortedResult = (errors) => ({ ok: errors.length === 0, errors: errors.sort((a, b) => a.path.localeCompare(b.path) || a.code.localeCompare(b.code) || a.message.localeCompare(b.message)) });

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const name = argv[index];
    const value = argv[index + 1];
    if (!['--candidate', '--approval', '--catalog-dir'].includes(name) || !value || options[name]) {
      throw new TypeError('Usage: promote-reviewed-candidate.mjs --candidate <review-candidate.json> --approval <public-promotion-approval.json> --catalog-dir <src/content/news>');
    }
    options[name] = value;
  }
  if (Object.keys(options).length !== 3) throw new TypeError('Usage: promote-reviewed-candidate.mjs --candidate <review-candidate.json> --approval <public-promotion-approval.json> --catalog-dir <src/content/news>');
  return options;
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(resolve(path), 'utf8'));
  } catch (cause) {
    throw new TypeError(`Cannot read JSON input: ${resolve(path)} (${cause.message})`);
  }
}

function jsonFiles(directory, errors) {
  if (!existsSync(directory)) return [];
  try {
    return readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => join(directory, entry.name))
      .sort();
  } catch (cause) {
    errors.push(error('catalog_read', directory, `cannot read catalog directory: ${cause.message}`));
    return [];
  }
}

function readCatalog(catalogDirectory) {
  const errors = [];
  const catalog = { editions: [], contexts: [], events: [] };
  for (const [kind, directory] of Object.entries({
    editions: join(catalogDirectory, 'editions'),
    contexts: join(catalogDirectory, 'contexts'),
    events: join(catalogDirectory, 'events'),
  })) {
    for (const path of jsonFiles(directory, errors)) {
      try {
        const value = JSON.parse(readFileSync(path, 'utf8'));
        if (kind === 'events') {
          if (!Array.isArray(value)) errors.push(error('event_history_shape', path, 'event history file must contain an array'));
          else catalog.events.push(...value.map((event, index) => ({ event, path: `${path}/${index}` })));
        } else catalog[kind].push({ value, path });
      } catch (cause) {
        errors.push(error('catalog_read', path, `cannot parse catalog JSON: ${cause.message}`));
      }
    }
  }
  return { catalog, errors };
}

function privateInputErrors(value) {
  const serialized = stableJson(value);
  return privatePatterns
    .filter((pattern) => pattern.test(serialized))
    .map((pattern) => error('private_field', '', `review candidate contains a forbidden private marker: ${pattern}`));
}

function validateEventHistory(events, editions) {
  const errors = [];
  const eventIds = new Set();
  const revisionsByEdition = new Map();
  const editionIds = new Set(editions.map((edition) => edition.edition_id));
  for (const { event, path } of events) {
    const schema = validateDocument('editionEvent', event, path);
    errors.push(...schema.errors);
    if (!schema.ok) continue;
    if (eventIds.has(event.event_id)) errors.push(error('duplicate_event_id', `${path}/event_id`, 'event ID is globally reused'));
    eventIds.add(event.event_id);
    if (!editionIds.has(event.edition_id)) errors.push(error('orphan_event_edition', `${path}/edition_id`, 'event references an unknown Edition'));
    const revisions = revisionsByEdition.get(event.edition_id) ?? new Set();
    if (revisions.has(event.revision)) errors.push(error('duplicate_event_revision', `${path}/revision`, 'edition event revision is duplicated'));
    revisions.add(event.revision);
    revisionsByEdition.set(event.edition_id, revisions);
  }
  for (const [editionId, revisions] of revisionsByEdition) {
    for (let revision = 1; revision <= revisions.size; revision += 1) {
      if (!revisions.has(revision)) errors.push(error('event_revision_gap', `/events/${editionId}`, 'event revisions must begin at 1 and be contiguous'));
    }
  }
  return errors;
}

function promotionArtifacts(candidate) {
  const edition = structuredClone(candidate.edition);
  edition.publication_status = 'public';
  const event = {
    schema_version: 'aoi.news.edition-event.v1',
    event_id: `aoi-news-${edition.edition_id}-r001`,
    edition_id: edition.edition_id,
    edition_date: edition.edition_date,
    revision: 1,
    event_kind: 'edition-published',
    title: edition.title,
    summary: edition.dek ?? edition.edition_note ?? edition.title,
    published_at: edition.published_at,
    edition_url: `https://aoifuture.com/news/${edition.edition_id}/`,
    changed_signal_ids: edition.items.map((item) => item.id).sort(),
  };
  return { edition, event };
}

function validatePromotion(candidate, approval, catalogDirectory) {
  const errors = [];
  if (approval === undefined) errors.push(error('approval_missing', '/approval', 'a separate public-promotion approval is required'));
  const candidateSchema = validateDocument('reviewCandidate', candidate, '/candidate');
  errors.push(...candidateSchema.errors);
  errors.push(...privateInputErrors(candidate));
  if (isObject(candidate) && (candidate.publication_status !== 'review-only' || candidate.edition?.publication_status !== 'review-only')) {
    errors.push(error('review_only_required', '/candidate/publication_status', 'only a review-only candidate may be promoted'));
  }
  if (candidateSchema.ok) {
    errors.push(...validatePublicCatalog([candidate.edition], []).errors);
  }
  if (approval !== undefined) {
    const approvalSchema = validateDocument('publicPromotionApproval', approval, '/approval');
    errors.push(...approvalSchema.errors);
    if (isObject(approval) && approval.target_publication_status !== 'public') {
      errors.push(error('approval_target_status', '/approval/target_publication_status', 'approval must target public status'));
    }
    if (approvalSchema.ok && candidateSchema.ok) {
      if (approval.edition_id !== candidate.edition.edition_id || approval.candidate_sha256 !== candidateHash(candidate)) {
        errors.push(error('approval_binding', '/approval', 'approval must bind this edition ID and deterministic candidate hash'));
      }
    }
  }
  if (errors.length) return { errors, artifacts: undefined };

  const { catalog, errors: catalogErrors } = readCatalog(catalogDirectory);
  errors.push(...catalogErrors);
  const publishedEditions = catalog.editions.map(({ value }) => value);
  const publishedContexts = catalog.contexts.map(({ value }) => value);
  errors.push(...validatePublicCatalog(publishedEditions, publishedContexts).errors);
  errors.push(...validateEventHistory(catalog.events, publishedEditions));
  const artifacts = promotionArtifacts(candidate);
  const matchingEditions = publishedEditions.filter((edition) => isObject(edition) && edition.edition_id === artifacts.edition.edition_id);
  const matchingEvents = catalog.events.filter(({ event }) => isObject(event) && event.event_id === artifacts.event.event_id);
  if (errors.length === 0 && matchingEditions.length === 1 && matchingEvents.length === 1
    && stableJson(matchingEditions[0]) === stableJson(artifacts.edition)
    && stableJson(matchingEvents[0].event) === stableJson(artifacts.event)) {
    return { errors, artifacts, idempotent: true };
  }
  errors.push(...validatePublicCatalog([...publishedEditions, artifacts.edition], publishedContexts).errors);
  if (matchingEditions.length) {
    errors.push(error('duplicate_edition_id', '/candidate/edition/edition_id', 'a public Edition with this ID already exists'));
  }
  if (matchingEvents.length) {
    errors.push(error('duplicate_event_id', '/event/event_id', 'a public event with this ID already exists'));
  }
  return { errors, artifacts };
}

function writeTemporary(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temporary, content, { encoding: 'utf8', flag: 'wx' });
  return temporary;
}

function commitPromotionArtifacts(outputs, commit = linkSync) {
  const staged = [];
  const committed = [];
  try {
    for (const { path, content } of outputs) staged.push({ path, temporary: writeTemporary(path, content) });
    for (const { path, temporary } of staged) {
      // link() creates the destination only when absent, avoiding rename() overwrite races.
      commit(temporary, path);
      committed.push({ path, temporary });
    }
    return { ok: true, written: committed.map(({ path }) => path) };
  } catch (cause) {
    const rollbackErrors = [];
    for (const { path, temporary } of committed.reverse()) {
      try {
        const output = statSync(path);
        const stagedOutput = statSync(temporary);
        // Only remove the hard link created by this invocation. A concurrent
        // writer may have replaced the pathname after commit succeeded.
        if (output.dev === stagedOutput.dev && output.ino === stagedOutput.ino) unlinkSync(path);
      } catch (rollbackCause) {
        rollbackErrors.push(rollbackCause.message);
      }
    }
    const message = rollbackErrors.length
      ? `failed to commit promotion output: ${cause.message}; rollback failed: ${rollbackErrors.join('; ')}`
      : `failed to commit promotion output: ${cause.message}`;
    return {
      ok: false,
      errors: [error(cause.code === 'EEXIST' ? 'tracked_output_collision' : 'promotion_commit', '', message)],
      written: [],
    };
  } finally {
    for (const { temporary } of staged) {
      rmSync(temporary, { force: true });
    }
  }
}

function promoteReviewedCandidate(candidate, approval, catalogDirectory, { commit = linkSync } = {}) {
  const resolvedDirectory = resolve(catalogDirectory);
  const { errors, artifacts, idempotent } = validatePromotion(candidate, approval, resolvedDirectory);
  if (errors.length) return { ...sortedResult(errors), written: [] };
  const editionPath = join(resolvedDirectory, 'editions', `${artifacts.edition.edition_id}.json`);
  const eventPath = join(resolvedDirectory, 'events', `${artifacts.edition.edition_id}.json`);
  if (idempotent) return { ok: true, errors: [], edition: artifacts.edition, event: artifacts.event, written: [] };
  if (existsSync(editionPath) || existsSync(eventPath)) {
    return { ok: false, errors: [error('tracked_output_collision', '', 'refusing to overwrite an existing tracked public output')], written: [] };
  }
  const committed = commitPromotionArtifacts([
    { path: editionPath, content: stableJson(artifacts.edition) },
    { path: eventPath, content: stableJson([artifacts.event]) },
  ], commit);
  if (!committed.ok) return committed;
  return { ok: true, errors: [], edition: artifacts.edition, event: artifacts.event, written: committed.written };
}

export { candidateHash, promoteReviewedCandidate, stableJson };

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const options = parseArguments(process.argv.slice(2));
    const result = promoteReviewedCandidate(readJson(options['--candidate']), readJson(options['--approval']), options['--catalog-dir']);
    if (!result.ok) throw new TypeError(`Reviewed candidate promotion failed: ${JSON.stringify(result.errors)}`);
    process.stdout.write(`${result.written.join('\n')}\n`);
  } catch (cause) {
    process.stderr.write(`${cause.message}\n`);
    process.exitCode = 1;
  }
}
