import { describe, expect, it } from 'vitest';
import {
  getContextBySlug,
  getEditionByDate,
  loadNewsCatalog,
  validateNewsCatalog,
} from '../src/lib/news/load-news';

const privateKeys = [
  'receipts',
  'previous_contexts',
  'context_transitions',
  'published_contexts',
  'published_editions',
  'reviewed_by',
  'claim_locator',
];

describe('AOIFUTURE News public loader', () => {
  it('loads the staged catalog deterministically and never falls back for unknown keys', () => {
    const first = loadNewsCatalog();
    const second = loadNewsCatalog();

    expect(first).toEqual(second);
    expect(first.editions.map((edition) => edition.edition_date)).toEqual(['2026-07-23']);
    expect(first.contexts.map((context) => context.slug)).toEqual(['agent-authority']);
    expect(getEditionByDate('2026-07-23')?.edition_id).toBe('2026-07-23');
    expect(getEditionByDate('2099-01-01')).toBeUndefined();
    expect(getContextBySlug('agent-authority')?.id).toBe('ctx-agent-authority');
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
    catalog.editions[0].items[1].context_ids = [];
    expect(() => validateNewsCatalog(catalog.editions, catalog.contexts)).toThrow(/reference.closure/i);
  });

  it('keeps lead first and Context revisions oldest to newest', () => {
    const catalog = loadNewsCatalog();
    expect(catalog.editions[0].items[0].role).toBe('lead');
    expect(catalog.contexts[0].revisions.map((revision) => revision.changed_at)).toEqual([
      '2026-07-22T09:00:00+09:00',
      '2026-07-23T09:00:00+09:00',
    ]);
  });
});
