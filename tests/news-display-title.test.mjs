import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { displayEditionTitle } from '../src/lib/news/display-title.mjs';
import { buildEditionMetadata, buildIndexMetadata } from '../src/lib/news/metadata.mjs';
import { renderRollingFeed } from '../scripts/news-contract/rolling-feed.mjs';

describe('Edition display title branding prefix', () => {
  it('strips leading brand prefixes in full-width and half-width variants', () => {
    expect(displayEditionTitle('AOIFUTURE News：気象AIの新時代')).toBe('気象AIの新時代');
    expect(displayEditionTitle('AOIFUTURE News: 気象AIの新時代')).toBe('気象AIの新時代');
    expect(displayEditionTitle('AOIFUTURE News — 気象AIの新時代')).toBe('気象AIの新時代');
    expect(displayEditionTitle('AOIFUTURE News - 気象AIの新時代')).toBe('気象AIの新時代');
  });

  it('leaves non-prefixed titles untouched', () => {
    expect(displayEditionTitle('接続するAI、運用境界を先に決める')).toBe('接続するAI、運用境界を先に決める');
    // brand term mid-title is not a prefix and must survive
    expect(displayEditionTitle('検証用 AOIFUTURE News サンプル')).toBe('検証用 AOIFUTURE News サンプル');
  });

  it('never returns an empty title when stripping would empty it', () => {
    expect(displayEditionTitle('AOIFUTURE News：')).toBe('AOIFUTURE News：');
  });

  it('source edition content keeps the authored prefix while rendered metadata drops it', () => {
    const editionsDir = new URL('../src/content/news/editions/', import.meta.url);
    const latest = readdirSync(editionsDir).filter((name) => name.endsWith('.json')).sort().at(-1);
    const edition = JSON.parse(readFileSync(new URL(latest, editionsDir), 'utf8'));
    const events = JSON.parse(readFileSync(new URL(`../src/content/news/events/${latest}`, import.meta.url), 'utf8'));
    const metadata = buildEditionMetadata(edition, events.at(-1).published_at);
    expect(metadata.name).toBe(displayEditionTitle(edition.title));
    expect(metadata.name).not.toMatch(/^AOIFUTURE\s+News\s*(?:：|:|—)/);
    const catalog = { editions: [edition], contexts: [] };
    expect(buildIndexMetadata(catalog).mainEntity.itemListElement[0].name).not.toMatch(/^AOIFUTURE\s+News\s*(?:：|:|—)/);
    const feed = renderRollingFeed(events, [edition], { mode: 'production' });
    expect(feed).toContain(`<title>${displayEditionTitle(edition.title)}</title>`);
  });
});
