import type {
  NewsCatalog,
  NewsContext,
  NewsEdition,
  NewsPublicationMode,
  NewsSignalReference,
} from './types';
import { validatePublicCatalog } from '../../../scripts/news-contract/validator.mjs';
import { resolveNewsPublicationMode } from './publication-mode.mjs';

const editionModules = import.meta.glob('../../content/news/editions/*.json', {
  eager: true,
  import: 'default',
});
const contextModules = import.meta.glob('../../content/news/contexts/*.json', {
  eager: true,
  import: 'default',
});

const EDITION_KEYS = new Set([
  'schema_version', 'edition_id', 'edition_date', 'generated_at', 'published_at',
  'publication_status', 'corrected_at', 'title', 'dek', 'edition_note', 'items', 'topics',
]);
const SIGNAL_KEYS = new Set([
  'id', 'title', 'source_url', 'source_title', 'source_domain', 'source_kind',
  'language', 'published_at', 'observed_at', 'context_ids', 'change', 'source_fact',
  'aoi_note', 'caveat', 'topics', 'role', 'verification', 'corrected_at', 'correction_note',
]);
const CHANGE_KEYS = new Set(['kind', 'previous_signal_ids']);
const VERIFICATION_KEYS = new Set(['status', 'checked_at']);
const TOPIC_KEYS = new Set(['id', 'label_ja', 'label_en', 'description']);
const CONTEXT_KEYS = new Set([
  'schema_version', 'id', 'slug', 'title', 'current_view', 'updated_at',
  'publication_status', 'operator_context', 'supporting_signal_ids', 'revisions',
]);
const OPERATOR_KEYS = new Set([
  'capability', 'authority', 'control', 'evidence', 'cost_route',
  'operational_impact', 'unresolved',
]);
const REVISION_KEYS = new Set([
  'id', 'changed_at', 'change_reason', 'resulting_view', 'evidence_signal_ids',
]);

function record(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, allowed: Set<string>, path: string) {
  const unexpected = Object.keys(value).filter((key) => !allowed.has(key));
  if (unexpected.length) throw new Error(`${path} has unexpected/private keys: ${unexpected.join(', ')}`);
}

function text(value: unknown, path: string): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error(`${path} must be non-empty text`);
  return value;
}

function dateTime(value: unknown, path: string): string {
  const result = text(value, path);
  if (Number.isNaN(Date.parse(result))) throw new Error(`${path} must be a date-time`);
  return result;
}

function list(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${path} must be an array`);
  return value;
}

function textList(value: unknown, path: string): string[] {
  return list(value, path).map((item, index) => text(item, `${path}[${index}]`));
}

function validateEdition(value: unknown, index: number): NewsEdition {
  const path = `editions[${index}]`;
  const edition = record(value, path);
  exactKeys(edition, EDITION_KEYS, path);
  if (edition.schema_version !== 'aoi.news.edition.v1') throw new Error(`${path}.schema_version is unsupported`);
  const editionId = text(edition.edition_id, `${path}.edition_id`);
  const editionDate = text(edition.edition_date, `${path}.edition_date`);
  if (!/^\d{4}-\d{2}-\d{2}(?:-(?:[01]\d|2[0-3])[0-5]\d)?$/.test(editionId)
    || editionDate !== editionId.slice(0, 10)) {
    throw new Error(`${path} has an invalid Edition date`);
  }
  if (!['public', 'review-only'].includes(String(edition.publication_status))) throw new Error(`${path}.publication_status is invalid`);
  dateTime(edition.generated_at, `${path}.generated_at`);
  dateTime(edition.published_at, `${path}.published_at`);
  text(edition.title, `${path}.title`);

  const items = list(edition.items, `${path}.items`);
  if (!items.length) throw new Error(`${path}.items must not be empty`);
  items.forEach((itemValue, itemIndex) => {
    const itemPath = `${path}.items[${itemIndex}]`;
    const item = record(itemValue, itemPath);
    exactKeys(item, SIGNAL_KEYS, itemPath);
    text(item.id, `${itemPath}.id`);
    text(item.title, `${itemPath}.title`);
    const sourceUrl = text(item.source_url, `${itemPath}.source_url`);
    if (!sourceUrl.startsWith('https://')) throw new Error(`${itemPath}.source_url must use HTTPS`);
    text(item.source_title, `${itemPath}.source_title`);
    text(item.source_domain, `${itemPath}.source_domain`);
    text(item.source_kind, `${itemPath}.source_kind`);
    dateTime(item.observed_at, `${itemPath}.observed_at`);
    if (item.published_at !== undefined) dateTime(item.published_at, `${itemPath}.published_at`);
    textList(item.context_ids, `${itemPath}.context_ids`);
    textList(item.topics, `${itemPath}.topics`);
    text(item.source_fact, `${itemPath}.source_fact`);
    text(item.aoi_note, `${itemPath}.aoi_note`);
    text(item.role, `${itemPath}.role`);
    const verification = record(item.verification, `${itemPath}.verification`);
    exactKeys(verification, VERIFICATION_KEYS, `${itemPath}.verification`);
    text(verification.status, `${itemPath}.verification.status`);
    dateTime(verification.checked_at, `${itemPath}.verification.checked_at`);
    if (item.change !== undefined) {
      const change = record(item.change, `${itemPath}.change`);
      exactKeys(change, CHANGE_KEYS, `${itemPath}.change`);
      text(change.kind, `${itemPath}.change.kind`);
      if (change.previous_signal_ids !== undefined) textList(change.previous_signal_ids, `${itemPath}.change.previous_signal_ids`);
    }
  });
  list(edition.topics, `${path}.topics`).forEach((topicValue, topicIndex) => {
    const topicPath = `${path}.topics[${topicIndex}]`;
    const topic = record(topicValue, topicPath);
    exactKeys(topic, TOPIC_KEYS, topicPath);
    text(topic.id, `${topicPath}.id`);
    text(topic.label_ja, `${topicPath}.label_ja`);
  });
  return edition as unknown as NewsEdition;
}

function validateContext(value: unknown, index: number): NewsContext {
  const path = `contexts[${index}]`;
  const context = record(value, path);
  exactKeys(context, CONTEXT_KEYS, path);
  if (context.schema_version !== 'aoi.news.context.v1') throw new Error(`${path}.schema_version is unsupported`);
  text(context.id, `${path}.id`);
  text(context.slug, `${path}.slug`);
  text(context.title, `${path}.title`);
  if (!['public', 'review-only'].includes(String(context.publication_status))) throw new Error(`${path}.publication_status is invalid`);
  text(context.current_view, `${path}.current_view`);
  dateTime(context.updated_at, `${path}.updated_at`);
  textList(context.supporting_signal_ids, `${path}.supporting_signal_ids`);
  if (context.operator_context !== undefined) {
    const operator = record(context.operator_context, `${path}.operator_context`);
    exactKeys(operator, OPERATOR_KEYS, `${path}.operator_context`);
    Object.entries(operator).forEach(([key, value]) => text(value, `${path}.operator_context.${key}`));
  }
  const revisions = list(context.revisions, `${path}.revisions`);
  if (!revisions.length) throw new Error(`${path}.revisions must not be empty`);
  let previousTime = -Infinity;
  revisions.forEach((revisionValue, revisionIndex) => {
    const revisionPath = `${path}.revisions[${revisionIndex}]`;
    const revision = record(revisionValue, revisionPath);
    exactKeys(revision, REVISION_KEYS, revisionPath);
    text(revision.id, `${revisionPath}.id`);
    const changedAt = dateTime(revision.changed_at, `${revisionPath}.changed_at`);
    const changedTime = Date.parse(changedAt);
    if (changedTime < previousTime) throw new Error(`${path}.revisions must be oldest to newest`);
    previousTime = changedTime;
    text(revision.change_reason, `${revisionPath}.change_reason`);
    text(revision.resulting_view, `${revisionPath}.resulting_view`);
    textList(revision.evidence_signal_ids, `${revisionPath}.evidence_signal_ids`);
  });
  return context as unknown as NewsContext;
}

export function validateNewsCatalog(
  editionsRaw: unknown[],
  contextsRaw: unknown[],
  mode: NewsPublicationMode = 'review',
): NewsCatalog {
  const contract = validatePublicCatalog(editionsRaw, contextsRaw);
  if (!contract.ok) {
    throw new Error(`AOIFUTURE News public contract validation failed: ${contract.errors.map((entry) => `${entry.code} ${entry.path}: ${entry.message}`).join('; ')}`);
  }
  const completeEditions = editionsRaw.map(validateEdition).sort((a, b) => (
    Date.parse(b.published_at) - Date.parse(a.published_at)
    || b.edition_id.localeCompare(a.edition_id)
  ));
  const completeContexts = contextsRaw.map(validateContext).sort((a, b) => a.slug.localeCompare(b.slug));
  const editions = mode === 'production'
    ? completeEditions.filter((edition) => edition.publication_status === 'public')
    : completeEditions;
  const contexts = mode === 'production'
    ? completeContexts.filter((context) => context.publication_status === 'public')
    : completeContexts;
  if (mode === 'production') {
    const publicContract = validatePublicCatalog(editions, contexts);
    if (!publicContract.ok) {
      throw new Error(`AOIFUTURE News public closure validation failed: ${publicContract.errors.map((entry) => `${entry.code} ${entry.path}: ${entry.message}`).join('; ')}`);
    }
  }
  const signals = new Map(editions.flatMap((edition) => edition.items.map((signal) => [signal.id, signal] as const)));
  const contextIds = new Set(contexts.map((context) => context.id));
  const topicIds = new Set(editions.flatMap((edition) => edition.topics.map((topic) => topic.id)));

  if (signals.size !== editions.reduce((count, edition) => count + edition.items.length, 0)) throw new Error('Duplicate Signal ID');
  if (contextIds.size !== contexts.length) throw new Error('Duplicate Context ID');

  for (const edition of editions) {
    for (const signal of edition.items) {
      for (const contextId of signal.context_ids) {
        if (!contextIds.has(contextId)) throw new Error(`Unresolved Context reference: ${contextId}`);
      }
      for (const topicId of signal.topics) {
        if (!topicIds.has(topicId)) throw new Error(`Unresolved topic reference: ${topicId}`);
      }
    }
  }
  for (const context of contexts) {
    const references = [
      ...context.supporting_signal_ids,
      ...context.revisions.flatMap((revision) => revision.evidence_signal_ids),
    ];
    for (const signalId of references) {
      if (!signals.has(signalId)) throw new Error(`Unresolved Signal reference: ${signalId}`);
    }
  }
  return { editions, contexts };
}

const catalogs = new Map<NewsPublicationMode, NewsCatalog>();

export function loadNewsCatalog(
  mode: NewsPublicationMode = resolveNewsPublicationMode(process.env.VERCEL_ENV),
): NewsCatalog {
  const cached = catalogs.get(mode);
  if (cached) return cached;
  const catalog = validateNewsCatalog(Object.values(editionModules), Object.values(contextModules), mode);
  catalogs.set(mode, catalog);
  return catalog;
}

export function getEditionById(
  id: string,
  mode: NewsPublicationMode = resolveNewsPublicationMode(process.env.VERCEL_ENV),
): NewsEdition | undefined {
  return loadNewsCatalog(mode).editions.find((edition) => edition.edition_id === id);
}

export function getContextBySlug(
  slug: string,
  mode: NewsPublicationMode = resolveNewsPublicationMode(process.env.VERCEL_ENV),
): NewsContext | undefined {
  return loadNewsCatalog(mode).contexts.find((context) => context.slug === slug);
}

export function getSignalReference(
  signalId: string,
  mode: NewsPublicationMode = resolveNewsPublicationMode(process.env.VERCEL_ENV),
): NewsSignalReference | undefined {
  for (const edition of loadNewsCatalog(mode).editions) {
    const signal = edition.items.find((item) => item.id === signalId);
    if (signal) return { editionId: edition.edition_id, editionDate: edition.edition_date, signal };
  }
  return undefined;
}
