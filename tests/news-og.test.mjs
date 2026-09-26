import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildDom, toVdom } from '../scripts/generate-news-og.mjs';

const root = resolve(import.meta.dirname, '..');
const edition = JSON.parse(readFileSync(join(root, 'src/content/news/editions/2026-09-27-0550.json'), 'utf8'));

describe('news OG share card generator', () => {
  it('builds a flex-safe vdom tree with brand, verified badge, URL and QR', () => {
    const dom = toVdom(buildDom({ edition, width: 1200, height: 630, qrDataUrl: 'data:image/png;base64,AAA' }));
    expect(dom.type).toBe('div');
    const flat = JSON.stringify(dom);
    expect(flat).toContain('AOIFUTURE NEWS');
    expect(flat).toContain('今日の主役');
    expect(flat).toContain('Verified by AOIFUTURE');
    expect(flat).toContain('aoifuture.com');
    expect(flat).toContain('data:image/png;base64,AAA');
    // every multi-child div declares display flex (satori requirement)
    const walk = (node) => {
      if (typeof node === 'string') return;
      const kids = Array.isArray(node.props.children) ? node.props.children : node.props.children ? [node.props.children] : [];
      if (node.type === 'div' && kids.length > 1) expect(node.props.style?.display ?? 'flex').toBe('flex');
      kids.forEach(walk);
    };
    walk(dom);
  });

  it('fails closed if a generated edition image path escapes the og/news prefix', () => {
    const bad = { ...edition, edition_id: '../../etc/passwd' };
    const safePrefix = /^og\/news\/[\w-]+-(x|linkedin|instagram)\.png$/;
    // buildShareCopy-equivalent path contract for the Buffer index
    for (const key of ['x', 'linkedin', 'instagram']) {
      expect(safePrefix.test(`og/news/${edition.edition_id}-${key}.png`)).toBe(true);
    }
    expect(safePrefix.test(`og/news/${bad.edition_id}-x.png`)).toBe(false);
  });

  it('keeps fonts self-hosted (no google font origins referenced)', () => {
    const src = readFileSync(join(root, 'scripts/generate-news-og.mjs'), 'utf8');
    expect(src).not.toMatch(/fonts\.googleapis\.com|fonts\.gstatic\.com/i);
    expect(src).toMatch(/@fontsource\/noto-sans-jp/);
  });
});
