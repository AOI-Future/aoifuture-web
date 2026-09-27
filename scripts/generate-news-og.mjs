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
  const themeSub = rawTitle.includes('——') ? rawTitle.split('——').slice(1).join('——').trim() : '';

  // topic intensity: what areas fired today (reader-facing labels)
  const topicMeta = new Map((edition.topics ?? []).map((t) => [t.id, t.label_ja ?? t.id]));
  const topicCounts = new Map();
  for (const it of edition.items) {
    for (const t of it.topics ?? []) {
      const label = topicMeta.get(t) ?? t;
      topicCounts.set(label, (topicCounts.get(label) ?? 0) + 1);
    }
  }
  const topicsSorted = [...topicCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxT = topicsSorted[0]?.[1] ?? 1;

  const majorCount = edition.items.filter((i) => i.role === 'lead' || i.role === 'major').length;

  const topicTile = (label, n, idx) => {
    const sizePct = 0.55 + 0.45 * (n / maxT);
    const font = Math.round((vertical ? 34 : 21) * sizePct);
    return ['div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexGrow: n, flexBasis: '0%', flexShrink: 1, height: px(vertical ? 110 : 74), background: idx === 0 ? CYAN : idx === 1 ? TEAL : idx === 2 ? PARCH : 'rgba(115,255,255,0.14)', color: idx < 3 ? INK : '#ededed', borderRadius: px(12), marginRight: idx === topicsSorted.length - 1 ? '0' : px(8), boxSizing: 'border-box', padding: px(6) } },
      ['div', { style: { fontSize: `${font}px`, fontWeight: 700, lineHeight: 1.15, letterSpacing: '1px', textAlign: 'center' } }, label],
      ['div', { style: { fontSize: px(vertical ? 24 : 15), fontWeight: 700, marginTop: px(3), opacity: 0.85 } }, `${n}本`],
    ];
  };

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
  const leadPoint = truncate(lead?.selection_reason ?? lead?.source_fact ?? edition.dek ?? '', vertical ? 150 : 58);

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
    // editorial theme hero — the reason to read
    ['div', { style: { display: 'flex', flexDirection: 'column', marginTop: vertical ? '40px' : '18px' } },
      ['div', { style: { color: PARCH, fontSize: px(vertical ? 24 : 16), fontWeight: 700, letterSpacing: '4px' } }, '今日のエディトリアルテーマ'],
      ['div', { style: { color: CYAN, fontSize: px(vertical ? 68 : 36), fontWeight: 700, lineHeight: 1.25, marginTop: px(10) } }, themeMain],
      themeSub ? ['div', { style: { color: '#ededed', fontSize: px(vertical ? 28 : 16), lineHeight: 1.5, marginTop: px(10) } }, themeSub] : null,
    ].filter((n) => n !== null),
    // topic intensity strip — what areas fired today
    ['div', { style: { display: 'flex', flexDirection: 'column', marginTop: vertical ? '36px' : '16px' } },
      ['div', { style: { color: '#b6b6b6', fontSize: px(vertical ? 22 : 14), fontWeight: 700, letterSpacing: '3px', marginBottom: px(10) } }, '今日何が動いたか · TOPICS（複数該当）'],
      ['div', { style: { display: 'flex', flexDirection: 'row', width: '100%' } },
        ...topicsSorted.map(([label, n], idx) => topicTile(label, n, idx)),
      ],
    ],
    // lead + one-line why
    ['div', { style: { display: 'flex', flexDirection: 'row', alignItems: 'flex-start', marginTop: vertical ? '34px' : '14px' } },
      ['div', { style: { width: '0', height: '0', borderTop: `${px(9)} solid transparent`, borderBottom: `${px(9)} solid transparent`, borderLeft: `${px(14)} solid ${CYAN}`, marginRight: px(12), marginTop: px(8) } }],
      ['div', { style: { display: 'flex', flexDirection: 'column', flex: 1 } },
        ['div', { style: { color: '#ededed', fontSize: px(vertical ? 30 : 15), fontWeight: 700, lineHeight: 1.4 } }, lead?.title ?? edition.title],
        vertical ? ['div', { style: { color: '#b6b6b6', fontSize: px(24), lineHeight: 1.5, marginTop: px(8) } }, leadPoint] : null,
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
