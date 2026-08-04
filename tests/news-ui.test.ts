import { describe, expect, it } from 'vitest';
import {
  compareNewsEditions,
  coverageChronologyAt,
  getContextBySlug,
  getEditionById,
  loadNewsCatalog,
  validateNewsCatalog,
} from '../src/lib/news/load-news';
import { resolveNewsPublicationMode } from '../src/lib/news/publication-mode.mjs';

const privateKeys = [
  'receipts',
  'previous_contexts',
  'context_transitions',
  'published_contexts',
  'published_editions',
  'reviewed_by',
  'claim_locator',
];
const newestEdition = (editions: ReturnType<typeof loadNewsCatalog>['editions']) => (
  [...editions].sort(compareNewsEditions)[0]!
);

describe('AOIFUTURE News public loader', () => {
  it('projects approved public Editions in deterministic evidence chronology with truthful coverage', () => {
    const production = loadNewsCatalog('production');
    const newest = newestEdition(production.editions);
    expect(production.editions[0]).toMatchObject({
      edition_id: newest.edition_id,
      coverage_observed_at: newest.coverage_observed_at,
      publication_status: 'public',
    });
    expect(production.editions).toEqual([...production.editions].sort(compareNewsEditions));
    expect(production.editions.map(coverageChronologyAt)).toContain('2026-07-27T08:40:12Z');
    expect(production.editions.every((edition) => edition.items.length >= 1 && edition.items.length <= 12)).toBe(true);
    expect(production.editions.flatMap((edition) => edition.items).every((signal) => signal.selection_reason.trim().length > 0)).toBe(true);
  });

  it('loads the staged catalog deterministically and never falls back for unknown keys', () => {
    const first = loadNewsCatalog();
    const second = loadNewsCatalog();

    expect(first).toEqual(second);
    expect(first.editions[0].edition_id).toBe(newestEdition(first.editions).edition_id);
    expect(first.editions).toEqual([...first.editions].sort(compareNewsEditions));
    expect(first.contexts.map((context) => context.slug)).toEqual([
      'agent-authority', 'ai-delivery-evidence', 'connected-ai-boundaries', 'delegated-work-control', 'operational-ai-authority',
    ]);
    expect(getEditionById('2026-07-24')?.items.map((signal) => signal.id)).toEqual([
      'sig-openai-health-20260724',
      'sig-claude-voice-tools-20260724',
      'sig-langfuse-v4-rc0-20260724',
      'sig-anthropic-sdk-0119-20260724',
      'sig-google-voicify-story-20260724',
      'sig-authjs-fail-open-20260724',
    ]);
    expect(getEditionById('2026-07-24')?.edition_id).toBe('2026-07-24');
    expect(getEditionById('2026-07-23-0430')?.edition_id).toBe('2026-07-23-0430');
    expect(getEditionById('2026-07-23-0900')?.publication_status).toBe('review-only');
    expect(getEditionById('2099-01-01')).toBeUndefined();
    expect(getContextBySlug('agent-authority')?.id).toBe('ctx-agent-authority');
    expect(getContextBySlug('connected-ai-boundaries')?.id).toBe('ctx-connected-ai-boundaries');
    expect(getContextBySlug('missing-context')).toBeUndefined();
  });

  it('contains only public Edition and Context shapes', () => {
    const serialized = JSON.stringify(loadNewsCatalog());
    for (const key of privateKeys) expect(serialized).not.toContain(`"${key}"`);
  });

  it('fails closed on private keys and unresolved references', () => {
    const catalog = structuredClone(loadNewsCatalog());
    const privateEdition = { ...catalog.editions[0], receipts: [] };
    expect(() => validateNewsCatalog([privateEdition], catalog.contexts)).toThrow(/schema|unknown field/i);

    const brokenContext = {
      ...catalog.contexts[0],
      supporting_signal_ids: ['sig-does-not-exist'],
    };
    expect(() => validateNewsCatalog(catalog.editions, [brokenContext])).toThrow(/unresolved/i);
  });

  it.each([
    ['source kind', (catalog: ReturnType<typeof loadNewsCatalog>) => { catalog.editions[0].items[0].source_kind = 'press-release' as never; }],
    ['Signal role', (catalog: ReturnType<typeof loadNewsCatalog>) => { catalog.editions[0].items[0].role = 'feature' as never; }],
    ['verification status', (catalog: ReturnType<typeof loadNewsCatalog>) => { catalog.editions[0].items[0].verification.status = 'pending' as never; }],
    ['change kind', (catalog: ReturnType<typeof loadNewsCatalog>) => { catalog.editions[0].items[0].change!.kind = 'retracted' as never; }],
  ])('fails closed on invalid public contract enum: %s', (_name, mutate) => {
    const catalog = structuredClone(loadNewsCatalog());
    mutate(catalog);
    expect(() => validateNewsCatalog(catalog.editions, catalog.contexts)).toThrow(/schema/i);
  });

  it('fails closed when Signal and Context references are not reciprocal', () => {
    const catalog = structuredClone(loadNewsCatalog());
    const connectedSignal = catalog.editions.flatMap((edition) => edition.items).find((signal) => signal.context_ids.length > 0);
    expect(connectedSignal).toBeDefined();
    connectedSignal!.context_ids = [];
    expect(() => validateNewsCatalog(catalog.editions, catalog.contexts)).toThrow(/reference.closure/i);
  });

  it('keeps a lead first when an Edition has one, and Context revisions oldest to newest', () => {
    const catalog = loadNewsCatalog();
    for (const edition of catalog.editions) {
      const leadIndex = edition.items.findIndex((signal) => signal.role === 'lead');
      if (leadIndex !== -1) expect(leadIndex).toBe(0);
    }
    expect(catalog.contexts[0].revisions.map((revision) => revision.changed_at)).toEqual([
      '2026-07-22T09:00:00+09:00',
      '2026-07-23T09:00:00+09:00',
    ]);
  });

  it('fails closed to review unless VERCEL_ENV is exactly production', () => {
    for (const value of [undefined, '', 'development', 'preview', 'Production', ' production ']) {
      expect(resolveNewsPublicationMode(value)).toBe('review');
    }
    expect(resolveNewsPublicationMode('production')).toBe('production');
  });

  it('projects only the closed public graph in production', () => {
    const review = loadNewsCatalog('review');
    const production = loadNewsCatalog('production');
    const newestPublicEditionId = newestEdition(production.editions).edition_id;
    expect(review.editions).toEqual([...review.editions].sort(compareNewsEditions));
    expect(production.editions).toEqual([...production.editions].sort(compareNewsEditions));
    expect(review.editions.find((item) => item.edition_id === newestPublicEditionId)?.publication_status).toBe('public');
    expect(production.editions.map((item) => item.edition_id)).toContain(newestPublicEditionId);
    expect(review.editions.map((item) => item.edition_id)).toContain('2026-07-23-0900');
    expect(production.editions.map((item) => item.edition_id)).not.toContain('2026-07-23-0900');
    expect(production.contexts.map((item) => item.slug)).toEqual([
      'ai-delivery-evidence', 'connected-ai-boundaries', 'delegated-work-control', 'operational-ai-authority',
    ]);
  });

  it('orders equal publication instants by descending full Edition ID', () => {
    const catalog = structuredClone(loadNewsCatalog('review'));
    catalog.editions[0].items.forEach((signal) => { signal.context_ids = []; });
    const laterIdentity = structuredClone(catalog.editions[0]);
    laterIdentity.edition_id = `${catalog.editions[0].edition_date}-2359`;
    laterIdentity.edition_date = catalog.editions[0].edition_date;
    laterIdentity.items = laterIdentity.items.map((signal) => ({ ...signal, id: `${signal.id}-later` }));
    laterIdentity.items.forEach((signal) => { signal.context_ids = []; });
    laterIdentity.topics = structuredClone(catalog.editions[0].topics);
    const isolated = validateNewsCatalog([catalog.editions[0], laterIdentity], [], 'review');
    expect(isolated.editions.map((item) => item.edition_id)).toEqual([laterIdentity.edition_id, catalog.editions[0].edition_id]);
  });
});
