import { describe, expect, it } from 'vitest';
import {
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

describe('AOIFUTURE News public loader', () => {
  it('loads the staged catalog deterministically and never falls back for unknown keys', () => {
    const first = loadNewsCatalog();
    const second = loadNewsCatalog();

    expect(first).toEqual(second);
    expect(first.editions.map((edition) => edition.edition_date)).toEqual(['2026-07-24', '2026-07-23']);
    expect(first.contexts.map((context) => context.slug)).toEqual(['agent-authority', 'connected-ai-boundaries']);
    expect(first.editions[0].items).toHaveLength(6);
    expect(first.editions[0].items.map((signal) => signal.id)).toEqual([
      'sig-openai-health-20260724',
      'sig-claude-voice-tools-20260724',
      'sig-langfuse-v4-rc0-20260724',
      'sig-anthropic-sdk-0119-20260724',
      'sig-google-voicify-story-20260724',
      'sig-authjs-fail-open-20260724',
    ]);
    expect(getEditionById('2026-07-24')?.edition_id).toBe('2026-07-24');
    expect(getEditionById('2026-07-23')?.edition_id).toBe('2026-07-23');
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

  it('fails closed to review unless VERCEL_ENV is exactly production', () => {
    for (const value of [undefined, '', 'development', 'preview', 'Production', ' production ']) {
      expect(resolveNewsPublicationMode(value)).toBe('review');
    }
    expect(resolveNewsPublicationMode('production')).toBe('production');
  });

  it('projects only the closed public graph in production', () => {
    const review = loadNewsCatalog('review');
    const production = loadNewsCatalog('production');
    expect(review.editions.map((item) => item.edition_id)).toEqual(['2026-07-24', '2026-07-23']);
    expect(production.editions.map((item) => item.edition_id)).toEqual(['2026-07-24']);
    expect(production.contexts.map((item) => item.slug)).toEqual(['connected-ai-boundaries']);
  });

  it('orders equal publication instants by descending full Edition ID', () => {
    const catalog = structuredClone(loadNewsCatalog('review'));
    catalog.editions[0].items.forEach((signal) => { signal.context_ids = []; });
    const laterIdentity = structuredClone(catalog.editions[0]);
    laterIdentity.edition_id = '2026-07-24-1530';
    laterIdentity.items = laterIdentity.items.map((signal) => ({ ...signal, id: `${signal.id}-later` }));
    laterIdentity.items.forEach((signal) => { signal.context_ids = []; });
    laterIdentity.topics = structuredClone(catalog.editions[0].topics);
    const isolated = validateNewsCatalog([catalog.editions[0], laterIdentity], [], 'review');
    expect(isolated.editions.map((item) => item.edition_id)).toEqual(['2026-07-24-1530', '2026-07-24']);
  });
});
