import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';

const clientRoot = resolve(process.argv[2] ?? 'dist/client');
const routes = [
  ['news/index.html', 'https://aoifuture.com/news/'],
  ['news/2026-07-23/index.html', 'https://aoifuture.com/news/2026-07-23/'],
  ['news/context/agent-authority/index.html', 'https://aoifuture.com/news/context/agent-authority/'],
  ['news/archive/index.html', 'https://aoifuture.com/news/archive/'],
];
const forbiddenFontOrigins = /(?:fonts\.googleapis\.com|fonts\.gstatic\.com)/i;
const failures = [];
const cssPaths = new Set();

for (const [relativePath, expectedCanonical] of routes) {
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
  for (const [, href] of html.matchAll(/<link\b[^>]*\bhref=["']([^"']+\.css)["'][^>]*>/gi)) {
    cssPaths.add(join(clientRoot, href.replace(/^\//, '')));
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
  canonicalHost: 'aoifuture.com',
  externalFontUrls: 0,
  fontAssets: fontAssets.length,
  fontBytes,
  fontFiles: fontAssets,
}, null, 2));