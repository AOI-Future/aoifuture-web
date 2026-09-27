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

  // site palette (src/styles/news.css): #071010 surface, #73ffff cyan, #d7cdb0 parchment
  const CYAN = '#73ffff';
  const TEAL = '#3bb8b8';
  const PARCH = '#d7cdb0';
  const INK = '#071010';

  // editorial theme extracted from the edition title "AOIFUTURE News：<要点>——<補足>"
  const rawTitle = String(edition.title ?? '').replace(/^AOIFUTURE News[:：]/, '');
  const themeMain = rawTitle.split('——')[0].trim() || (lead?.title ?? edition.title);

  const majorCount = edition.items.filter((i) => i.role === 'lead' || i.role === 'major').length;

  // lead explainer beats: split the lead's source_fact into up to 3 story beats
  // (reader-facing walkthrough of THE story, not internal source/topic ratios)
  const leadFact = String(lead?.source_fact ?? '');
  const leadTitle = String(lead?.title ?? '');
  const splitBeats = (text) => String(text ?? '')
    .split('。')
    .map((b) => b.trim())
    .filter((b) => b.length > 0)
    // drop beats that restate the lead headline (reader sees it right above)
    .filter((b) => b.length < 20 || !leadTitle || (b.slice(0, 12) !== leadTitle.slice(0, 12) && !leadTitle.includes(b.slice(0, 10))));
  let beats = splitBeats(leadFact);
  if (beats.length < 2) beats = [...beats, ...splitBeats(lead?.selection_reason).filter((b) => !beats.includes(b))];
  beats = beats.slice(0, 3);
  const beatLabels = beats.length >= 3 ? ['今日の話の筋', '一手目', 'その結果'] : ['今日の話の筋', 'その先に'];

  const beatBlock = (beat, idx) => [
    'div', { style: { display: 'flex', flexDirection: 'column', flexGrow: 1, flexBasis: '0%', flexShrink: 1, minWidth: 0, boxSizing: 'border-box', border: `1px solid rgba(115,255,255,0.35)`, borderRadius: px(12), padding: vertical ? px(18) : px(12), background: idx === 0 ? 'rgba(115,255,255,0.10)' : 'rgba(59,184,184,0.07)' } },
      ['div', { style: { display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: px(8) } },
        ['div', { style: { width: px(vertical ? 14 : 12), height: px(vertical ? 14 : 12), borderRadius: '50%', background: idx === 0 ? CYAN : TEAL, marginRight: px(8), flexShrink: 0 } }],
        ['div', { style: { color: idx === 0 ? CYAN : PARCH, fontSize: px(vertical ? 20 : 13), fontWeight: 700, letterSpacing: '2px' } }, beatLabels[idx] ?? 'ポイント'],
      ],
      ['div', { style: { color: '#ededed', fontSize: px(vertical ? 26 : 15), lineHeight: 1.55 } }, beat],
    ];

  const beatArrow = ['div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: vertical ? `${px(6)} 0` : `0 ${px(8)}` } },
    vertical
      ? ['div', { style: { width: 0, height: 0, borderLeft: `${px(10)} solid transparent`, borderRight: `${px(10)} solid transparent`, borderTop: `${px(14)} solid ${TEAL}` } }]
      : ['div', { style: { width: 0, height: 0, borderTop: `${px(10)} solid transparent`, borderBottom: `${px(10)} solid transparent`, borderLeft: `${px(16)} solid ${TEAL}` } }],
  ];

  const roleColor = { lead: CYAN, major: CYAN, brief: TEAL, watch: PARCH };
  const telop = (item, idx) => [
    'div', { style: { display: 'flex', flexDirection: 'row', alignItems: 'flex-start', marginBottom: px(vertical ? 13 : 7) } },
    ['div', { style: { display: 'flex', width: px(vertical ? 36 : 30), height: px(vertical ? 36 : 30), borderRadius: px(8), background: roleColor[item.role] ?? TEAL, color: INK, fontSize: px(vertical ? 21 : 16), fontWeight: 700, alignItems: 'center', justifyContent: 'center', marginRight: px(12), flexShrink: 0 } }, String(idx + 2)],
    ['div', { style: { display: 'flex', flexDirection: 'column', flex: 1 } },
      ['div', { style: { color: '#ededed', fontSize: px(vertical ? 27 : 16), lineHeight: 1.45 } }, item.title],
      ['div', { style: { display: 'flex', flexDirection: 'row', marginTop: px(4) } },
        ['div', { style: { color: roleColor[item.role] ?? TEAL, fontSize: px(vertical ? 18 : 13), fontWeight: 700, letterSpacing: '1px', marginRight: px(10) } }, item.role === 'major' ? 'MAJOR' : item.role === 'brief' ? 'BRIEF' : 'WATCH'],
        ['div', { style: { color: '#b6b6b6', fontSize: px(vertical ? 18 : 13), letterSpacing: '1px' } }, domainLabel(item.source_domain)],
      ],
    ],
  ];

  const gridItems = rest.slice(0, vertical ? 5 : 4);
  const cols = vertical ? [gridItems, []] : [gridItems.slice(0, 2), gridItems.slice(2)];

  return [
    'div',
    { style: { display: 'flex', flexDirection: 'column', width: `${width}px`, height: `${height}px`, background: 'linear-gradient(160deg, #071010 0%, #0a1816 60%, #0d211d 100%)', padding: vertical ? '56px' : '40px', boxSizing: 'border-box', position: 'relative' } },
    ['div', { style: { display: 'flex', position: 'absolute', top: 0, left: 0, width: `${width}px`, height: px(8), background: `linear-gradient(90deg, ${CYAN}, ${TEAL}, ${PARCH})` } }],
    // header
    ['div', { style: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' } },
      ['div', { style: { display: 'flex', flexDirection: 'row', alignItems: 'center' } },
        ['div', { style: { width: px(14), height: px(14), borderRadius: '50%', background: CYAN, marginRight: px(12) } }],
        ['div', { style: { color: '#ededed', fontSize: px(vertical ? 34 : 28), fontWeight: 700, letterSpacing: '3px' } }, 'AOIFUTURE NEWS'],
      ],
      ['div', { style: { color: '#b6b6b6', fontSize: px(vertical ? 26 : 21) } }, `${fmtDate(edition.edition_date)} 版 · ${edition.items.length}本`],
    ],
    // editorial theme kicker — the reason to read
    ['div', { style: { display: 'flex', flexDirection: 'column', marginTop: vertical ? '34px' : '14px' } },
      ['div', { style: { color: PARCH, fontSize: px(vertical ? 24 : 16), fontWeight: 700, letterSpacing: '4px' } }, '今日のエディトリアルテーマ'],
      ['div', { style: { color: CYAN, fontSize: px(vertical ? 64 : 34), fontWeight: 700, lineHeight: 1.25, marginTop: px(10) } }, themeMain],
    ],
    // lead story explainer — THE news, told in beats (hero visual zone)
    ['div', { style: { display: 'flex', flexDirection: 'column', marginTop: vertical ? '36px' : '16px', paddingTop: px(vertical ? 18 : 12), borderTop: '1px solid rgba(115,255,255,0.25)' } },
      ['div', { style: { display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: px(vertical ? 14 : 8) } },
        ['div', { style: { width: 0, height: 0, borderTop: `${px(9)} solid transparent`, borderBottom: `${px(9)} solid transparent`, borderLeft: `${px(14)} solid ${CYAN}`, marginRight: px(12), flexShrink: 0 } }],
        ['div', { style: { color: '#ededed', fontSize: px(vertical ? 30 : 15), fontWeight: 700, lineHeight: 1.4 } }, lead?.title ?? edition.title],
      ],
      ['div', { style: { display: 'flex', flexDirection: vertical ? 'column' : 'row', width: '100%', flexGrow: 1, flexShrink: 1, minHeight: 0 } },
        ...beats.flatMap((beat, idx) => [
          ...(idx > 0 ? [beatArrow] : []),
          beatBlock(beat, idx),
        ]),
      ],
    ],
    // telop grid
    ['div', { style: { display: 'flex', flexDirection: vertical ? 'column' : 'row', marginTop: vertical ? '26px' : '12px', paddingTop: px(vertical ? 14 : 10), borderTop: '1px solid rgba(115,255,255,0.25)' } },
      ['div', { style: { display: 'flex', flexDirection: 'column', width: vertical ? '100%' : '50%', paddingRight: px(14), boxSizing: 'border-box' } }, ...cols[0].map((item, idx) => telop(item, idx))],
      vertical ? null : ['div', { style: { display: 'flex', flexDirection: 'column', width: '50%', paddingRight: px(12), boxSizing: 'border-box' } }, ...cols[1].map((item, idx) => telop(item, idx + cols[0].length))],
    ].filter((n) => n !== null),
    // footer
    ['div', { style: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto', paddingTop: px(8), minHeight: px(vertical ? 160 : 76), flexShrink: 0 } },
      ['div', { style: { display: 'flex', flexDirection: 'column' } },
        ['div', { style: { color: PARCH, fontSize: px(vertical ? 24 : 16), fontWeight: 700, letterSpacing: '1px' } }, `今日の${majorCount}本は一次情報で読める · aoifuture.com`],
        ['div', { style: { color: '#b6b6b6', fontSize: px(vertical ? 20 : 13), marginTop: px(6) } }, '毎朝更新 · AI News Daily'],
      ],
      ['img', { src: qrDataUrl, width: Math.round((vertical ? 160 : 100) * s), height: Math.round((vertical ? 160 : 100) * s), style: { borderRadius: '10px' } }],
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
