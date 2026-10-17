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

const packageScripts = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).scripts;

describe('AOIFUTURE News public gate script', () => {
  it('defines check:news-public as a self-contained review + production build verification', () => {
    const steps = (packageScripts['check:news-public'] ?? '').split('&&').map((step) => step.trim());
    expect(steps).toEqual([
      'VERCEL_ENV=preview npm run build',
      'VERCEL_ENV=preview npm run verify:news-build:review',
      'VERCEL_ENV=production npm run build',
      'VERCEL_ENV=production npm run verify:news-build:production',
    ]);
    for (const name of ['build', 'verify:news-build:review', 'verify:news-build:production']) {
      expect(packageScripts[name]).toBeTruthy();
    }
  });
});
