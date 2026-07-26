import { describe, expect, it } from 'vitest';
import { validatePrivateGates } from '../scripts/news-bridge/private-gate-validator.mjs';

const stamp = '2026-07-26T09:00:00+09:00';

const candidate = (overrides = {}) => ({
  candidate_id: 'radar-openai-agents-001',
  source_url: 'https://example.com/news/agents?utm_source=radar',
  source_kind: 'official',
  ...overrides,
});

const receipt = (overrides = {}) => ({
  schema_version: 'aoi.news.source-read-receipt.v1',
  candidate_id: 'radar-openai-agents-001',
  normalized_source_url: 'https://example.com/news/agents',
  source_kind: 'official',
  checked_at: stamp,
  claim_locator: 'Product announcement, agent controls section',
  reviewed_by: 'news-editor',
  approved_at: stamp,
  decision: 'approved',
  ...overrides,
});

const decision = (overrides = {}) => ({
  schema_version: 'aoi.news.editorial-decision.v1',
  candidate_id: 'radar-openai-agents-001',
  inclusion_decision: 'approved',
  public_fields: {
    title: 'Agent controls update',
    source_title: 'Agent controls',
    source_fact: 'The primary source documents new agent controls.',
    selection_reason: 'The change is directly relevant to operational authority.',
    aoi_note: 'Approval remains a distinct human gate.',
  },
  role: 'brief',
  topics: ['agent-operations'],
  approved_at: stamp,
  ...overrides,
});

const gates = (overrides = {}) => ({
  candidates: [candidate()],
  receipts: [receipt()],
  decisions: [decision()],
  ...overrides,
});

const unsafeUserinfoUrl = (() => {
  const url = new URL('https://example.com/news/agents');
  url.username = 'demo';
  url.password = 'sample';
  return url.href;
})();

const codes = (result) => result.errors.map((entry) => entry.code);
const expectInvalid = (value, code) => {
  const result = validatePrivateGates(value);
  expect(result.ok, JSON.stringify(result.errors, null, 2)).toBe(false);
  expect(codes(result)).toContain(code);
};

describe('AOIFUTURE News private source-read and editorial gates', () => {
  it('accepts exactly one canonical approved receipt and editorial decision per candidate', () => {
    expect(validatePrivateGates(gates())).toEqual({ ok: true, errors: [] });
  });

  it('rejects missing, rejected, or URL-mismatched approved receipts', () => {
    expectInvalid(gates({ receipts: [] }), 'missing_approved_receipt');
    expectInvalid(gates({ receipts: [receipt({ decision: 'rejected' })] }), 'missing_approved_receipt');
    expectInvalid(gates({ receipts: [receipt({ normalized_source_url: 'https://example.com/other' })] }), 'source_url_mismatch');
  });

  it('rejects credential-bearing receipt URLs before approval counting', () => {
    expectInvalid(gates({ receipts: [receipt({ normalized_source_url: unsafeUserinfoUrl })] }), 'schema');
    expectInvalid(gates({ receipts: [receipt({ normalized_source_url: unsafeUserinfoUrl })] }), 'missing_approved_receipt');
  });

  it('rejects missing or rejected editorial inclusion decisions', () => {
    expectInvalid(gates({ decisions: [] }), 'missing_approved_editorial_decision');
    expectInvalid(gates({ decisions: [decision({ inclusion_decision: 'rejected' })] }), 'missing_approved_editorial_decision');
  });

  it('rejects unsupported source kinds and malformed bounded private receipt fields', () => {
    expectInvalid(gates({ candidates: [candidate({ source_kind: 'social' })] }), 'unsupported_source_kind');
    expectInvalid(gates({ receipts: [receipt({ checked_at: 'not-a-time' })] }), 'schema');
    expectInvalid(gates({ receipts: [receipt({ claim_locator: 'short' })] }), 'schema');
    expectInvalid(gates({ receipts: [receipt({ reviewed_by: 'x'.repeat(101) })] }), 'schema');
  });

  it('rejects unknown keys and private-field leakage attempts', () => {
    expectInvalid(gates({ receipts: [receipt({ source_body: 'private source text' })] }), 'schema');
    expectInvalid(gates({ decisions: [decision({ public_fields: { ...decision().public_fields, reviewer_identity: 'private-editor' } })] }), 'schema');
  });

  it('rejects duplicate candidate, source URL, receipt, and editorial identities', () => {
    expectInvalid(gates({ candidates: [candidate(), candidate()] }), 'duplicate_candidate_id');
    expectInvalid(gates({ candidates: [candidate(), candidate({ candidate_id: 'radar-openai-agents-002', source_url: 'https://example.com/news/agents' })] }), 'duplicate_source_url');
    expectInvalid(gates({ receipts: [receipt(), receipt()] }), 'duplicate_receipt_identity');
    expectInvalid(gates({ decisions: [decision(), decision()] }), 'duplicate_editorial_identity');
  });

  it('rejects candidate/source kind identity mismatch and orphan gate records', () => {
    expectInvalid(gates({ receipts: [receipt({ source_kind: 'analysis' })] }), 'source_kind_mismatch');
    expectInvalid(gates({ decisions: [decision({ candidate_id: 'radar-other-001' })] }), 'orphan_editorial_decision');
  });
});
