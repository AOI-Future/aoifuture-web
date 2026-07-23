import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { importNewsBundle } from '../scripts/news-contract/importer.mjs';
import {
  normalizeEditionForImport,
  validateContextTransition,
  validatePublicationBundle,
} from '../scripts/news-contract/validator.mjs';

const stamp1 = '2026-07-22T09:00:00+09:00';
const stamp2 = '2026-07-23T09:00:00+09:00';
const fixtureBundle = JSON.parse(readFileSync(new URL('../fixtures/news-contract/non-production/import-bundle.json', import.meta.url), 'utf8'));

const item = (id, url, overrides = {}) => ({
  id,
  title: `${id} の表示見出し`,
  source_url: url,
  source_title: `${id} source title`,
  source_domain: new URL(url).hostname,
  source_kind: 'official',
  language: 'ja',
  published_at: stamp1,
  observed_at: stamp1,
  context_ids: ['ctx-agent-authority'],
  source_fact: '公開情報に記載された変更点を確認した。',
  aoi_note: '権限境界と検証方法を先に確認したい。',
  topics: ['agent-operations'],
  role: 'brief',
  verification: { status: 'verified', checked_at: stamp2 },
  ...overrides,
});

const edition = () => ({
  schema_version: 'aoi.news.edition.v1',
  edition_id: '2026-07-23',
  edition_date: '2026-07-23',
  generated_at: stamp2,
  published_at: stamp2,
  title: '検証用 AOIFUTURE News サンプル',
  dek: '本番公開を意図しない、契約検証専用のサンプル。',
  items: [
    item('sig-presence', 'https://openai.com/index/introducing-openai-presence/', { role: 'lead' }),
    item('sig-sdk', 'https://github.com/anthropics/anthropic-sdk-python/releases/tag/v0.118.0'),
  ],
  topics: [{ id: 'agent-operations', label_ja: 'エージェント運用', label_en: 'Agent operations' }],
});

const previousContext = () => ({
  schema_version: 'aoi.news.context.v1',
  id: 'ctx-agent-authority',
  slug: 'agent-authority',
  title: 'Agent Authority',
  current_view: '業務エージェントでは、権限と人間への引き継ぎ条件が導入判断の中心になる。',
  updated_at: stamp1,
  operator_context: {
    authority: '実行可能な操作と接続先を列挙する。',
    control: '承認と人間への引き継ぎ条件を確認する。',
  },
  supporting_signal_ids: ['sig-presence'],
  revisions: [{
    id: 'rev-agent-authority-001',
    changed_at: stamp1,
    change_reason: '業務エージェントの公開情報から、権限と引き継ぎを初期論点として記録した。',
    resulting_view: '業務エージェントでは、権限と人間への引き継ぎ条件が導入判断の中心になる。',
    evidence_signal_ids: ['sig-presence'],
  }],
});

const candidateContext = () => ({
  ...previousContext(),
  current_view: '権限と引き継ぎに加え、SDK更新時のイベント順序と差分処理も運用検証の対象になる。',
  updated_at: stamp2,
  operator_context: {
    authority: '実行可能な操作と接続先を列挙する。',
    control: '承認と人間への引き継ぎ条件を確認する。',
    evidence: 'SDK更新前後のイベント順序と差分処理を再現する。',
  },
  supporting_signal_ids: ['sig-presence', 'sig-sdk'],
  revisions: [
    ...previousContext().revisions,
    {
      id: 'rev-agent-authority-002',
      changed_at: stamp2,
      change_reason: 'Managed Agents対応のSDK更新により、統合境界の検証項目が増えた。',
      resulting_view: '権限と引き継ぎに加え、SDK更新時のイベント順序と差分処理も運用検証の対象になる。',
      evidence_signal_ids: ['sig-sdk'],
    },
  ],
});

const receipts = () => edition().items.map((signal) => ({
  schema_version: 'aoi.news.source-read.v1',
  signal_id: signal.id,
  normalized_source_url: signal.source_url,
  source_kind: signal.source_kind,
  read_at: stamp2,
  claim_locator: signal.id === 'sig-sdk' ? 'Release v0.118.0, Added section' : 'Enterprise agents, controls and handoff section',
  reviewed_by: 'sample-editor',
  approved_at: stamp2,
  decision: 'approved',
}));

const validBundle = () => ({
  edition: edition(),
  contexts: [candidateContext()],
  context_transitions: [{ context_id: 'ctx-agent-authority', kind: 'update' }],
  previous_contexts: [previousContext()],
  receipts: receipts(),
  published_editions: [],
  published_contexts: [previousContext()],
});

const codes = (result) => result.errors.map((error) => error.code);
const expectInvalid = (bundle, code) => {
  const result = validatePublicationBundle(bundle);
  expect(result.ok, JSON.stringify(result.errors, null, 2)).toBe(false);
  expect(codes(result)).toContain(code);
};

describe('AOIFUTURE News publication contract', () => {
  it('validates the explicit non-production fixture with two evidence-backed revisions', () => {
    expect(fixtureBundle.edition.dek).toContain('本番公開を意図しない');
    expect(fixtureBundle.contexts[0].revisions).toHaveLength(2);
    expect(fixtureBundle.contexts[0].revisions.every((revision) => revision.evidence_signal_ids.length > 0)).toBe(true);
    expect(validatePublicationBundle(fixtureBundle)).toEqual({ ok: true, errors: [] });
  });

  it('accepts the complete non-production sample graph', () => {
    expect(validatePublicationBundle(validBundle())).toEqual({ ok: true, errors: [] });
  });

  it.each([
    ['null Edition', (b) => { b.edition = null; }],
    ['null Context', (b) => { b.contexts = [null]; }],
    ['null previous Context', (b) => { b.previous_contexts = [null]; }],
    ['null receipt', (b) => { b.receipts = [null]; }],
    ['non-array published index', (b) => { b.published_editions = {}; }],
  ])('fails closed with stable errors for malformed bundle documents: %s', (_name, mutate) => {
    const bundle = validBundle();
    mutate(bundle);
    const first = validatePublicationBundle(bundle);
    const second = validatePublicationBundle(bundle);
    expect(first.ok).toBe(false);
    expect(first.errors.length).toBeGreaterThan(0);
    expect(second).toEqual(first);
  });

  it.each(['context_transitions', 'published_editions', 'published_contexts'])(
    'requires the fail-closed %s bundle field',
    (key) => {
      const bundle = validBundle();
      delete bundle[key];
      expectInvalid(bundle, 'bundle_shape');
    },
  );

  it.each([
    ['unknown/private field', (b) => { b.edition.items[0].internal_score = 0.9; }, 'schema'],
    ['raw source body', (b) => { b.edition.items[0].source_body = 'copied body'; }, 'schema'],
    ['HTML in public text', (b) => { b.edition.items[0].aoi_note = '<strong>unsafe</strong>'; }, 'schema'],
    ['credentialed URL', (b) => { b.edition.items[0].source_url = 'https://user:pass@openai.com/news'; }, 'url_credentials'],
    ['loopback URL', (b) => { b.edition.items[0].source_url = 'https://127.0.0.1/news'; }, 'url_private_host'],
    ['private-network URL', (b) => { b.edition.items[0].source_url = 'https://10.2.3.4/news'; }, 'url_private_host'],
    ['IPv4-mapped loopback URL', (b) => { b.edition.items[0].source_url = 'https://[::ffff:127.0.0.1]/news'; }, 'url_private_host'],
    ['tracking URL', (b) => { b.edition.items[0].source_url += '?utm_source=private'; }, 'url_not_normalized'],
    ['arbitrary source domain', (b) => { b.edition.items[0].source_domain = 'example.com'; }, 'source_domain_mismatch'],
    ['non-derived source-domain casing', (b) => { b.edition.items[0].source_domain = 'OpenAI.com'; }, 'source_domain_mismatch'],
    ['impossible editorial date', (b) => { b.edition.edition_date = '2026-02-31'; }, 'schema'],
    ['duplicate item ID', (b) => { b.edition.items[1].id = b.edition.items[0].id; }, 'duplicate_signal_id'],
    ['unknown Context reference', (b) => { b.edition.items[0].context_ids = ['ctx-missing']; }, 'unresolved_context_reference'],
    ['one-way Context reference', (b) => { b.edition.items[1].context_ids = []; }, 'reference_closure'],
    ['unknown supporting Signal', (b) => { b.contexts[0].supporting_signal_ids.push('sig-missing'); }, 'unresolved_signal_reference'],
    ['unknown revision evidence Signal', (b) => { b.contexts[0].revisions[1].evidence_signal_ids = ['sig-missing']; }, 'unresolved_signal_reference'],
    ['withdrawn current support', (b) => { b.edition.items[0].verification.status = 'withdrawn'; b.edition.items[0].change = { kind: 'withdrawn' }; b.edition.items[0].role = 'brief'; }, 'withdrawn_current_support'],
    ['cross-origin image', (b) => { b.edition.items[0].image = { url: 'https://example.com/image.png', alt: 'Evidence image', credit: 'Publisher', rights_basis: 'Explicit permission' }; }, 'schema'],
    ['incomplete correction state', (b) => { b.edition.items[0].corrected_at = stamp2; }, 'correction_semantics'],
    ['corrected change without public correction metadata', (b) => { b.edition.items[0].change = { kind: 'corrected' }; }, 'correction_semantics'],
    ['withdrawn verification without withdrawn change', (b) => { b.edition.items[0].verification.status = 'withdrawn'; b.edition.items[0].role = 'brief'; }, 'withdrawn_semantics'],
    ['withdrawn change with verified status', (b) => { b.edition.items[0].change = { kind: 'withdrawn' }; b.edition.items[0].role = 'brief'; }, 'withdrawn_semantics'],
    ['withdrawn change retaining a lead role', (b) => { b.edition.items[0].change = { kind: 'withdrawn' }; b.edition.items[0].role = 'lead'; }, 'withdrawn_role'],
    ['missing receipt', (b) => { b.receipts.pop(); }, 'missing_approved_receipt'],
    ['rejected receipt', (b) => { b.receipts[0].decision = 'rejected'; }, 'missing_approved_receipt'],
  ])('rejects %s', (_name, mutate, code) => {
    const bundle = validBundle();
    mutate(bundle);
    expectInvalid(bundle, code);
  });

  it.each([
    ['source fact', (b) => { b.edition.items[0].source_fact = '   \n'; }],
    ['source title', (b) => { b.edition.items[0].source_title = '\t  '; }],
    ['AOI note', (b) => { b.edition.items[0].aoi_note = '　'; }],
    ['current Context view', (b) => { b.contexts[0].current_view = '  '; }],
    ['Context change reason', (b) => { b.contexts[0].revisions[1].change_reason = '\n\t'; }],
    ['receipt claim locator', (b) => { b.receipts[0].claim_locator = '        '; }],
    ['receipt reviewer', (b) => { b.receipts[0].reviewed_by = '   '; }],
  ])('rejects whitespace-only %s', (_name, mutate) => {
    const bundle = validBundle();
    mutate(bundle);
    expectInvalid(bundle, 'schema');
  });

  it('rejects global Signal ID reuse across Editions', () => {
    const bundle = validBundle();
    const old = edition();
    old.edition_id = '2026-07-22';
    old.edition_date = '2026-07-22';
    bundle.published_editions.push(old);
    expectInvalid(bundle, 'duplicate_signal_id');
  });

  it('rejects global Context ID reuse', () => {
    const bundle = validBundle();
    bundle.context_transitions[0].kind = 'initial';
    bundle.previous_contexts = [];
    expectInvalid(bundle, 'duplicate_context_id');
  });

  it('rejects duplicate and stale lineage references', () => {
    const duplicate = validBundle();
    duplicate.edition.items[1].change = { kind: 'corrected', previous_signal_ids: ['sig-presence', 'sig-presence'] };
    expectInvalid(duplicate, 'duplicate_reference');

    const stale = validBundle();
    stale.edition.items[0].change = { kind: 'superseded', previous_signal_ids: ['sig-sdk'] };
    expectInvalid(stale, 'stale_previous_signal');
  });

  it('rejects previous_signal_ids on a non-lineage change', () => {
    const bundle = validBundle();
    bundle.edition.items[1].change = { kind: 'new', previous_signal_ids: ['sig-presence'] };
    expectInvalid(bundle, 'invalid_lineage_kind');
  });
});

describe('Active Context transition contract', () => {
  const transitionCodes = (previous, candidate) => codes(validateContextTransition(previous, candidate));

  it('accepts one immutable-prefix append', () => {
    expect(validateContextTransition(previousContext(), candidateContext())).toEqual({ ok: true, errors: [] });
  });

  it('accepts an explicitly declared genuine initial Context', () => {
    const bundle = validBundle();
    bundle.contexts = [previousContext()];
    bundle.context_transitions[0].kind = 'initial';
    bundle.previous_contexts = [];
    bundle.published_contexts = [];
    bundle.edition.items[1].context_ids = [];
    expect(validatePublicationBundle(bundle)).toEqual({ ok: true, errors: [] });
  });

  it('rejects an update with ambiguous missing prior canonical state', () => {
    const bundle = validBundle();
    bundle.previous_contexts = [];
    expectInvalid(bundle, 'missing_previous_context');
  });

  it('rejects an update whose declared previous state is not the complete-index canonical manifest', () => {
    const bundle = validBundle();
    bundle.published_contexts = [candidateContext()];
    expectInvalid(bundle, 'previous_context_not_canonical');
  });

  it('rejects initial state when a previous Context is supplied', () => {
    const bundle = validBundle();
    bundle.context_transitions[0].kind = 'initial';
    expectInvalid(bundle, 'unexpected_previous_context');
  });

  it('rejects invalid revision ordering', () => {
    const candidate = candidateContext();
    candidate.revisions[1].changed_at = '2026-07-21T09:00:00+09:00';
    expect(transitionCodes(previousContext(), candidate)).toContain('revision_order');
  });

  it.each([
    ['mutation', (c) => { c.revisions[0].change_reason = 'silently changed'; }],
    ['reorder', (c) => { c.revisions.reverse(); }],
    ['deletion', (c) => { c.revisions = c.revisions.slice(1); }],
  ])('rejects prior revision %s', (_name, mutate) => {
    const candidate = candidateContext();
    mutate(candidate);
    expect(transitionCodes(previousContext(), candidate)).toContain('revision_prefix');
  });

  it('rejects mismatched latest view and timestamp', () => {
    const view = candidateContext();
    view.current_view = '別の見解';
    expect(transitionCodes(previousContext(), view)).toContain('current_view_mismatch');

    const time = candidateContext();
    time.updated_at = stamp1;
    expect(transitionCodes(previousContext(), time)).toContain('updated_at_mismatch');
  });

  it('rejects a silent current_view overwrite without an appended revision', () => {
    const candidate = previousContext();
    candidate.current_view = '履歴を追加せずに変更した見解';
    expect(transitionCodes(previousContext(), candidate)).toContain('current_view_mismatch');
    expect(transitionCodes(previousContext(), candidate)).toContain('revision_required');
  });

  it('rejects a fabricated revision on an identical editorial state', () => {
    const candidate = previousContext();
    candidate.revisions.push({
      ...candidate.revisions[0],
      id: 'rev-agent-authority-002',
      changed_at: stamp2,
    });
    expect(transitionCodes(previousContext(), candidate)).toContain('revision_without_change');
  });
});

describe('deterministic import normalization', () => {
  it('strips known tracking parameters and derives the source domain', () => {
    const raw = edition();
    raw.items[0].source_url = 'https://openai.com/index/introducing-openai-presence/?utm_source=mail&ref=kept';
    raw.items[0].source_domain = 'untrusted.example';
    const normalized = normalizeEditionForImport(raw);
    expect(normalized.items[0].source_url).toBe('https://openai.com/index/introducing-openai-presence/?ref=kept');
    expect(normalized.items[0].source_domain).toBe('openai.com');
    expect(normalizeEditionForImport(raw)).toEqual(normalized);
  });

  it('writes only stable public Edition and Context artifacts', () => {
    const first = mkdtempSync(join(tmpdir(), 'aoi-news-import-'));
    const second = mkdtempSync(join(tmpdir(), 'aoi-news-import-'));
    try {
      const firstResult = importNewsBundle(validBundle(), first);
      const secondResult = importNewsBundle(validBundle(), second);
      expect(firstResult.ok).toBe(true);
      expect(secondResult.ok).toBe(true);
      expect(readdirSync(first).sort()).toEqual(['contexts', 'editions']);
      expect(readdirSync(join(first, 'editions'))).toEqual(['2026-07-23.json']);
      expect(readdirSync(join(first, 'contexts'))).toEqual(['agent-authority.json']);
      expect(readFileSync(join(first, 'editions', '2026-07-23.json'), 'utf8'))
        .toBe(readFileSync(join(second, 'editions', '2026-07-23.json'), 'utf8'));
      expect(readFileSync(join(first, 'contexts', 'agent-authority.json'), 'utf8'))
        .toBe(readFileSync(join(second, 'contexts', 'agent-authority.json'), 'utf8'));
    } finally {
      rmSync(first, { recursive: true, force: true });
      rmSync(second, { recursive: true, force: true });
    }
  });
});
