import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { renderRollingFeed, validateRevisionEvents } from './news-contract/rolling-feed.mjs';
import { validatePublicCatalog } from './news-contract/validator.mjs';
import { resolveNewsPublicationMode } from '../src/lib/news/publication-mode.mjs';

const clientRoot = resolve(process.argv[2] ?? 'dist/client');
const expectedMode = process.argv[3];
const actualMode = resolveNewsPublicationMode(process.env.VERCEL_ENV);
if (!['review', 'production'].includes(expectedMode) || expectedMode !== actualMode) {
  console.error(`News verifier mode mismatch: expected argument review|production matching VERCEL_ENV, received ${expectedMode ?? '(missing)'} / ${actualMode}`);
  process.exit(2);
}

const jsonFiles = (directory) => readdirSync(resolve(directory))
  .filter((name) => name.endsWith('.json'))
  .sort()
  .map((name) => JSON.parse(readFileSync(resolve(directory, name), 'utf8')));
const allEditions = jsonFiles('src/content/news/editions');
const allContexts = jsonFiles('src/content/news/contexts');
const allEvents = jsonFiles('src/content/news/events').flat();
const catalogValidation = validatePublicCatalog(allEditions, allContexts);
const eventValidation = validateRevisionEvents(allEvents, allEditions);
if (!catalogValidation.ok || !eventValidation.ok) {
  console.error(JSON.stringify({ catalogValidation, eventValidation }, null, 2));
  process.exit(1);
}

const visibleEditions = expectedMode === 'production'
  ? allEditions.filter((item) => item.publication_status === 'public')
  : allEditions;
const visibleContexts = expectedMode === 'production'
  ? allContexts.filter((item) => item.publication_status === 'public')
  : allContexts;
const visibleIds = new Set(visibleEditions.map((item) => item.edition_id));
const visibleEvents = allEvents.filter((event) => visibleIds.has(event.edition_id));
const hiddenEditions = allEditions.filter((item) => !visibleIds.has(item.edition_id));
const visibleContextIds = new Set(visibleContexts.map((item) => item.id));
const hiddenContexts = allContexts.filter((item) => !visibleContextIds.has(item.id));

const routes = [
  ['news/index.html', 'https://aoifuture.com/news/', 'CollectionPage'],
  ...visibleEditions.map((edition) => [`news/${edition.edition_id}/index.html`, `https://aoifuture.com/news/${edition.edition_id}/`, 'CollectionPage']),
  ...visibleContexts.map((context) => [`news/context/${context.slug}/index.html`, `https://aoifuture.com/news/context/${context.slug}/`, 'WebPage']),
  ['news/archive/index.html', 'https://aoifuture.com/news/archive/', 'CollectionPage'],
];
const hiddenRoutes = [
  ...hiddenEditions.map((edition) => `news/${edition.edition_id}/index.html`),
  ...hiddenContexts.map((context) => `news/context/${context.slug}/index.html`),
];
const failures = [];
const cssPaths = new Set();
const latestReviewedAt = new Map(allEvents.map((event) => [event.edition_id, event.published_at]));
const forbiddenFontOrigins = /(?:fonts\.googleapis\.com|fonts\.gstatic\.com)/i;
const reviewOnlyWording = /EDITORIAL REVIEW PREVIEW|NON-PRODUCTION|review-only|No production publication/i;

for (const [relativePath, expectedCanonical, expectedType] of routes) {
  const path = join(clientRoot, relativePath);
  if (!existsSync(path)) {
    failures.push(`${relativePath}: generated HTML is missing`);
    continue;
  }
  const html = readFileSync(path, 'utf8');
  const canonicals = [...html.matchAll(/<link\b[^>]*\brel=["']canonical["'][^>]*>/gi)]
    .map(([tag]) => tag.match(/\bhref=["']([^"']+)["']/i)?.[1]);
  if (canonicals.length !== 1 || canonicals[0] !== expectedCanonical || canonicals[0]?.includes('through=')) {
    failures.push(`${relativePath}: invalid canonical ${JSON.stringify(canonicals)}`);
  }
  const robots = expectedMode === 'production' ? 'index, follow' : 'noindex, nofollow';
  if (!html.includes(`name="robots" content="${robots}"`)) failures.push(`${relativePath}: expected robots ${robots}`);
  if (expectedMode === 'production' && reviewOnlyWording.test(html)) failures.push(`${relativePath}: review wording leaked`);
  if (expectedMode === 'review' && !html.includes('EDITORIAL REVIEW PREVIEW')) failures.push(`${relativePath}: review wording missing`);
  if (forbiddenFontOrigins.test(html)) failures.push(`${relativePath}: external font origin found`);
  const jsonLdMatch = html.match(/<script\s+type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!jsonLdMatch) failures.push(`${relativePath}: JSON-LD missing`);
  else {
    try {
      const jsonLd = JSON.parse(jsonLdMatch[1]);
      if (jsonLd['@type'] !== expectedType || JSON.stringify(jsonLd).includes('NewsArticle')) failures.push(`${relativePath}: JSON-LD type invalid`);
      const editionId = relativePath.match(/^news\/([0-9-]+)\/index\.html$/)?.[1];
      if (editionId && jsonLd.dateModified !== latestReviewedAt.get(editionId)) failures.push(`${relativePath}: dateModified invalid`);
    } catch (cause) { failures.push(`${relativePath}: JSON-LD invalid (${cause.message})`); }
  }
  for (const [, href] of html.matchAll(/<link\b[^>]*\bhref=["']([^"']+\.css)["'][^>]*>/gi)) cssPaths.add(join(clientRoot, href.replace(/^\//, '')));
}
for (const route of hiddenRoutes) if (existsSync(join(clientRoot, route))) failures.push(`${route}: hidden route leaked`);

const feedPath = join(clientRoot, 'news/feed.xml');
if (!existsSync(feedPath)) failures.push('news/feed.xml: missing');
else {
  const feed = readFileSync(feedPath, 'utf8');
  const expected = renderRollingFeed(visibleEvents, visibleEditions, { mode: expectedMode });
  if (feed !== expected) failures.push('news/feed.xml: differs from deterministic visible feed');
}

const walk = (directory) => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name);
  return entry.isDirectory() ? walk(path) : [path];
});
const sitemapFiles = walk(clientRoot).filter((path) => /sitemap.*\.xml$/.test(path));
const sitemap = sitemapFiles.map((path) => readFileSync(path, 'utf8')).join('\n');
for (const [, canonical] of routes) if (!sitemap.includes(canonical)) failures.push(`sitemap: missing ${canonical}`);
for (const route of hiddenRoutes) {
  const url = `https://aoifuture.com/${route.replace(/index\.html$/, '')}`;
  if (sitemap.includes(url)) failures.push(`sitemap: hidden URL leaked ${url}`);
}

if (expectedMode === 'production') {
  const hiddenTerms = [
    ...hiddenEditions.flatMap((edition) => [
      ...(edition.edition_id.length > 10 ? [edition.edition_id] : []),
      edition.title,
      ...edition.items.flatMap((signal) => [signal.title, signal.source_url, signal.source_title]),
    ]),
    ...hiddenContexts.flatMap((context) => [context.id, context.slug, context.title]),
    ...allEvents.filter((event) => !visibleIds.has(event.edition_id)).flatMap((event) => [event.event_id, event.title, event.summary, event.edition_url]),
  ].filter((term) => typeof term === 'string' && term.length >= 4);
  const publicArtifacts = walk(clientRoot).filter((path) => /(?:\/news\/.*\.(?:html|xml)|sitemap.*\.xml)$/.test(path));
  const publicArtifactContents = publicArtifacts.map((path) => [path, readFileSync(path, 'utf8')]);
  const corpus = publicArtifactContents.map(([, content]) => content).join('\n');
  for (const [path, content] of publicArtifactContents) {
    if (reviewOnlyWording.test(content)) failures.push(`${path}: review wording leaked into production HTML/XML`);
  }
  for (const term of hiddenTerms) if (corpus.includes(term)) failures.push(`production artifact leak: ${term}`);
}

for (const path of cssPaths) {
  const css = readFileSync(path, 'utf8');
  if (forbiddenFontOrigins.test(css) || /url\(["']?https?:\/\//i.test(css)) failures.push(`${path}: external URL found in News CSS`);
  if (!/@font-face/.test(css) || !/font-display:swap/.test(css)) failures.push(`${path}: font-face/font-display missing`);
}
const assetRoot = join(clientRoot, '_astro');
const fontAssets = readdirSync(assetRoot).filter((name) => extname(name) === '.woff2' && /(?:noto-sans-jp|jetbrains-mono)/.test(name)).sort();
if (fontAssets.length !== 5) failures.push(`expected exactly five News WOFF2 assets, received ${fontAssets.length}`);
const fontBytes = fontAssets.reduce((sum, name) => sum + statSync(join(assetRoot, name)).size, 0);
for (const notice of ['licenses/news-fonts/NOTICE.md', 'licenses/news-fonts/OFL-1.1.txt']) if (!existsSync(join(clientRoot, notice))) failures.push(`${notice}: missing`);

if (failures.length) {
  console.error(JSON.stringify({ ok: false, mode: expectedMode, failures }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, mode: expectedMode, routes: routes.length, hiddenRoutes: hiddenRoutes.length, feedItems: visibleEvents.length, fontAssets: fontAssets.length, fontBytes }, null, 2));