import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { renderRollingFeed } from './news-contract/rolling-feed.mjs';

const clientRoot = resolve(process.argv[2] ?? 'dist/client');
const routes = [
  ['news/index.html', 'https://aoifuture.com/news/', 'CollectionPage'],
  ['news/2026-07-23/index.html', 'https://aoifuture.com/news/2026-07-23/', 'CollectionPage'],
  ['news/context/agent-authority/index.html', 'https://aoifuture.com/news/context/agent-authority/', 'WebPage'],
  ['news/archive/index.html', 'https://aoifuture.com/news/archive/', 'CollectionPage'],
];
const forbiddenFontOrigins = /(?:fonts\.googleapis\.com|fonts\.gstatic\.com)/i;
const failures = [];
const cssPaths = new Set();
const sampleEdition = JSON.parse(readFileSync(resolve('src/content/news/editions/2026-07-23.json'), 'utf8'));
const reviewedEvents = JSON.parse(readFileSync(resolve('src/content/news/events/2026-07-23.json'), 'utf8'));
const latestReviewedAt = reviewedEvents.at(-1)?.published_at;
let feedItemCount = 0;

for (const [relativePath, expectedCanonical, expectedType] of routes) {
  const path = join(clientRoot, relativePath);
  if (!existsSync(path)) {
    failures.push(`${relativePath}: generated HTML is missing`);
    continue;
  }
  const html = readFileSync(path, 'utf8');
  const canonicals = [...html.matchAll(/<link\b[^>]*\brel=["']canonical["'][^>]*>/gi)]
    .map(([tag]) => tag.match(/\bhref=["']([^"']+)["']/i)?.[1]);
  if (canonicals.length !== 1 || canonicals[0] !== expectedCanonical) {
    failures.push(`${relativePath}: expected one canonical ${expectedCanonical}, received ${JSON.stringify(canonicals)}`);
  }
  if (forbiddenFontOrigins.test(html)) failures.push(`${relativePath}: external font origin found in HTML`);
  if (!/<meta\s+name="robots"\s+content="noindex, nofollow"/.test(html)) failures.push(`${relativePath}: sample robots directive is missing`);
  if (!/<link\s+rel="alternate"\s+type="application\/rss\+xml"[^>]+href="\/news\/feed\.xml"/.test(html)) failures.push(`${relativePath}: feed discovery is missing`);
  if (!/<meta\s+property="og:title"/.test(html) || !/<meta\s+name="twitter:card"\s+content="summary"/.test(html)) failures.push(`${relativePath}: summary social metadata is incomplete`);
  if (/(?:og:image|twitter:image)/.test(html)) failures.push(`${relativePath}: generic social image metadata is forbidden`);
  const jsonLdMatch = html.match(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!jsonLdMatch) {
    failures.push(`${relativePath}: JSON-LD is missing`);
  } else {
    try {
      const jsonLd = JSON.parse(jsonLdMatch[1]);
      if (jsonLd['@type'] !== expectedType) failures.push(`${relativePath}: expected JSON-LD ${expectedType}, received ${jsonLd['@type']}`);
      if (JSON.stringify(jsonLd).includes('NewsArticle')) failures.push(`${relativePath}: Signal metadata must not use NewsArticle`);
      if (relativePath === 'news/2026-07-23/index.html' && jsonLd.dateModified !== latestReviewedAt) {
        failures.push(`${relativePath}: dateModified must equal the latest reviewed revision event`);
      }
    } catch (cause) {
      failures.push(`${relativePath}: JSON-LD is invalid (${cause.message})`);
    }
  }
  for (const [, href] of html.matchAll(/<link\b[^>]*\bhref=["']([^"']+\.css)["'][^>]*>/gi)) {
    cssPaths.add(join(clientRoot, href.replace(/^\//, '')));
  }
}

const feedPath = join(clientRoot, 'news/feed.xml');
if (!existsSync(feedPath)) {
  failures.push('news/feed.xml: generated RSS is missing');
} else {
  const feed = readFileSync(feedPath, 'utf8');
  feedItemCount = reviewedEvents.length;
  const expected = renderRollingFeed(reviewedEvents, [sampleEdition], { sample: true });
  if (feed !== expected) failures.push('news/feed.xml: generated RSS differs from deterministic reviewed-event rendering');
  if ((feed.match(/<item>/g) ?? []).length !== reviewedEvents.length) failures.push('news/feed.xml: item count does not match reviewed public events');
  for (const term of ['reviewed_by', 'receipt', 'claim_locator', 'source_body', 'reader_id']) {
    if (feed.toLowerCase().includes(term)) failures.push(`news/feed.xml: private term found (${term})`);
  }
}

for (const path of cssPaths) {
  const css = readFileSync(path, 'utf8');
  if (forbiddenFontOrigins.test(css) || /url\(["']?https?:\/\//i.test(css)) {
    failures.push(`${path}: external URL found in News CSS`);
  }
  if (!/@font-face/.test(css) || !/font-display:swap/.test(css)) {
    failures.push(`${path}: expected self-hosted font-face declarations with font-display swap`);
  }
}

const assetRoot = join(clientRoot, '_astro');
const fontAssets = readdirSync(assetRoot)
  .filter((name) => extname(name) === '.woff2' && /(?:noto-sans-jp|jetbrains-mono)/.test(name))
  .sort();
if (fontAssets.length !== 5) failures.push(`expected exactly five News WOFF2 assets, received ${fontAssets.length}`);
const fontBytes = fontAssets.reduce((sum, name) => sum + statSync(join(assetRoot, name)).size, 0);

for (const notice of ['licenses/news-fonts/NOTICE.md', 'licenses/news-fonts/OFL-1.1.txt']) {
  if (!existsSync(join(clientRoot, notice))) failures.push(`${notice}: license material missing from build`);
}

if (failures.length) {
  console.error(JSON.stringify({ ok: false, failures }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  routes: routes.length,
  feedItems: feedItemCount,
  canonicalHost: 'aoifuture.com',
  externalFontUrls: 0,
  fontAssets: fontAssets.length,
  fontBytes,
  fontFiles: fontAssets,
}, null, 2));