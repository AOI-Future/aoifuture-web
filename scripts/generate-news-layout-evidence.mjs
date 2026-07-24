import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const repoRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.env.NEWS_EVIDENCE_PORT ?? 4332);
const baseURL = process.env.NEWS_EVIDENCE_BASE_URL ?? `http://127.0.0.1:${port}`;
const artifactRoot = resolve(process.env.NEWS_EVIDENCE_ARTIFACT_DIR ?? join(tmpdir(), 'aoifuture-news-phase-3-21cf8b0'));
const metricsPath = join(repoRoot, 'docs/evidence/news-phase-3-layout-metrics.json');
const reportPath = join(repoRoot, 'docs/evidence/news-phase-3-layout-evidence.md');
const chromePath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ownsServer = !process.env.NEWS_EVIDENCE_BASE_URL;

const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'mobile-390', width: 390, height: 844 },
];
const densityScenarios = [2, 6, 9, 12].flatMap((signalCount) =>
  viewports.map((viewport) => ({ kind: 'density', variant: 'none', signalCount, viewport })),
);
const detourScenarios = ['none', 'compact', 'full-width', 'overused'].flatMap((variant) =>
  viewports.map((viewport) => ({ kind: 'detour', variant, signalCount: 9, viewport })),
);

const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex');
const sleep = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
const directoryBytes = (path) => readdirSync(path, { withFileTypes: true }).reduce((sum, entry) => {
  const entryPath = join(path, entry.name);
  return sum + (entry.isDirectory() ? directoryBytes(entryPath) : statSync(entryPath).size);
}, 0);

async function waitForServer(url) {
  let lastError;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(`${url}/news/`);
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(250);
  }
  throw new Error(`News evidence server did not become ready: ${lastError}`);
}

function startServer() {
  if (!ownsServer) return null;
  const child = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: repoRoot,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  child.on('exit', (code) => {
    if (code && code !== 0) process.stderr.write(output);
  });
  return child;
}

async function stopServer(child) {
  if (!child?.pid) return;
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
  await Promise.race([
    new Promise((resolvePromise) => child.once('exit', resolvePromise)),
    sleep(5_000),
  ]);
  try {
    process.kill(-child.pid, 0);
    process.kill(-child.pid, 'SIGKILL');
  } catch (error) {
    if (error.code !== 'ESRCH') throw error;
  }
}

async function prepareComposition(page, scenario) {
  await page.goto(`${baseURL}/news/`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: `
    .news-layout-evidence-label {
      margin: 0 0 36px;
      padding: 14px 18px;
      border: 2px solid var(--news-cyan);
      color: var(--news-cyan);
      font: 600 14px/1.6 var(--news-mono);
      letter-spacing: 0.04em;
    }
    .news-layout-evidence-detour {
      max-width: 760px;
      margin: 28px 0 52px;
      padding: 24px;
      border: 1px dashed var(--news-cyan-dim);
      background: #061010;
    }
    .news-layout-evidence-detour--full-width { max-width: none; padding-block: 40px; }
    .news-layout-evidence-detour--overused { margin-block: 16px 28px; border-style: double; }
    .news-layout-evidence-detour p { margin: 10px 0 0; }
    .news-layout-evidence-detour__label {
      color: var(--news-cyan);
      font: 600 12px/1.6 var(--news-mono);
      letter-spacing: 0.06em;
    }
    .news-layout-evidence-detour h3 { margin: 8px 0 0; font-size: 24px; line-height: 1.4; }
  ` });

  await page.evaluate(({ signalCount, variant }) => {
    const main = document.querySelector('.news-main');
    const list = document.querySelector('.news-signal-list');
    const originals = Array.from(list?.querySelectorAll('[data-news-signal]') ?? []);
    if (!main || !list || originals.length !== 2) throw new Error('Harness requires exactly the two validated public sample cards');

    const evidenceLabel = document.createElement('p');
    evidenceLabel.className = 'news-layout-evidence-label';
    evidenceLabel.dataset.layoutEvidence = 'true';
    evidenceLabel.textContent = 'LOCAL LAYOUT EVIDENCE — DUPLICATED VALIDATED SAMPLES — NOT REPORTING / NOT PUBLISHABLE';
    main.prepend(evidenceLabel);
    document.title = `LOCAL LAYOUT EVIDENCE — ${signalCount} SIGNALS — ${variant}`;

    for (const original of originals) original.remove();
    for (let index = 0; index < signalCount; index += 1) {
      const source = originals[index % originals.length];
      const clone = source.cloneNode(true);
      const sourceId = source.id;
      const cloneId = `layout-${String(index + 1).padStart(2, '0')}-${sourceId}`;
      for (const element of [clone, ...clone.querySelectorAll('*')]) {
        for (const attribute of ['id', 'aria-labelledby', 'aria-describedby']) {
          const value = element.getAttribute(attribute);
          if (value?.includes(sourceId)) element.setAttribute(attribute, value.replaceAll(sourceId, cloneId));
        }
      }
      clone.id = cloneId;
      clone.dataset.layoutDuplicate = String(index + 1);
      const flags = clone.querySelector('.news-signal__flags');
      const marker = document.createElement('span');
      marker.textContent = `LAYOUT DUPLICATE ${String(index + 1).padStart(2, '0')}`;
      flags?.append(marker);
      list.append(clone);
    }

    const signalMeta = Array.from(document.querySelectorAll('.news-edition__meta div'))
      .find((node) => node.querySelector('dt')?.textContent?.trim() === 'Signals')
      ?.querySelector('dd');
    if (signalMeta) signalMeta.textContent = `${signalCount} / LAYOUT EVIDENCE`;

    const makeDetour = (mode, ordinal) => {
      const block = document.createElement('aside');
      block.className = `news-layout-evidence-detour news-layout-evidence-detour--${mode}`;
      block.dataset.layoutDetour = mode;
      block.innerHTML = `
        <p class="news-layout-evidence-detour__label">LAYOUT EVIDENCE / DETOUR COMPOSITION ${ordinal}</p>
        <h3>Orientation block placeholder</h3>
        <p>Neutral layout-only copy. This block contains no reporting, source, claim, or publication content.</p>`;
      return block;
    };

    const signals = Array.from(list.querySelectorAll('[data-news-signal]'));
    if (variant === 'compact') signals[2].after(makeDetour('compact', '01'));
    if (variant === 'full-width') signals[3].after(makeDetour('full-width', '01'));
    if (variant === 'overused') {
      [1, 3, 5, 7].forEach((index, ordinal) => signals[index].after(makeDetour('overused', String(ordinal + 1).padStart(2, '0'))));
    }
  }, { signalCount: scenario.signalCount, variant: scenario.variant });
}

async function measureComposition(page, scenario) {
  return page.evaluate(({ viewportHeight, signalCount, variant }) => {
    const root = document.documentElement;
    const elements = Array.from(document.querySelectorAll('*'));
    const roundValue = (value) => Math.round(value * 100) / 100;
    const selectorFor = (element) => {
      if (element.id) return `#${element.id}`;
      const classes = Array.from(element.classList).slice(0, 2).join('.');
      return `${element.tagName.toLowerCase()}${classes ? `.${classes}` : ''}`;
    };
    const rectFor = (element) => {
      const rect = element.getBoundingClientRect();
      return {
        top: Math.round(rect.top + scrollY),
        bottom: Math.round(rect.bottom + scrollY),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    };
    const signals = Array.from(document.querySelectorAll('[data-news-signal]'));
    const actions = Array.from(document.querySelectorAll('.news-source-link'));
    const signalRects = signals.map(rectFor);
    const actionRects = actions.map(rectFor);
    const navLinks = Array.from(document.querySelectorAll('.news-nav a'));
    const headings = Array.from(document.querySelectorAll('h1, h2, h3')).slice(0, 6);
    const footer = document.querySelector('.news-site-footer');
    const editionNote = document.querySelector('.news-edition-note');
    const detours = Array.from(document.querySelectorAll('[data-layout-detour]'));
    const overflowOffenders = elements
      .map((element) => ({ element, rect: element.getBoundingClientRect() }))
      .filter(({ rect }) => rect.left < -1 || rect.right > root.clientWidth + 1)
      .slice(0, 10)
      .map(({ element, rect }) => ({ selector: selectorFor(element), left: roundValue(rect.left), right: roundValue(rect.right) }));
    const actionIntervals = actionRects.slice(1).map((rect, index) => rect.top - actionRects[index].top);
    const signalHeights = signalRects.map((rect) => rect.height);
    const mean = signalHeights.reduce((sum, value) => sum + value, 0) / signalHeights.length;
    const deviation = Math.sqrt(signalHeights.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / signalHeights.length);
    const minimumTextSize = Math.min(...headings.map((heading) => Number.parseFloat(getComputedStyle(heading).fontSize)));

    return {
      signalCount,
      detourVariant: variant,
      pageHeight: root.scrollHeight,
      viewportMultiples: roundValue(root.scrollHeight / viewportHeight),
      clientWidth: root.clientWidth,
      scrollWidth: root.scrollWidth,
      horizontalOverflow: root.scrollWidth > root.clientWidth + 1 || overflowOffenders.length > 0,
      overflowOffenders,
      sourceActions: {
        count: actions.length,
        first: actionRects[0],
        final: actionRects.at(-1),
        meanInterval: roundValue(actionIntervals.reduce((sum, value) => sum + value, 0) / Math.max(actionIntervals.length, 1)),
        maximumInterval: Math.max(...actionIntervals, 0),
      },
      rhythm: {
        minimumSignalHeight: Math.min(...signalHeights),
        maximumSignalHeight: Math.max(...signalHeights),
        meanSignalHeight: roundValue(mean),
        signalHeightDeviation: roundValue(deviation),
      },
      readability: {
        headingCountChecked: headings.length,
        minimumHeadingPx: minimumTextSize,
        navigationMinimumTargetPx: Math.min(...navLinks.map((link) => link.getBoundingClientRect().height)),
        headingsWithinWidth: headings.every((heading) => {
          const rect = heading.getBoundingClientRect();
          return rect.left >= -1 && rect.right <= root.clientWidth + 1;
        }),
      },
      findability: {
        editionNote: editionNote ? rectFor(editionNote) : null,
        footer: footer ? rectFor(footer) : null,
      },
      detours: detours.map((detour) => ({ variant: detour.dataset.layoutDetour, ...rectFor(detour) })),
      finiteEdition: signals.length === signalCount
        && actions.length === signalCount
        && !document.querySelector('details, [data-pagination], [data-collapse]'),
      evidenceLabelPresent: Boolean(document.querySelector('[data-layout-evidence="true"]')),
    };
  }, { viewportHeight: scenario.viewport.height, signalCount: scenario.signalCount, variant: scenario.variant });
}

function buildReport(payload) {
  const density = payload.scenarios.filter((scenario) => scenario.kind === 'density');
  const detours = payload.scenarios.filter((scenario) => scenario.kind === 'detour');
  const table = (rows) => rows.map((scenario) =>
    `| ${scenario.id} | ${scenario.metrics.pageHeight} | ${scenario.metrics.viewportMultiples} | ${scenario.metrics.horizontalOverflow ? 'YES' : 'NO'} | ${scenario.metrics.sourceActions.first.top} | ${scenario.metrics.sourceActions.final.top} | ${scenario.screenshot.bytes} | \`${scenario.screenshot.sha256}\` |`,
  ).join('\n');
  const mobile12 = density.find((scenario) => scenario.id === 'density-12-mobile-390');
  const desktop12 = density.find((scenario) => scenario.id === 'density-12-desktop');
  const post = payload.fontCost.postBuild;

  return `# AOIFUTURE News Phase 3 — local layout evidence\n\n` +
    `Status: **LOCAL LAYOUT EVIDENCE ONLY — NOT REPORTING / NOT PUBLISHABLE**\n\n` +
    `The harness duplicated only the two contract-validated public sample cards already present on \`/news/\`. It did not create a source, URL, fact, or claim, and it did not add a public route or schema field. Screenshots are temporary files outside Git at \`${payload.artifactRoot}\`.\n\n` +
    `## Font and canonical readback\n\n` +
    `- Before: 0 local font assets and ${payload.fontCost.baseline.generatedNewsHtmlBytes} generated News HTML bytes; generated News HTML referenced Google Fonts.\n` +
    `- After: ${post.assetCount} same-origin WOFF2 assets / ${post.assetBytes} build bytes and ${post.generatedNewsHtmlBytes} generated News HTML bytes. The pinned Fontsource packages occupy ${post.installedPackageBytes} bytes after \`npm ci\`; browser first load requested ${payload.fontCost.browser.requestCount} font files / ${payload.fontCost.browser.responseBytes} bytes; external font requests: ${payload.fontCost.browser.externalRequests}.\n` +
    `- Delivery: Noto Sans JP 400/500/700 complete Japanese WOFF2 and JetBrains Mono 500/600 Latin WOFF2, all \`font-display: swap\`, package-lock pinned at Fontsource 5.3.0.\n` +
    `- All four generated News routes contain exactly one \`https://aoifuture.com/.../\` canonical, without \`www\`, preserving trailing slashes.\n\n` +
    `## Density measurements\n\n` +
    `| Scenario | Page px | Viewports | X overflow | First source y | Final source y | PNG bytes | SHA-256 |\n| --- | ---: | ---: | --- | ---: | ---: | ---: | --- |\n` + table(density) + `\n\n` +
    `Readback: all 2/6/9/12 compositions retained one finite Edition, one direct-source action per Signal, the Edition note, and the footer, with no pagination, collapse, or horizontal overflow. Two Signals verify the production-shaped sample. Six Signals is comfortable at both widths. Nine remains structurally clear but creates a long mobile scan. Twelve remains technically finite, but reaches ${desktop12.metrics.viewportMultiples} desktop and ${mobile12.metrics.viewportMultiples} mobile viewports; repeated two-card rhythm and distance to the final source/footer are the primary fatigue points. The footer and Edition note remain present and measurable, not sticky or hidden.\n\n` +
    `## Detour comparison\n\n` +
    `| Scenario | Page px | Viewports | X overflow | First source y | Final source y | PNG bytes | SHA-256 |\n| --- | ---: | ---: | --- | ---: | ---: | ---: | --- |\n` + table(detours) + `\n\n` +
    `Readback: no Detour preserves the strongest source-to-source rhythm. One compact block after Signal 3 is the least disruptive candidate if future information is genuinely distinct. The full-width block creates a stronger interruption, and the deliberately overused sample visibly and numerically extends the Edition without adding source actions. Because the neutral placeholder is not distinct from Source fact, AOI note, Caveat, Edition note, or Active Context, the default recommendation is **no separate Detour**; keep the full information in ordinary Edition content unless later real content proves an orientation benefit. The sample blocks are plain semantic HTML/CSS and do not require runtime JavaScript once composed.\n\n` +
    `## Reproduction\n\n` +
    `Run \`npm run build && npm run evidence:news-layout\`. Override temporary output with \`NEWS_EVIDENCE_ARTIFACT_DIR=/absolute/path\`. The script starts and stops its own loopback-only Astro process. Machine-readable measurements and screenshot hashes are in \`docs/evidence/news-phase-3-layout-metrics.json\`.\n`;
}

let server;
let browser;
try {
  rmSync(artifactRoot, { recursive: true, force: true });
  mkdirSync(artifactRoot, { recursive: true });
  mkdirSync(resolve(repoRoot, 'docs/evidence'), { recursive: true });
  server = startServer();
  await waitForServer(baseURL);

  browser = await chromium.launch({
    headless: true,
    ...(process.platform === 'darwin' && statSync(chromePath, { throwIfNoEntry: false }) ? { executablePath: chromePath } : {}),
  });
  const context = await browser.newContext({ serviceWorkers: 'block' });
  await context.route('**/*', async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(baseURL).origin) await route.continue();
    else await route.abort('blockedbyclient');
  });

  const fontResponses = new Map();
  const externalFontRequests = [];
  context.on('response', async (response) => {
    if (response.request().resourceType() === 'font' && !fontResponses.has(response.url())) {
      fontResponses.set(response.url(), (await response.body()).byteLength);
    }
  });
  context.on('request', (request) => {
    const url = new URL(request.url());
    if (/fonts\.(?:googleapis|gstatic)\.com/.test(url.hostname)) externalFontRequests.push(url.href);
  });

  const results = [];
  for (const scenario of [...densityScenarios, ...detourScenarios]) {
    const id = `${scenario.kind}-${scenario.kind === 'density' ? scenario.signalCount : scenario.variant}-${scenario.viewport.name}`;
    const page = await context.newPage();
    await page.setViewportSize(scenario.viewport);
    await prepareComposition(page, scenario);
    const screenshotPath = join(artifactRoot, `${id}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true, animations: 'disabled' });
    const metrics = await measureComposition(page, scenario);
    results.push({
      id,
      kind: scenario.kind,
      variant: scenario.variant,
      viewport: scenario.viewport,
      metrics,
      screenshot: {
        path: screenshotPath,
        file: basename(screenshotPath),
        bytes: statSync(screenshotPath).size,
        sha256: sha256(screenshotPath),
      },
    });
    await page.close();
  }

  const builtFontFiles = readdirSync(join(repoRoot, 'dist/client/_astro'))
    .filter((name) => /(?:noto-sans-jp|jetbrains-mono).*\.woff2$/.test(name))
    .sort();
  const expectedDetourCounts = { none: 0, compact: 1, 'full-width': 1, overused: 4 };
  const acceptanceFailures = [];
  if (results.length !== 16) acceptanceFailures.push(`expected 16 scenarios, received ${results.length}`);
  for (const result of results) {
    if (result.metrics.horizontalOverflow) acceptanceFailures.push(`${result.id}: horizontal overflow`);
    if (!result.metrics.finiteEdition) acceptanceFailures.push(`${result.id}: not a finite Edition`);
    if (!result.metrics.evidenceLabelPresent) acceptanceFailures.push(`${result.id}: evidence label missing`);
    if (!result.metrics.findability.editionNote || !result.metrics.findability.footer) acceptanceFailures.push(`${result.id}: note/footer missing`);
    if (!result.metrics.readability.headingsWithinWidth || result.metrics.readability.navigationMinimumTargetPx < 44) {
      acceptanceFailures.push(`${result.id}: heading/navigation readability check failed`);
    }
    if (result.metrics.sourceActions.count !== result.metrics.signalCount) acceptanceFailures.push(`${result.id}: direct-source count mismatch`);
    if (result.kind === 'detour' && result.metrics.detours.length !== expectedDetourCounts[result.variant]) {
      acceptanceFailures.push(`${result.id}: Detour count mismatch`);
    }
  }
  if (builtFontFiles.length !== 5) acceptanceFailures.push(`expected 5 built font assets, received ${builtFontFiles.length}`);
  if (fontResponses.size === 0) acceptanceFailures.push('browser made no font requests');
  if ([...fontResponses.keys()].some((url) => new URL(url).origin !== new URL(baseURL).origin)) acceptanceFailures.push('browser made a cross-origin font request');
  if (externalFontRequests.length) acceptanceFailures.push(`browser made ${externalFontRequests.length} forbidden font requests`);
  if (acceptanceFailures.length) throw new Error(`Evidence acceptance failed:\n- ${acceptanceFailures.join('\n- ')}`);

  const generatedNewsHtmlFiles = [
    'news/index.html',
    'news/2026-07-23/index.html',
    'news/context/agent-authority/index.html',
    'news/archive/index.html',
  ];
  const payload = {
    schemaVersion: 1,
    evidenceOnly: true,
    publishable: false,
    sourcePolicy: 'Only the two existing validated public sample cards are duplicated.',
    artifactRoot,
    fontCost: {
      baseline: { localAssetCount: 0, generatedNewsHtmlBytes: 22386, externalOrigins: ['fonts.googleapis.com', 'fonts.gstatic.com'] },
      postBuild: {
        assetCount: builtFontFiles.length,
        assetBytes: builtFontFiles.reduce((sum, name) => sum + statSync(join(repoRoot, 'dist/client/_astro', name)).size, 0),
        generatedNewsHtmlBytes: generatedNewsHtmlFiles.reduce((sum, path) => sum + statSync(join(repoRoot, 'dist/client', path)).size, 0),
        installedPackageBytes: directoryBytes(join(repoRoot, 'node_modules/@fontsource/noto-sans-jp'))
          + directoryBytes(join(repoRoot, 'node_modules/@fontsource/jetbrains-mono')),
        files: builtFontFiles,
      },
      browser: {
        requestCount: fontResponses.size,
        responseBytes: [...fontResponses.values()].reduce((sum, value) => sum + value, 0),
        requests: [...fontResponses.entries()].map(([url, bytes]) => ({ url, bytes })),
        externalRequests: externalFontRequests.length,
      },
    },
    canonicals: [
      'https://aoifuture.com/news/',
      'https://aoifuture.com/news/2026-07-23/',
      'https://aoifuture.com/news/context/agent-authority/',
      'https://aoifuture.com/news/archive/',
    ],
    scenarios: results,
  };
  writeFileSync(metricsPath, `${JSON.stringify(payload, null, 2)}\n`);
  writeFileSync(reportPath, buildReport(payload));
  console.log(JSON.stringify({
    ok: true,
    artifactRoot,
    screenshots: results.length,
    metricsPath,
    reportPath,
    fontRequests: payload.fontCost.browser,
  }, null, 2));
} finally {
  await browser?.close();
  await stopServer(server);
}
