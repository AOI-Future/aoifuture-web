import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const vercelConfig = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));

describe('AOIFUTURE News Vercel headers', () => {
  it('overrides only the Rolling Edition RSS content type', () => {
    expect(vercelConfig.headers).toEqual([
      {
        source: '/news/feed.xml',
        headers: [
          {
            key: 'Content-Type',
            value: 'application/rss+xml; charset=utf-8',
          },
        ],
      },
    ]);
  });
});
