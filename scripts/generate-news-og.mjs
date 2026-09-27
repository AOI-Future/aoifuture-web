#!/usr/bin/env node
// Generate per-Edition share cards (OG images) at build time.
// Tone: anime-accent x dense Japanese presentation-deck look; commentary-forward.
// Sizes: X 1200x630, LinkedIn 1200x627, Instagram 1080x1080.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import QRCode from 'qrcode';

const root = resolve(import.meta.dirname, '..');
const editionsDir = join(root, 'src/content/news/editions');
const outDir = join(root, 'public/og/news');
const fontPath = join(root, 'node_modules/@fontsource/noto-sans-jp/files/noto-sans-jp-japanese-400-normal.woff');
const fontBoldPath = join(root, 'node_modules/@fontsource/noto-sans-jp/files/noto-sans-jp-japanese-700-normal.woff');

const font = readFileSync(fontPath);
const fontBold = existsSync(fontBoldPath) ? readFileSync(fontBoldPath) : font;

export const sizes = {
  x: { width: 1200, height: 630 },
  linkedin: { width: 1200, height: 627 },
  instagram: { width: 1080, height: 1350 },
};

function truncate(value, max) {
  const s = String(value ?? '');
  if (s.length <= max) return s;
  // stop at a natural break (space, punctuation) near the limit instead of mid-word
  const cut = s.slice(0, max);
  const brk = Math.max(
    cut.lastIndexOf(' '), cut.lastIndexOf('、'), cut.lastIndexOf('・'),
    cut.lastIndexOf('，'), cut.lastIndexOf('。'), cut.lastIndexOf('）'),
  );
  return (brk > max * 0.5 ? cut.slice(0, brk) : cut.slice(0, max - 1)).replace(/[\s,・.、]+$/, '') + '…';
}

function fmtDate(iso) {
  return String(iso ?? '').slice(0, 10).replaceAll('-', '.');
}

const domainLabel = (d) => {
  const map = { 'github.blog': 'GitHub', 'huggingface.co': 'HF', 'www.anthropic.com': 'Anthropic', 'arxiv.org': 'arXiv', 'openai.com': 'OpenAI', 'research.ibm.com': 'IBM' };
  return map[d] ?? String(d).replace(/^www\./, '').split('.')[0].toUpperCase();
};
const roleColor = { lead: '#ff7a59', major: '#ffc300', brief: '#30d5c8', watch: '#8ea0c8' };

export function buildDom({ edition, width, height, qrDataUrl }) {
  const vertical = height >= width;
  const s = width / 1200;
  const px = (n) => `${Math.round(n * s)}px`;
  const lead = edition.items.find((i) => i.role === 'lead') ?? edition.items[0];
  const rest = edition.items.filter((i) => i !== lead);
  const headline = lead?.title ?? edition.title;
  const leadPoint = truncate(lead?.selection_reason ?? lead?.source_fact ?? edition.dek ?? '', vertical ? 170 : 130);
  const majorCount = edition.items.filter((i) => i.role === 'lead' || i.role === 'major').length;

  // treemap data: proportional blocks per source domain (Visual Capitalist pattern)
  const domainCounts = new Map();
  for (const it of edition.items) {
    const d = domainLabel(it.source_domain);
    domainCounts.set(d, (domainCounts.get(d) ?? 0) + 1);
  }
  const domains = [...domainCounts.entries()].sort((a, b) => b[1] - a[1]);
  const palette = ['#1f9d8f', '#d9a520', '#e0684b', '#b0559d', '#4f74c9', '#6f9c4b'];
  const total = edition.items.length || 1;

  const treemap = [
    'div', { style: { display: 'flex', flexDirection: 'column' } },
    ['div', { style: { color: '#8ea0c8', fontSize: px(vertical ? 24 : 16), fontWeight: 700, letterSpacing: '3px', marginBottom: px(10) } }, '今日の発生源 · SOURCES'],
    ['div', { style: { display: 'flex', flexDirection: 'row', width: '100%', height: px(vertical ? 240 : 190) } },
      ...domains.map(([d, n], idx) => [
        'div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexGrow: n, flexBasis: '0%', flexShrink: 1, height: '100%', background: palette[idx % palette.length], borderRadius: px(10), marginRight: idx === domains.length - 1 ? '0' : px(8), boxSizing: 'border-box', padding: px(6) } },
        ['div', { style: { color: '#ffffff', fontSize: px(vertical ? 72 : 52), fontWeight: 700, lineHeight: 1 } }, String(n)],
        ['div', { style: { color: 'rgba(255,255,255,0.92)', fontSize: px(vertical ? 26 : 19), fontWeight: 700, letterSpacing: '1px', marginTop: px(6), textAlign: 'center' } }, d],
      ]),
    ],
    ['div', { style: { color: '#8ea0c8', fontSize: px(vertical ? 22 : 15), marginTop: px(8) } }, `面積 = 本日${total}本の記事数按分`],
  ];

  const telop = (item, idx) => [
    'div', { style: { display: 'flex', flexDirection: 'row', alignItems: 'flex-start', marginBottom: px(vertical ? 13 : 12) } },
    ['div', { style: { display: 'flex', width: px(vertical ? 36 : 32), height: px(vertical ? 40 : 32), borderRadius: px(9), background: roleColor[item.role] ?? '#8ea0c8', color: '#0b1020', fontSize: px(vertical ? 22 : 17), fontWeight: 700, alignItems: 'center', justifyContent: 'center', marginRight: px(12), flexShrink: 0 } }, String(idx + 2)],
    ['div', { style: { display: 'flex', flexDirection: 'column', flex: 1 } },
      ['div', { style: { color: '#f5f7ff', fontSize: px(vertical ? 27 : 18), lineHeight: 1.4 } }, item.title],
      ['div', { style: { display: 'flex', flexDirection: 'row', marginTop: px(4) } },
        ['div', { style: { color: roleColor[item.role] ?? '#8ea0c8', fontSize: px(vertical ? 19 : 14), fontWeight: 700, letterSpacing: '1px', marginRight: px(10) } }, item.role === 'major' ? 'MAJOR' : item.role === 'brief' ? 'BRIEF' : 'WATCH'],
        ['div', { style: { color: '#8ea0c8', fontSize: px(vertical ? 19 : 14), letterSpacing: '1px' } }, domainLabel(item.source_domain)],
      ],
    ],
  ];

  const gridItems = rest.slice(0, vertical ? 5 : 4);
  const cols = vertical ? [gridItems, []] : [gridItems.slice(0, 2), gridItems.slice(2)];

  return [
    'div',
    { style: { display: 'flex', flexDirection: 'column', width: `${width}px`, height: `${height}px`, background: 'linear-gradient(135deg, #0b1020 0%, #101a3a 55%, #1b1040 100%)', padding: vertical ? '56px' : '40px', boxSizing: 'border-box', position: 'relative' } },
    ['div', { style: { display: 'flex', position: 'absolute', top: 0, left: 0, width: `${width}px`, height: px(10), background: 'linear-gradient(90deg, #ff7a59, #ffc300, #30d5c8, #ff5fa2)' } }],
    // header
    ['div', { style: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' } },
      ['div', { style: { display: 'flex', flexDirection: 'row', alignItems: 'center' } },
        ['div', { style: { width: px(14), height: px(14), borderRadius: '50%', background: '#30d5c8', marginRight: px(12) } }],
        ['div', { style: { color: '#ffffff', fontSize: px(vertical ? 34 : 30), fontWeight: 700, letterSpacing: '2px' } }, 'AOIFUTURE NEWS'],
      ],
      ['div', { style: { color: '#8ea0c8', fontSize: px(vertical ? 26 : 22) } }, `${fmtDate(edition.edition_date)} 版`],
    ],
    // hero row: big lead + treemap hero (visual-first)
    ['div', { style: { display: 'flex', flexDirection: vertical ? 'column' : 'row', marginTop: vertical ? '28px' : '22px', flex: vertical ? 'none' : 1 } },
      ['div', { style: { display: 'flex', flexDirection: 'column', width: vertical ? '100%' : '52%', paddingRight: vertical ? '0' : '32px', boxSizing: 'border-box' } },
        ['div', { style: { display: 'flex', alignItems: 'center' } },
          ['div', { style: { width: '0', height: '0', borderTop: `${px(9)} solid transparent`, borderBottom: `${px(9)} solid transparent`, borderLeft: `${px(14)} solid #ffc300`, marginRight: '12px' } }],
          ['div', { style: { color: '#ffc300', fontSize: px(vertical ? 26 : 22), fontWeight: 700, letterSpacing: '3px' } }, '今日の主役'],
        ],
        ['div', { style: { color: '#ffffff', fontSize: px(vertical ? 52 : 34), lineHeight: 1.3, marginTop: px(10), fontWeight: 700 } }, headline],
        ['div', { style: { color: '#c6d2ee', fontSize: px(vertical ? 27 : 16), lineHeight: 1.6, marginTop: px(12) } }, leadPoint],
        ['div', { style: { display: 'flex', flexDirection: 'row', marginTop: px(vertical ? 22 : 16) } },
          ['div', { style: { color: '#ffc300', fontSize: px(vertical ? 46 : 38), fontWeight: 700, lineHeight: 1, marginRight: px(10) } }, `${majorCount}`],
          ['div', { style: { color: '#8ea0c8', fontSize: px(vertical ? 24 : 18), letterSpacing: '1px' } }, `本が本日の主要信号 · 全${total}本`],
        ],
      ],
      ['div', { style: { display: 'flex', flexDirection: 'column', width: vertical ? '100%' : '48%', marginTop: vertical ? '34px' : '0', justifyContent: vertical ? 'center' : 'flex-end' } }, treemap],
    ],
    // telop grid
    ['div', { style: { display: 'flex', flexDirection: vertical ? 'column' : 'row', marginTop: vertical ? '22px' : '18px', paddingTop: px(14), borderTop: '1px solid rgba(142,160,200,0.3)' } },
      ['div', { style: { display: 'flex', flexDirection: 'column', width: vertical ? '100%' : '50%', paddingRight: px(14), boxSizing: 'border-box' } }, ...cols[0].map((item, idx) => telop(item, idx))],
      vertical ? null : ['div', { style: { display: 'flex', flexDirection: 'column', width: '50%' } }, ...cols[1].map((item, idx) => telop(item, idx + cols[0].length))],
    ].filter((n) => n !== null),
    // footer
    ['div', { style: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto', paddingTop: px(14) } },
      ['div', { style: { display: 'flex', flexDirection: 'column' } },
        ['div', { style: { color: '#30d5c8', fontSize: px(vertical ? 24 : 20), fontWeight: 700, letterSpacing: '1px' } }, '毎朝AIニュースをどっさり · AI News Daily'],
        ['div', { style: { color: '#ffffff', fontSize: px(vertical ? 34 : 28), fontWeight: 700, marginTop: px(8), letterSpacing: '1px' } }, 'aoifuture.com'],
      ],
      ['img', { src: qrDataUrl, width: Math.round((vertical ? 170 : 120) * s), height: Math.round((vertical ? 170 : 120) * s), style: { borderRadius: '12px' } }],
    ],
  ];
}

export function toVdom(node) {
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  const [tag, props = {}, ...children] = node;
  const kids = children.filter((c) => c !== null && c !== undefined && c !== '').map(toVdom);
  const mergedProps = { ...(props ?? {}) };
  if (tag === 'div' && !mergedProps.style) mergedProps.style = {};
  if (tag === 'div' && mergedProps.style && !mergedProps.style.display) {
    mergedProps.style = { ...mergedProps.style, display: 'flex' };
  }
  return {
    type: tag,
    props: { ...mergedProps, children: kids.length === 1 && typeof kids[0] === 'string' ? kids[0] : kids },
  };
}

async function renderCard(edition, key) {
  const size = sizes[key];
  const qr = await QRCode.toDataURL(`https://aoifuture.com/news/${edition.edition_id}/`, {
    margin: 1,
    width: 256,
    color: { dark: '#0b1020', light: '#ffffff' },
  });
  const dom = toVdom(buildDom({ edition, width: size.width, height: size.height, qrDataUrl: qr }));
  const svg = await satori(dom, {
    width: size.width,
    height: size.height,
    fonts: [
      { name: 'Noto Sans JP', data: font, weight: 400, style: 'normal' },
      { name: 'Noto Sans JP', data: fontBold, weight: 700, style: 'normal' },
    ],
  });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size.width } }).render().asPng();
  const outPath = join(outDir, `${edition.edition_id}-${key}.png`);
  writeFileSync(outPath, png);
  console.log(`generated ${outPath}`);
  return outPath;
}

function buildShareCopy(edition) {
  const url = `https://aoifuture.com/news/${edition.edition_id}/`;
  const lead = edition.items.find((i) => i.role === 'lead') ?? edition.items[0];
  const others = edition.items.filter((i) => i !== lead).slice(0, 2);
  const ja = [
    `【AOIFUTURE News ${fmtDate(edition.edition_date)}版】`,
    `▷ ${truncate(lead?.title ?? edition.title, 64)}`,
    ...others.map((i, n) => `${n + 1}. ${truncate(i.title, 52)}`),
    '',
    `✅ 一次情報で検証済み · Verified by AOIFUTURE`,
    url + '?utm_source=buffer&utm_medium=social&utm_campaign=edition-share',
  ].join('\n');
  const en = [
    `AOIFUTURE News — Edition ${edition.edition_date}`,
    `Lead: ${truncate(lead?.title_en ?? lead?.title ?? edition.title, 96)}`,
    '',
    '✅ Verified against primary sources',
    url + '?utm_source=buffer&utm_medium=social&utm_campaign=edition-share-en',
  ].join('\n');
  return {
    edition_id: edition.edition_id,
    url,
    instagram: ja,
    x: ja,
    linkedin_en: en,
    images: Object.keys(sizes).map((k) => `og/news/${edition.edition_id}-${k}.png`),
  };
}

export async function main() {
  mkdirSync(outDir, { recursive: true });
  const editions = readdirSync(editionsDir)
    .filter((n) => n.endsWith('.json'))
    .map((n) => JSON.parse(readFileSync(join(editionsDir, n), 'utf8')))
    .filter((e) => e.publication_status === 'public');
  const produced = [];
  const copies = [];
  for (const edition of editions) {
    for (const key of Object.keys(sizes)) {
      produced.push(await renderCard(edition, key));
    }
    copies.push(buildShareCopy(edition));
  }
  writeFileSync(join(outDir, 'share-copy-index.json'), JSON.stringify(copies, null, 2) + '\n');
  console.log(`OK: ${editions.length} editions, ${produced.length} cards, share-copy index`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
