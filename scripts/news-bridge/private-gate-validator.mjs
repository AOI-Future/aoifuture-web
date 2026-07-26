import decisionSchema from '../../schemas/aoi-news-editorial-decision-v1.schema.json' with { type: 'json' };
import receiptSchema from '../../schemas/aoi-news-source-read-receipt-v1.schema.json' with { type: 'json' };

const sourceKinds = new Set(['official', 'documentation', 'release', 'repository', 'paper', 'advisory', 'regulator', 'original-reporting', 'analysis']);
const candidateKeys = new Set(['candidate_id', 'source_url', 'source_kind']);
const gateKeys = new Set(['candidates', 'receipts', 'decisions']);
const error = (code, path, message) => ({ code, path, message });
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const pathJoin = (base, key) => `${base}/${String(key).replaceAll('~', '~0').replaceAll('/', '~1')}`;
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
    if (!isObject(value)) return errors.push(error('schema', path, 'must be an object'));
    const properties = node.properties ?? {};
    for (const key of node.required ?? []) if (!Object.hasOwn(value, key)) errors.push(error('schema', pathJoin(path, key), 'is required'));
    if (node.additionalProperties === false) for (const key of Object.keys(value)) if (!Object.hasOwn(properties, key)) errors.push(error('schema', pathJoin(path, key), 'unknown field'));
    for (const [key, child] of Object.entries(properties)) if (Object.hasOwn(value, key)) validateSchemaNode(value[key], child, schema, pathJoin(path, key), errors);
    return;
  }
  if (node.type === 'array') {
    if (!Array.isArray(value)) return errors.push(error('schema', path, 'must be an array'));
    if (node.minItems !== undefined && value.length < node.minItems) errors.push(error('schema', path, `must have at least ${node.minItems} items`));
    if (node.maxItems !== undefined && value.length > node.maxItems) errors.push(error('schema', path, `must have at most ${node.maxItems} items`));
    if (node.uniqueItems && new Set(value.map((item) => JSON.stringify(item))).size !== value.length) errors.push(error('schema', path, 'must contain unique items'));
    value.forEach((item, index) => validateSchemaNode(item, node.items, schema, pathJoin(path, index), errors));
    return;
  }
  if (node.type !== 'string' || typeof value === 'string') {
    if (node.type === 'string') {
      if (node.minLength !== undefined && [...value].length < node.minLength) errors.push(error('schema', path, `must contain at least ${node.minLength} characters`));
      if (node.maxLength !== undefined && [...value].length > node.maxLength) errors.push(error('schema', path, `must contain at most ${node.maxLength} characters`));
      if (node.pattern && !new RegExp(node.pattern, 'u').test(value)) errors.push(error('schema', path, `must match ${node.pattern}`));
      if (node.format === 'date-time' && !validDateTime(value)) errors.push(error('schema', path, 'must be an RFC 3339 date-time'));
      if (node.format === 'uri') try { new URL(value); } catch { errors.push(error('schema', path, 'must be an absolute URI')); }
    }
    return;
  }
  errors.push(error('schema', path, 'must be a string'));
}

export function normalizePrivateSourceUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password) throw new TypeError('source URL must be credential-free HTTPS');
  for (const key of [...url.searchParams.keys()]) {
    const normalized = key.toLowerCase();
    if (normalized.startsWith('utm_') || ['fbclid', 'gclid', 'dclid', 'mc_cid', 'mc_eid', '_hsenc', '_hsmi'].includes(normalized)) url.searchParams.delete(key);
  }
  const entries = [...url.searchParams.entries()].sort(([leftKey, leftValue], [rightKey, rightValue]) => leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue));
  url.search = '';
  for (const [key, item] of entries) url.searchParams.append(key, item);
  url.hash = '';
  return url.toString();
}

function validateCandidate(candidate, path, errors) {
  if (!isObject(candidate)) return errors.push(error('schema', path, 'candidate must be an object'));
  for (const key of Object.keys(candidate)) if (!candidateKeys.has(key)) errors.push(error('schema', pathJoin(path, key), 'unknown field'));
  for (const key of candidateKeys) if (!Object.hasOwn(candidate, key)) errors.push(error('schema', pathJoin(path, key), 'is required'));
  if (typeof candidate.candidate_id !== 'string' || !/^[a-z0-9][a-z0-9-]{2,79}$/.test(candidate.candidate_id)) errors.push(error('schema', pathJoin(path, 'candidate_id'), 'must be an opaque candidate ID'));
  if (!sourceKinds.has(candidate.source_kind)) errors.push(error('unsupported_source_kind', pathJoin(path, 'source_kind'), 'source kind is unsupported'));
  try { normalizePrivateSourceUrl(candidate.source_url); } catch { errors.push(error('schema', pathJoin(path, 'source_url'), 'must be a credential-free HTTPS URL')); }
}

const validGateArray = (value, path, errors) => {
  if (!Array.isArray(value)) {
    errors.push(error('schema', path, 'must be an array'));
    return false;
  }
  return true;
};

export function validatePrivateGates(gates) {
  const errors = [];
  if (!isObject(gates)) return { ok: false, errors: [error('schema', '', 'private gates must be an object')] };
  for (const key of Object.keys(gates)) if (!gateKeys.has(key)) errors.push(error('schema', pathJoin('', key), 'unknown field'));
  for (const key of gateKeys) if (!Object.hasOwn(gates, key)) errors.push(error('schema', pathJoin('', key), 'is required'));
  const candidates = validGateArray(gates.candidates, '/candidates', errors) ? gates.candidates : [];
  const receipts = validGateArray(gates.receipts, '/receipts', errors) ? gates.receipts : [];
  const decisions = validGateArray(gates.decisions, '/decisions', errors) ? gates.decisions : [];

  const candidateById = new Map();
  const candidateUrls = new Set();
  candidates.forEach((candidate, index) => {
    const path = `/candidates/${index}`;
    validateCandidate(candidate, path, errors);
    if (!isObject(candidate)) return;
    if (candidateById.has(candidate.candidate_id)) errors.push(error('duplicate_candidate_id', `${path}/candidate_id`, 'candidate identity is duplicated'));
    else candidateById.set(candidate.candidate_id, { candidate, path });
    try {
      const sourceUrl = normalizePrivateSourceUrl(candidate.source_url);
      if (candidateUrls.has(sourceUrl)) errors.push(error('duplicate_source_url', `${path}/source_url`, 'canonical source URL is duplicated'));
      candidateUrls.add(sourceUrl);
    } catch { /* Candidate schema error is already reported. */ }
  });

  const receiptsByCandidate = new Map();
  receipts.forEach((receipt, index) => {
    const path = `/receipts/${index}`;
    validateSchemaNode(receipt, receiptSchema, receiptSchema, path, errors);
    if (!isObject(receipt)) return;
    let normalizedSourceUrl;
    try {
      normalizedSourceUrl = normalizePrivateSourceUrl(receipt.normalized_source_url);
    } catch {
      errors.push(error('schema', `${path}/normalized_source_url`, 'must be a credential-free HTTPS URL'));
    }
    const identity = `${receipt.candidate_id}\u0000${receipt.normalized_source_url}`;
    if ([...receiptsByCandidate.values()].flat().some((entry) => entry.identity === identity)) errors.push(error('duplicate_receipt_identity', path, 'candidate/source receipt identity is duplicated'));
    const entries = receiptsByCandidate.get(receipt.candidate_id) ?? [];
    entries.push({ receipt, path, identity, normalizedSourceUrl });
    receiptsByCandidate.set(receipt.candidate_id, entries);
    const candidateEntry = candidateById.get(receipt.candidate_id);
    if (!candidateEntry) errors.push(error('orphan_receipt', path, 'receipt references an unknown candidate'));
    else if (normalizedSourceUrl !== undefined) {
      try {
        if (normalizedSourceUrl !== normalizePrivateSourceUrl(candidateEntry.candidate.source_url)) errors.push(error('source_url_mismatch', `${path}/normalized_source_url`, 'receipt URL must canonically equal the candidate source URL'));
      } catch { /* Schema validation reports malformed URLs. */ }
    }
    if (candidateEntry) {
      if (receipt.source_kind !== candidateEntry.candidate.source_kind) errors.push(error('source_kind_mismatch', `${path}/source_kind`, 'receipt source kind must equal the candidate source kind'));
    }
  });

  const decisionsByCandidate = new Map();
  decisions.forEach((decision, index) => {
    const path = `/decisions/${index}`;
    validateSchemaNode(decision, decisionSchema, decisionSchema, path, errors);
    if (!isObject(decision)) return;
    if (decisionsByCandidate.has(decision.candidate_id)) errors.push(error('duplicate_editorial_identity', `${path}/candidate_id`, 'editorial identity is duplicated'));
    else decisionsByCandidate.set(decision.candidate_id, { decision, path });
    if (!candidateById.has(decision.candidate_id)) errors.push(error('orphan_editorial_decision', path, 'editorial decision references an unknown candidate'));
  });

  for (const [candidateId, { path }] of candidateById) {
    const approvedReceipts = (receiptsByCandidate.get(candidateId) ?? []).filter(({ receipt, normalizedSourceUrl }) => receipt.decision === 'approved' && normalizedSourceUrl !== undefined);
    if (approvedReceipts.length !== 1) errors.push(error('missing_approved_receipt', path, 'candidate requires exactly one approved source-read receipt'));
    const approvedDecision = decisionsByCandidate.get(candidateId)?.decision;
    if (approvedDecision?.inclusion_decision !== 'approved') errors.push(error('missing_approved_editorial_decision', path, 'candidate requires exactly one approved editorial decision'));
  }
  return { ok: errors.length === 0, errors };
}
