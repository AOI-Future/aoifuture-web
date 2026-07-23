import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { isIP } from 'node:net';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const loadSchema = (name) => JSON.parse(readFileSync(resolve(root, 'schemas', name), 'utf8'));

const schemas = {
  edition: loadSchema('aoi-news-edition-v1.schema.json'),
  context: loadSchema('aoi-news-context-v1.schema.json'),
  receipt: loadSchema('aoi-news-source-read-v1.schema.json'),
};

const error = (code, path, message) => ({ code, path, message });
const pathJoin = (base, key) => `${base}/${String(key).replaceAll('~', '~0').replaceAll('/', '~1')}`;
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const canonical = (value) => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (isObject(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
};
const unique = (values) => new Set(values.map(canonical)).size === values.length;
const validDate = (value) => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const validDateTime = (value) => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
  && validDate(value.slice(0, 10))
  && !Number.isNaN(Date.parse(value));

function resolveRef(schema, ref) {
  if (!ref.startsWith('#/')) throw new Error(`Unsupported schema reference: ${ref}`);
  return ref.slice(2).split('/').reduce((node, segment) => node[segment.replaceAll('~1', '/').replaceAll('~0', '~')], schema);
}

function validateSchemaNode(value, node, schema, path, errors) {
  if (node.$ref) return validateSchemaNode(value, resolveRef(schema, node.$ref), schema, path, errors);
  if (Object.hasOwn(node, 'const') && value !== node.const) errors.push(error('schema', path, `must equal ${JSON.stringify(node.const)}`));
  if (node.enum && !node.enum.includes(value)) errors.push(error('schema', path, `must be one of ${node.enum.join(', ')}`));

  if (node.type === 'object') {
    if (!isObject(value)) {
      errors.push(error('schema', path, 'must be an object'));
      return;
    }
    const properties = node.properties ?? {};
    for (const key of node.required ?? []) {
      if (!Object.hasOwn(value, key)) errors.push(error('schema', pathJoin(path, key), 'is required'));
    }
    if (node.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!Object.hasOwn(properties, key)) errors.push(error('schema', pathJoin(path, key), 'unknown field'));
      }
    }
    if (node.minProperties !== undefined && Object.keys(value).length < node.minProperties) {
      errors.push(error('schema', path, `must have at least ${node.minProperties} properties`));
    }
    for (const [key, child] of Object.entries(properties)) {
      if (Object.hasOwn(value, key)) validateSchemaNode(value[key], child, schema, pathJoin(path, key), errors);
    }
  } else if (node.type === 'array') {
    if (!Array.isArray(value)) {
      errors.push(error('schema', path, 'must be an array'));
      return;
    }
    if (node.minItems !== undefined && value.length < node.minItems) errors.push(error('schema', path, `must have at least ${node.minItems} items`));
    if (node.maxItems !== undefined && value.length > node.maxItems) errors.push(error('schema', path, `must have at most ${node.maxItems} items`));
    if (node.uniqueItems && !unique(value)) errors.push(error('schema', path, 'must contain unique items'));
    value.forEach((child, index) => validateSchemaNode(child, node.items, schema, pathJoin(path, index), errors));
  } else if (node.type === 'string') {
    if (typeof value !== 'string') {
      errors.push(error('schema', path, 'must be a string'));
      return;
    }
    if (node.minLength !== undefined && [...value].length < node.minLength) errors.push(error('schema', path, `must contain at least ${node.minLength} characters`));
    if (node.maxLength !== undefined && [...value].length > node.maxLength) errors.push(error('schema', path, `must contain at most ${node.maxLength} characters`));
    if (node.pattern && !new RegExp(node.pattern, 'u').test(value)) errors.push(error('schema', path, `must match ${node.pattern}`));
    if (node.format === 'date' && !validDate(value)) errors.push(error('schema', path, 'must be an RFC 3339 date'));
    if (node.format === 'date-time' && !validDateTime(value)) errors.push(error('schema', path, 'must be an RFC 3339 date-time'));
    if (node.format === 'uri') {
      try { new URL(value); } catch { errors.push(error('schema', path, 'must be an absolute URI')); }
    }
  }
}

export function validateDocument(kind, value, path = '') {
  const errors = [];
  validateSchemaNode(value, schemas[kind], schemas[kind], path, errors);
  return result(errors);
}

const trackingNames = new Set(['fbclid', 'gclid', 'dclid', 'mc_cid', 'mc_eid', '_hsenc', '_hsmi']);
export function normalizeSourceUrl(value) {
  const url = new URL(value);
  for (const key of [...url.searchParams.keys()]) {
    if (key.toLowerCase().startsWith('utm_') || trackingNames.has(key.toLowerCase())) url.searchParams.delete(key);
  }
  const entries = [...url.searchParams.entries()].sort(([ak, av], [bk, bv]) => ak.localeCompare(bk) || av.localeCompare(bv));
  url.search = '';
  for (const [key, item] of entries) url.searchParams.append(key, item);
  url.hash = '';
  return url.toString();
}

export function normalizeEditionForImport(raw) {
  const edition = structuredClone(raw);
  if (Array.isArray(edition.items)) {
    edition.items = edition.items.map((item) => {
      const normalized = { ...item };
      if (typeof normalized.source_url === 'string') {
        try {
          normalized.source_url = normalizeSourceUrl(normalized.source_url);
          normalized.source_domain = new URL(normalized.source_url).hostname.toLowerCase();
        } catch {
          // Validation reports malformed URLs after preserving the original input.
        }
      }
      return normalized;
    });
  }
  return edition;
}

function privateHost(hostname) {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return true;
  const family = isIP(host);
  if (family === 4) {
    const [a, b] = host.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
  }
  if (family === 6) {
    if (host.startsWith('::ffff:')) return true;
    return host === '::' || host === '::1' || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('ff') || /^fe[89ab]/.test(host);
  }
  return false;
}

function checkPublicUrl(value, path, errors, { sameOrigin = false } = {}) {
  let url;
  try { url = new URL(value); } catch { return; }
  if (url.protocol !== 'https:') errors.push(error('url_scheme', path, 'only https URLs are allowed'));
  if (url.username || url.password) errors.push(error('url_credentials', path, 'embedded credentials are forbidden'));
  if (privateHost(url.hostname)) errors.push(error('url_private_host', path, 'loopback, private, link-local, and internal hosts are forbidden'));
  if (sameOrigin && url.origin !== 'https://aoifuture.com') errors.push(error('image_not_same_origin', path, 'image must use the AOIFUTURE public origin'));
}

function checkEdition(edition, path, errors) {
  const leadCount = edition.items.filter((item) => item.role === 'lead').length;
  const detourCount = edition.items.filter((item) => item.role === 'detour').length;
  if (leadCount > 1) errors.push(error('role_cardinality', `${path}/items`, 'at most one lead is allowed'));
  if (detourCount > 1) errors.push(error('role_cardinality', `${path}/items`, 'at most one detour is allowed'));
  const topicIds = new Set(edition.topics.map((topic) => topic.id));
  if (topicIds.size !== edition.topics.length) errors.push(error('duplicate_topic_id', `${path}/topics`, 'topic IDs must be unique'));

  edition.items.forEach((item, index) => {
    const itemPath = `${path}/items/${index}`;
    checkPublicUrl(item.source_url, `${itemPath}/source_url`, errors);
    try {
      const normalized = normalizeSourceUrl(item.source_url);
      if (normalized !== item.source_url) errors.push(error('url_not_normalized', `${itemPath}/source_url`, 'known tracking parameters or fragments must be removed before validation'));
      if (new URL(item.source_url).hostname.toLowerCase() !== item.source_domain) {
        errors.push(error('source_domain_mismatch', `${itemPath}/source_domain`, 'source_domain must be derived from source_url'));
      }
    } catch { /* Schema error already reports malformed input. */ }
    if (item.image) checkPublicUrl(item.image.url, `${itemPath}/image/url`, errors, { sameOrigin: true });
    if (item.role === 'watch' && !item.caveat) errors.push(error('watch_requires_caveat', itemPath, 'watch items require a caveat'));
    if (item.verification.status === 'source-unavailable' && !item.caveat) errors.push(error('unavailable_requires_caveat', itemPath, 'source-unavailable items require a visible caveat'));
    if (item.verification.status === 'withdrawn') {
      if (['lead', 'major'].includes(item.role)) errors.push(error('withdrawn_role', `${itemPath}/role`, 'withdrawn items cannot be lead or major'));
      if (item.change?.kind !== 'withdrawn') errors.push(error('withdrawn_change', `${itemPath}/change`, 'withdrawn verification requires withdrawn change state'));
    }
    if (item.corrected_at || item.correction_note) {
      if (!item.corrected_at || !item.correction_note || item.change?.kind !== 'corrected') errors.push(error('correction_semantics', itemPath, 'material corrections require corrected_at, correction_note, and corrected change state'));
    }
    for (const topicId of item.topics) {
      if (!topicIds.has(topicId)) errors.push(error('unresolved_topic_reference', `${itemPath}/topics`, `unknown topic ${topicId}`));
    }
    const previousIds = item.change?.previous_signal_ids ?? [];
    if (previousIds.length && !['corrected', 'superseded', 'withdrawn'].includes(item.change.kind)) {
      errors.push(error('invalid_lineage_kind', `${itemPath}/change/previous_signal_ids`, 'lineage is limited to correction, supersession, or withdrawal'));
    }
  });
}

const isoTime = (value) => Date.parse(value);
function validateContextDocument(context, path, errors) {
  const latest = context.revisions.at(-1);
  if (!latest) return;
  if (context.current_view !== latest.resulting_view) errors.push(error('current_view_mismatch', `${path}/current_view`, 'current_view must equal the latest resulting_view'));
  if (context.updated_at !== latest.changed_at) errors.push(error('updated_at_mismatch', `${path}/updated_at`, 'updated_at must equal the latest changed_at'));
  const revisionIds = new Set();
  context.revisions.forEach((revision, index) => {
    if (revisionIds.has(revision.id)) errors.push(error('duplicate_revision_id', `${path}/revisions/${index}/id`, 'revision IDs must be unique'));
    revisionIds.add(revision.id);
    if (index > 0 && isoTime(revision.changed_at) <= isoTime(context.revisions[index - 1].changed_at)) {
      errors.push(error('revision_order', `${path}/revisions/${index}/changed_at`, 'revisions must be strictly ordered by changed_at'));
    }
  });
}

const sameSet = (left, right) => canonical([...left].sort()) === canonical([...right].sort());
export function validateContextTransition(previous, candidate, path = '/contexts/0') {
  const errors = [];
  const candidateSchema = validateDocument('context', candidate, path);
  errors.push(...candidateSchema.errors);
  if (candidateSchema.ok) validateContextDocument(candidate, path, errors);
  if (!previous) return result(errors);

  const previousSchema = validateDocument('context', previous, '/previous_contexts/0');
  errors.push(...previousSchema.errors);
  if (!previousSchema.ok || !candidateSchema.ok) return result(errors);
  validateContextDocument(previous, '/previous_contexts/0', errors);
  if (previous.id !== candidate.id || previous.slug !== candidate.slug) errors.push(error('context_identity', path, 'Context id and slug are immutable'));

  const prefix = candidate.revisions.slice(0, previous.revisions.length);
  if (candidate.revisions.length < previous.revisions.length || canonical(prefix) !== canonical(previous.revisions)) {
    errors.push(error('revision_prefix', `${path}/revisions`, 'the previous revision array must be an immutable prefix'));
  }

  const meaningChanged = previous.current_view !== candidate.current_view
    || previous.updated_at !== candidate.updated_at
    || !sameSet(previous.supporting_signal_ids, candidate.supporting_signal_ids)
    || canonical(previous.operator_context ?? null) !== canonical(candidate.operator_context ?? null);
  const appended = candidate.revisions.length - previous.revisions.length;
  if (meaningChanged && appended !== 1) errors.push(error('revision_required', `${path}/revisions`, 'an editorial state change requires exactly one appended revision'));
  if (!meaningChanged && appended !== 0) errors.push(error('revision_without_change', `${path}/revisions`, 'an idempotent or metadata-only publication must not fabricate a revision'));
  return result(errors);
}

function result(errors) {
  const sorted = errors.sort((a, b) => a.path.localeCompare(b.path) || a.code.localeCompare(b.code) || a.message.localeCompare(b.message));
  return { ok: sorted.length === 0, errors: sorted };
}

export function validatePublicationBundle(bundle) {
  const errors = [];
  const allowedBundleKeys = new Set(['edition', 'contexts', 'previous_contexts', 'receipts', 'published_editions', 'published_contexts']);
  if (!isObject(bundle)) return result([error('bundle_shape', '', 'bundle must be an object')]);
  for (const key of Object.keys(bundle)) if (!allowedBundleKeys.has(key)) errors.push(error('bundle_shape', `/${key}`, 'unknown bundle field'));
  for (const key of ['edition', 'contexts', 'previous_contexts', 'receipts']) if (!Object.hasOwn(bundle, key)) errors.push(error('bundle_shape', `/${key}`, 'required bundle field'));
  const edition = bundle.edition;
  const contexts = Array.isArray(bundle.contexts) ? bundle.contexts : [];
  const previousContexts = Array.isArray(bundle.previous_contexts) ? bundle.previous_contexts : [];
  const receipts = Array.isArray(bundle.receipts) ? bundle.receipts : [];
  const publishedEditions = Array.isArray(bundle.published_editions) ? bundle.published_editions : [];
  const publishedContexts = Array.isArray(bundle.published_contexts) ? bundle.published_contexts : [];
  if (!isObject(edition) || !Array.isArray(bundle.contexts) || !Array.isArray(bundle.previous_contexts) || !Array.isArray(bundle.receipts)) return result(errors.length ? errors : [error('bundle_shape', '', 'bundle fields have invalid types')]);

  const allEditions = [...publishedEditions, edition];
  const allContexts = [...publishedContexts, ...contexts];
  allEditions.forEach((entry, index) => {
    const path = index === allEditions.length - 1 ? '/edition' : `/published_editions/${index}`;
    const schemaResult = validateDocument('edition', entry, path);
    errors.push(...schemaResult.errors);
    if (schemaResult.ok) checkEdition(entry, path, errors);
  });
  allContexts.forEach((context, index) => {
    const isCandidate = index >= publishedContexts.length;
    const candidateIndex = index - publishedContexts.length;
    const path = isCandidate ? `/contexts/${candidateIndex}` : `/published_contexts/${index}`;
    const schemaResult = validateDocument('context', context, path);
    errors.push(...schemaResult.errors);
    if (schemaResult.ok) validateContextDocument(context, path, errors);
  });
  receipts.forEach((receipt, index) => errors.push(...validateDocument('receipt', receipt, `/receipts/${index}`).errors));

  const signalMap = new Map();
  allEditions.forEach((entry, editionIndex) => entry.items?.forEach((signal, signalIndex) => {
    const path = editionIndex === allEditions.length - 1 ? `/edition/items/${signalIndex}` : `/published_editions/${editionIndex}/items/${signalIndex}`;
    if (signalMap.has(signal.id)) errors.push(error('duplicate_signal_id', `${path}/id`, `Signal ID ${signal.id} is globally reused`));
    else signalMap.set(signal.id, { signal, path });
  }));
  const contextMap = new Map();
  allContexts.forEach((context, index) => {
    const path = index >= publishedContexts.length ? `/contexts/${index - publishedContexts.length}` : `/published_contexts/${index}`;
    if (contextMap.has(context.id)) errors.push(error('duplicate_context_id', `${path}/id`, `Context ID ${context.id} is globally reused`));
    else contextMap.set(context.id, { context, path });
  });

  for (const { signal, path } of signalMap.values()) {
    for (const [index, contextId] of (signal.context_ids ?? []).entries()) {
      if (!contextMap.has(contextId)) errors.push(error('unresolved_context_reference', `${path}/context_ids/${index}`, `unknown Context ${contextId}`));
    }
    const previousIds = signal.change?.previous_signal_ids ?? [];
    if (!unique(previousIds)) errors.push(error('duplicate_reference', `${path}/change/previous_signal_ids`, 'previous_signal_ids must be unique'));
    for (const [index, previousId] of previousIds.entries()) {
      const previous = signalMap.get(previousId)?.signal;
      if (!previous) errors.push(error('unresolved_signal_reference', `${path}/change/previous_signal_ids/${index}`, `unknown Signal ${previousId}`));
      else if (previousId === signal.id) errors.push(error('self_reference', `${path}/change/previous_signal_ids/${index}`, 'Signal cannot reference itself'));
      else if (isoTime(previous.observed_at) >= isoTime(signal.observed_at)) errors.push(error('stale_previous_signal', `${path}/change/previous_signal_ids/${index}`, 'previous Signal must have an earlier observed_at'));
    }
  }

  for (const { context, path } of contextMap.values()) {
    const currentIds = new Set(context.supporting_signal_ids ?? []);
    for (const [index, signalId] of (context.supporting_signal_ids ?? []).entries()) {
      const signal = signalMap.get(signalId)?.signal;
      if (!signal) errors.push(error('unresolved_signal_reference', `${path}/supporting_signal_ids/${index}`, `unknown Signal ${signalId}`));
      else if (signal.verification?.status === 'withdrawn') errors.push(error('withdrawn_current_support', `${path}/supporting_signal_ids/${index}`, 'withdrawn Signal cannot be current support'));
    }
    const historicalIds = new Set();
    (context.revisions ?? []).forEach((revision, revisionIndex) => revision.evidence_signal_ids?.forEach((signalId, evidenceIndex) => {
      historicalIds.add(signalId);
      if (!signalMap.has(signalId)) errors.push(error('unresolved_signal_reference', `${path}/revisions/${revisionIndex}/evidence_signal_ids/${evidenceIndex}`, `unknown Signal ${signalId}`));
    }));
    const expected = new Set([...currentIds, ...historicalIds]);
    for (const [signalId, entry] of signalMap) {
      const signalHasContext = entry.signal.context_ids?.includes(context.id) ?? false;
      if (signalHasContext !== expected.has(signalId)) errors.push(error('reference_closure', path, `Signal ${signalId} and Context ${context.id} must reference each other exactly`));
    }
  }

  const receiptMap = new Map();
  receipts.forEach((receipt, index) => {
    if (!receiptMap.has(receipt.signal_id)) receiptMap.set(receipt.signal_id, []);
    receiptMap.get(receipt.signal_id).push({ receipt, path: `/receipts/${index}` });
  });
  for (const [signalId, { signal, path }] of signalMap) {
    const approved = (receiptMap.get(signalId) ?? []).filter(({ receipt }) => receipt.decision === 'approved'
      && receipt.normalized_source_url === signal.source_url
      && receipt.source_kind === signal.source_kind
      && receipt.claim_locator.trim().length >= 8);
    if (approved.length !== 1) errors.push(error('missing_approved_receipt', path, `Signal ${signalId} requires exactly one matching approved source-read receipt`));
  }
  for (const [signalId, entries] of receiptMap) {
    if (!signalMap.has(signalId)) entries.forEach(({ path }) => errors.push(error('orphan_receipt', path, `receipt references unknown Signal ${signalId}`)));
  }

  contexts.forEach((context, index) => {
    const previous = previousContexts.find((entry) => entry.id === context.id);
    errors.push(...validateContextTransition(previous, context, `/contexts/${index}`).errors);
  });
  previousContexts.forEach((previous, index) => {
    if (!contexts.some((context) => context.id === previous.id)) errors.push(error('orphan_previous_context', `/previous_contexts/${index}`, 'previous Context has no candidate'));
  });
  return result(errors);
}
