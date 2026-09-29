import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { validatePresentation, trustBadge } from '../scripts/generate-news-poster.mjs';

const root = resolve(import.meta.dirname, '..');
const load = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));
const edition = load('src/content/news/editions/2026-09-27-0550.json');
const presentation = load('src/content/news/presentations/2026-09-27-0550.json');

describe('news poster presentation quality gate', () => {
  it('accepts a complete 3x3 presentation with accessible contrast', () => {
    const result = validatePresentation(edition, presentation);
    expect(result.ok).toBe(true);
    expect(result.item_count).toBe(9);
    expect(Math.min(...Object.values(result.contrast))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(['…', '→', '🚀', '✅'])('rejects unsupported or truncation glyph %s', (glyph) => {
    const invalid = structuredClone(presentation);
    invalid.dek += glyph;
    expect(validatePresentation(edition, invalid).errors).toContain('forbidden glyph/ellipsis/emoji');
  });

  it('derives the trust badge from per-item verification provenance', () => {
    expect(trustBadge(edition)).toBe('一次情報 再読確認 9件');
    const unverified = structuredClone(edition);
    unverified.items[0].verification.status = 'pending';
    expect(trustBadge(unverified)).toBe('情報 9件');
  });

  it('fails closed on malformed presentation shapes', () => {
    expect(validatePresentation(edition, null).errors).toContain('presentation must be an object');
    const malformed = structuredClone(presentation);
    delete malformed.kicker;
    delete malformed.conclusion;
    malformed.headline_lines = [null];
    malformed.hero = { nodes: ['a'.repeat(9), 'b', 'c'], caption: 'x'.repeat(25) };
    malformed.groups[0].item_ids = ['only-one'];
    const errors = validatePresentation(edition, malformed).errors.join('\n');
    expect(errors).toMatch(/kicker required/);
    expect(errors).toMatch(/conclusion required/);
    expect(errors).toMatch(/headline line must be a non-empty string/);
    expect(errors).toMatch(/hero node invalid/);
    expect(errors).toMatch(/hero caption required/);
    expect(errors).toMatch(/each group requires exactly 3 items/);
  });

  it('rejects accent item and short_title keys outside the edition', () => {
    const invalid = structuredClone(presentation);
    invalid.accent_item_id = 'not-an-item';
    invalid.short_titles['ghost-key'] = 'ghost';
    const errors = validatePresentation(edition, invalid).errors.join('\n');
    expect(errors).toMatch(/accent_item_id must be one of the grouped items/);
    expect(errors).toMatch(/unknown short_title key/);
  });

  it('rejects a missing, duplicated, or overly long social headline', () => {
    const invalid = structuredClone(presentation);
    const first = invalid.groups[0].item_ids[0];
    invalid.groups[0].item_ids[0] = invalid.groups[0].item_ids[1];
    delete invalid.short_titles[first];
    invalid.short_titles[invalid.groups[0].item_ids[1]] = '長'.repeat(31);
    const errors = validatePresentation(edition, invalid).errors.join('\n');
    expect(errors).toMatch(/cover each item exactly once/);
    expect(errors).toMatch(/missing grouped item/);
    expect(errors).toMatch(/missing short title|over 30 chars/);
  });

  it('rejects awkwardly long headline lines and incomplete group structure', () => {
    const invalid = structuredClone(presentation);
    invalid.headline_lines = ['長'.repeat(17)];
    invalid.groups = invalid.groups.slice(0, 2);
    const errors = validatePresentation(edition, invalid).errors.join('\n');
    expect(errors).toMatch(/headline line too long/);
    expect(errors).toMatch(/exactly 3 groups required/);
  });
});
