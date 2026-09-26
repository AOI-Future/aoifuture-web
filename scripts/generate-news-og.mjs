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
  instagram: { width: 1080, height: 1080 },
};

function truncate(value, max) {
  const s = String(value ?? '');
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

function fmtDate(iso) {
  return String(iso ?? '').slice(0, 10).replaceAll('-', '.');
}

export function buildDom({ edition, width, height, qrDataUrl }) {
  const vertical = height >= width;
  const s = width / 1200;
  const lead = edition.items.find((i) => i.role === 'lead') ?? edition.items[0];
  const majors = edition.items.filter((i) => i.role !== 'lead').slice(0, vertical ? 4 : 3);
  const headline = truncate(lead?.title ?? edition.title, vertical ? 40 : 44);
  const dek = truncate(edition.dek ?? lead?.source_fact ?? '', vertical ? 130 : 78);
  const rowColors = ['#ff7a59', '#ffc300', '#30d5c8', '#ff5fa2'];
  const px = (n) => `${Math.round(n * s)}px`;

  const rows = majors.map((item, idx) => [
    'div',
    { style: { display: 'flex', flexDirection: 'row', alignItems: 'flex-start', marginTop: vertical ? '26px' : '14px' } },
    ['div', { style: { display: 'flex', width: '38px', height: '38px', borderRadius: '10px', background: rowColors[idx % 4], color: '#0b1020', fontSize: '20px', fontWeight: 700, alignItems: 'center', justifyContent: 'center', marginRight: '14px', flexShrink: 0 } }, String(idx + 1)],
    ['div', { style: { display: 'flex', flexDirection: 'column' } },
      ['div', { style: { color: '#f5f7ff', fontSize: px(vertical ? 25 : 22), lineHeight: 1.45 } }, truncate(item.title, vertical ? 42 : 46)],
      ['div', { style: { color: '#8ea0c8', fontSize: px(vertical ? 19 : 17), marginTop: '6px', lineHeight: 1.5 } }, truncate(item.selection_reason ?? item.source_fact ?? '', vertical ? 80 : 64)],
    ],
  ]);

  return [
    'div',
    { style: { display: 'flex', flexDirection: 'column', width: `${width}px`, height: `${height}px`, background: 'linear-gradient(135deg, #0b1020 0%, #101a3a 55%, #1b1040 100%)', padding: vertical ? '46px' : '44px', boxSizing: 'border-box', position: 'relative' } },
    ['div', { style: { display: 'flex', position: 'absolute', top: 0, left: 0, width: `${width}px`, height: '10px', background: 'linear-gradient(90deg, #ff7a59, #ffc300, #30d5c8, #ff5fa2)' } }],
    ['div', { style: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' } },
      ['div', { style: { display: 'flex', flexDirection: 'row', alignItems: 'center' } },
        ['div', { style: { width: '14px', height: '14px', borderRadius: '50%', background: '#30d5c8', marginRight: '12px' } }],
        ['div', { style: { color: '#ffffff', fontSize: px(30), fontWeight: 700, letterSpacing: '2px' } }, 'AOIFUTURE NEWS'],
      ],
      ['div', { style: { color: '#8ea0c8', fontSize: px(24) } }, `${fmtDate(edition.edition_date)} 版 · ${edition.items.length}本`],
    ],
    ['div', { style: { display: 'flex', flexDirection: 'column', marginTop: vertical ? '36px' : '18px', borderLeft: '6px solid #ff7a59', paddingLeft: '22px' } },
      ['div', { style: { color: '#ffc300', fontSize: px(22), fontWeight: 700, letterSpacing: '3px' } }, '▷ 今日の主役'],
      ['div', { style: { color: '#ffffff', fontSize: px(vertical ? 44 : 38), lineHeight: 1.35, marginTop: '10px', fontWeight: 700 } }, headline],
      ['div', { style: { color: '#c6d2ee', fontSize: px(vertical ? 22 : 20), lineHeight: 1.6, marginTop: '12px' } }, dek],
    ],
    ['div', { style: { display: 'flex', flexDirection: 'column', marginTop: vertical ? '30px' : '18px' } }, ...rows],
    ['div', { style: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto' } },
      ['div', { style: { display: 'flex', flexDirection: 'column' } },
        ['div', { style: { display: 'flex', background: 'rgba(48,213,200,0.16)', border: '1.5px solid #30d5c8', color: '#30d5c8', borderRadius: '999px', padding: '7px 18px', fontSize: px(21) } }, '✅ 一次情報で検証済み · Verified by AOIFUTURE'],
        ['div', { style: { color: '#ffffff', fontSize: px(30), fontWeight: 700, marginTop: '14px', letterSpacing: '1px' } }, 'aoifuture.com'],
      ],
      ['img', { src: qrDataUrl, width: Math.round(132 * s), height: Math.round(132 * s), style: { borderRadius: '12px' } }],
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
    `▷ ${truncate(lead?.title ?? edition.title, 60)}`,
    ...others.map((i, n) => `${n + 1}. ${truncate(i.title, 48)}`),
    '',
    `✅ 一次情報で検証済み · Verified by AOIFUTURE`,
    url + '?utm_source=buffer&utm_medium=social&utm_campaign=edition-share',
  ].join('\n');
  const en = [
    `AOIFUTURE News — Edition ${edition.edition_date}`,
    `Lead: ${truncate(lead?.title_en ?? lead?.title ?? edition.title, 90)}`,
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
