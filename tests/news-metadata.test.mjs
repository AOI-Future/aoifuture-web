import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  buildArchiveMetadata,
  buildContextMetadata,
  buildEditionMetadata,
  buildIndexMetadata,
} from '../src/lib/news/metadata.mjs';

const readJson = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const previousEdition = readJson('../src/content/news/editions/2026-07-23.json');
const edition = readJson('../src/content/news/editions/2026-07-24.json');
const previousContext = readJson('../src/content/news/contexts/agent-authority.json');
const context = readJson('../src/content/news/contexts/connected-ai-boundaries.json');
const events = readJson('../src/content/news/events/2026-07-24.json');
const catalog = { editions: [edition, previousEdition], contexts: [previousContext, context] };
const serializedTypes = (value) => JSON.stringify(value);

describe('AOIFUTURE News M2 public metadata', () => {
  it('describes the dated Edition as CollectionPage with exact-anchor ItemList entries', () => {
    const latestReviewedAt = events.at(-1).published_at;
    const metadata = buildEditionMetadata(edition, latestReviewedAt);
    expect(metadata['@type']).toBe('CollectionPage');
    expect(metadata.url).toBe('https://aoifuture.com/news/2026-07-24/');
    expect(metadata.dateModified).toBe(latestReviewedAt);
    expect(metadata.dateModified).toBe(edition.published_at);
    expect(metadata.mainEntity).toMatchObject({ '@type': 'ItemList', numberOfItems: 6 });
    expect(metadata.mainEntity.itemListElement).toEqual(edition.items.map((signal, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: signal.title,
      url: `https://aoifuture.com/news/${edition.edition_id}/#edition-${edition.edition_id}-${signal.id}`,
    })));
    expect(serializedTypes(metadata)).not.toContain('NewsArticle');
    expect(serializedTypes(metadata)).not.toContain('Article');
  });

  it('describes the News index and archive as collection pages, not authored articles', () => {
    const index = buildIndexMetadata(catalog);
    const archive = buildArchiveMetadata(catalog);
    expect(index).toMatchObject({ '@type': 'CollectionPage', url: 'https://aoifuture.com/news/' });
    expect(archive).toMatchObject({ '@type': 'CollectionPage', url: 'https://aoifuture.com/news/archive/' });
    expect(index.mainEntity.itemListElement[0].url).toBe('https://aoifuture.com/news/2026-07-24/');
    expect(index.mainEntity.itemListElement[1].url).toBe('https://aoifuture.com/news/2026-07-23/');
    expect(serializedTypes([index, archive])).not.toContain('NewsArticle');
  });

  it('describes Active Context as WebPage with public modified time and supporting source references', () => {
    const metadata = buildContextMetadata(context, catalog);
    expect(metadata).toMatchObject({
      '@type': 'WebPage',
      url: 'https://aoifuture.com/news/context/connected-ai-boundaries/',
      dateModified: context.updated_at,
    });
    expect(metadata.citation).toEqual(edition.items.map((signal) => ({
      '@type': 'CreativeWork',
      name: signal.source_title,
      url: signal.source_url,
    })));
    expect(serializedTypes(metadata)).not.toContain('NewsArticle');
  });

  it('uses public allowlisted values and excludes private metadata fields', () => {
    const metadata = serializedTypes([
      buildEditionMetadata(edition, events.at(-1).published_at),
      buildIndexMetadata(catalog),
      buildArchiveMetadata(catalog),
      buildContextMetadata(context, catalog),
    ]);
    for (const key of ['reviewed_by', 'receipt', 'claim_locator', 'internal_score', 'prompt', 'reader_id']) {
      expect(metadata).not.toContain(key);
    }
    expect(metadata).not.toContain('www.aoifuture.com');
  });

  it('fails closed when dated Edition metadata lacks a validated reviewed-event timestamp', () => {
    expect(() => buildEditionMetadata(edition)).toThrow(/reviewed revision event/i);
  });
});
