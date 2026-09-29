#!/usr/bin/env node
// AOIFUTURE one-sheet SNS poster. Editorial text lives in a presentation sidecar;
// published Edition JSON remains immutable/hash-bound.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import QRCode from 'qrcode';
import { toVdom } from './generate-news-og.mjs';

const root = resolve(import.meta.dirname, '..');
const editionsDir = join(root, 'src/content/news/editions');
const presentationsDir = join(root, 'src/content/news/presentations');
const outRoot = join(root, 'public/og/news/poster');
const font = readFileSync(join(root, 'node_modules/@fontsource/noto-sans-jp/files/noto-sans-jp-japanese-400-normal.woff'));
const boldPath = join(root, 'node_modules/@fontsource/noto-sans-jp/files/noto-sans-jp-japanese-700-normal.woff');
const fontBold = existsSync(boldPath) ? readFileSync(boldPath) : font;

const W = 1080;
const H = 1350;
const T = {
  ivory: '#f7f5ef', ink: '#142320', teal: '#087e78', pale: '#e7f2ee',
  amber: '#d78a32', muted: '#526762', line: '#bfd6d0', white: '#ffffff', dark: '#102522',
};
const TYPE = {
  headline: 58, headlineLine: 64,
  dek: 30, dekLine: 42,
  heroNode: 30, heroCaption: 25,
  group: 30, item: 24, itemLine: 32,
  meta: 19, footer: 18, conclusion: 29,
};
const FORBIDDEN = /[…\u2192\uFE0F\u3010\u3011\p{Extended_Pictographic}\uD800-\uDFFF\uFFFD]/u;
const M = 48;

// Publisher (not platform) label; verified against the edition's source_url path when possible.
const publisherLabel = (item) => {
  const path = String(item.source_url ?? '');
  const hfPublisher = /huggingface\.co\/blog\/([^/]+)\//.exec(path)?.[1];
  if (hfPublisher) return ({
    'nvidia': 'NVIDIA', 'ibm-research': 'IBM Research', 'huggingface': 'HF',
  })[hfPublisher] ?? hfPublisher.toUpperCase();
  return ({
    'github.blog': 'GitHub', 'www.anthropic.com': 'Anthropic',
    'arxiv.org': 'arXiv', 'openai.com': 'OpenAI', 'research.ibm.com': 'IBM',
  })[String(item.source_domain)] ?? String(item.source_domain).replace(/^www\./, '').split('.')[0].toUpperCase();
};
const fmtDate = (iso) => String(iso ?? '').slice(0, 10).replaceAll('-', '.');
const cleanDisplayText = (value) => String(value ?? '')
  .replaceAll('コードの旁边', 'コードのそば')
  .replaceAll('Repository状态', 'リポジトリの状態')
  .replaceAll('状态', '状態')
  .replaceAll('判别', '判別')
  .replaceAll('本页', '本ページ');

function contrastRatio(hexA, hexB) {
  const lum = (hex) => {
    const rgb = hex.slice(1).match(/../g).map((v) => parseInt(v, 16) / 255).map((v) => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  };
  const [a, b] = [lum(hexA), lum(hexB)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

export function validatePresentation(edition, presentation) {
  const errors = [];
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const str = (v) => typeof v === 'string' && v.trim().length > 0;
  if (!isObj(presentation)) return { ok: false, errors: ['presentation must be an object'], contrast: {}, item_count: 0 };
  if (presentation.schema_version !== 'news-poster-presentation.v1') errors.push('schema_version');
  if (presentation.edition_id !== edition.edition_id) errors.push('edition_id mismatch');
  if (!str(presentation.kicker)) errors.push('kicker required');
  if (!str(presentation.dek)) errors.push('dek required');
  else if ([...presentation.dek].length > 34) errors.push('dek too long');
  if (!str(presentation.conclusion)) errors.push('conclusion required');
  if (!Array.isArray(presentation.headline_lines) || presentation.headline_lines.length < 1 || presentation.headline_lines.length > 2) errors.push('headline_lines must contain 1-2 lines');
  const allText = JSON.stringify(presentation) ?? '';
  if (FORBIDDEN.test(allText)) errors.push('forbidden glyph/ellipsis/emoji');
  for (const line of presentation.headline_lines ?? []) {
    if (!str(line)) errors.push('headline line must be a non-empty string');
    else if ([...line].length > 16) errors.push(`headline line too long: ${line}`);
  }
  if (!isObj(presentation.hero) || !Array.isArray(presentation.hero.nodes) || presentation.hero.nodes.length !== 3) errors.push('hero requires exactly 3 nodes');
  for (const node of presentation.hero?.nodes ?? []) if (!str(node) || [...node].length > 8) errors.push(`hero node invalid: ${node}`);
  if (!isObj(presentation.hero) || !str(presentation.hero.caption) || [...presentation.hero.caption].length > 24) errors.push('hero caption required, max 24 chars');
  const editionIds = edition.items.map((i) => i.id);
  const grouped = (presentation.groups ?? []).flatMap((g) => Array.isArray(g?.item_ids) ? g.item_ids : []);
  if (!Array.isArray(presentation.groups) || presentation.groups.length !== 3) errors.push('exactly 3 groups required');
  for (const g of presentation.groups ?? []) {
    if (!isObj(g) || !str(g.label) || [...g.label].length > 8) errors.push('group label required, max 8 chars');
    if (!Array.isArray(g?.item_ids) || g.item_ids.length !== 3) errors.push('each group requires exactly 3 items');
  }
  if (grouped.length !== editionIds.length || new Set(grouped).size !== grouped.length) errors.push('groups must cover each item exactly once');
  for (const id of editionIds) {
    if (!grouped.includes(id)) errors.push(`missing grouped item: ${id}`);
    const title = presentation.short_titles?.[id];
    if (!title) errors.push(`missing short title: ${id}`);
    else if ([...title].length > 30) errors.push(`short title over 30 chars: ${id}`);
  }
  for (const id of grouped) if (!editionIds.includes(id)) errors.push(`unknown item: ${id}`);
  if (!grouped.includes(presentation.accent_item_id)) errors.push('accent_item_id must be one of the grouped items');
  const shortKeys = Object.keys(presentation.short_titles ?? {});
  for (const key of shortKeys) if (!editionIds.includes(key)) errors.push(`unknown short_title key: ${key}`);
  const contrast = {
    ink_on_ivory: contrastRatio(T.ink, T.ivory), muted_on_ivory: contrastRatio(T.muted, T.ivory),
    white_on_dark: contrastRatio(T.white, T.dark), white_on_teal: contrastRatio(T.white, T.teal),
  };
  if (contrast.ink_on_ivory < 4.5 || contrast.muted_on_ivory < 4.5 || contrast.white_on_dark < 4.5 || contrast.white_on_teal < 4.5) errors.push('contrast below 4.5:1');
  if (Math.min(TYPE.item, TYPE.dek, TYPE.heroCaption) < 24) errors.push('important body text below 24px');
  return { ok: errors.length === 0, errors, contrast, item_count: editionIds.length };
}

// Trust badge is derived only from per-item verification provenance in the edition.
export function trustBadge(edition) {
  const allVerified = edition.items.length > 0 && edition.items.every((item) => item.verification?.status === 'verified');
  return allVerified ? `一次情報 再読確認 ${edition.items.length}件` : `情報 ${edition.items.length}件`;
}

async function qrDataUrl(url) {
  return QRCode.toDataURL(url, { margin: 1, width: 320, color: { dark: T.dark, light: '#ffffff' } });
}

const cssArrow = () => ['div', { style: { display: 'flex', alignItems: 'center', margin: '0 14px', flexShrink: 0 } },
  ['div', { style: { width: '34px', height: '4px', background: T.teal } }],
  ['div', { style: { width: 0, height: 0, borderTop: '9px solid transparent', borderBottom: '9px solid transparent', borderLeft: `14px solid ${T.teal}` } }],
];

function itemCard(item, title, accented) {
  return ['div', { style: {
    display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '104px',
    background: accented ? '#fff4df' : T.white, border: `2px solid ${accented ? T.amber : T.line}`,
    borderRadius: '16px', padding: '14px 16px', boxSizing: 'border-box',
  } },
    ['div', { style: { color: T.ink, fontSize: `${TYPE.item}px`, lineHeight: `${TYPE.itemLine}px`, fontWeight: 700 } }, cleanDisplayText(title)],
    ['div', { style: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', color: T.muted, fontSize: `${TYPE.meta}px`, marginTop: '8px' } },
      ['div', {}, publisherLabel(item)],
      ['div', {}, fmtDate(item.published_at)],
    ],
  ];
}

export async function buildPoster(edition, presentation) {
  const check = validatePresentation(edition, presentation);
  if (!check.ok) throw new Error(`poster presentation invalid:\n- ${check.errors.join('\n- ')}`);
  const byId = new Map(edition.items.map((item) => [item.id, item]));
  const noteUrl = `aoifuture.com/news/${edition.edition_id}`;
  const qr = await qrDataUrl(`https://${noteUrl}`);

  return ['div', { style: {
    display: 'flex', flexDirection: 'column', width: `${W}px`, height: `${H}px`, background: T.ivory,
    color: T.ink, padding: `42px ${M}px 32px`, boxSizing: 'border-box', position: 'relative', fontFamily: 'Noto Sans JP',
  } },
    ['div', { style: { display: 'flex', position: 'absolute', top: 0, left: 0, width: `${W}px`, height: '10px', background: `linear-gradient(90deg,${T.teal},#20a59b,${T.amber})` } }],

    // Brand and compact trust cue.
    ['div', { style: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' } },
      ['div', { style: { color: T.teal, fontSize: '21px', fontWeight: 700, letterSpacing: '3px' } }, 'AOIFUTURE EXPLAINED'],
      ['div', { style: { display: 'flex', flexDirection: 'row', alignItems: 'center' } },
        ['div', { style: { background: T.teal, color: T.white, borderRadius: '999px', padding: '6px 15px', fontSize: '20px', fontWeight: 700, marginRight: '12px' } }, trustBadge(edition)],
        ['div', { style: { color: T.muted, fontSize: '20px' } }, `${fmtDate(edition.edition_date)} 版`],
      ],
    ],

    // Focal zone: 32% of canvas (headline + visual).
    ['div', { style: { display: 'flex', flexDirection: 'row', alignItems: 'stretch', marginBottom: '20px' } },
      ['div', { style: { display: 'flex', flexDirection: 'column', width: '62%', paddingRight: '24px', boxSizing: 'border-box' } },
        ['div', { style: { color: T.amber, fontSize: '23px', fontWeight: 700, letterSpacing: '2px', marginBottom: '8px' } }, presentation.kicker],
        ...presentation.headline_lines.map((line) => ['div', { style: { color: T.dark, fontSize: `${TYPE.headline}px`, lineHeight: `${TYPE.headlineLine}px`, fontWeight: 700, letterSpacing: '-2px', whiteSpace: 'nowrap' } }, line]),
        ['div', { style: { color: T.teal, fontSize: `${TYPE.dek}px`, lineHeight: `${TYPE.dekLine}px`, fontWeight: 700, marginTop: '12px' } }, presentation.dek],
      ],
      ['div', { style: { display: 'flex', flexDirection: 'column', justifyContent: 'center', width: '38%', background: T.pale, borderRadius: '24px', padding: '24px 20px', boxSizing: 'border-box', border: `2px solid ${T.line}` } },
        ['div', { style: { display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'center' } },
          ...presentation.hero.nodes.flatMap((node, index) => [
            ['div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100px', minHeight: '82px', background: index === 1 ? T.teal : T.white, color: index === 1 ? T.white : T.ink, borderRadius: '16px', border: `2px solid ${T.teal}`, padding: '8px', boxSizing: 'border-box', fontSize: `${TYPE.heroNode}px`, lineHeight: '36px', fontWeight: 700, textAlign: 'center' } }, node],
            ...(index < presentation.hero.nodes.length - 1 ? [cssArrow()] : []),
          ]),
        ],
        ['div', { style: { color: T.ink, fontSize: `${TYPE.heroCaption}px`, lineHeight: '36px', textAlign: 'center', fontWeight: 700, marginTop: '20px' } }, presentation.hero.caption],
      ],
    ],

    // Three balanced editorial modules, each with three news items.
    ['div', { style: { display: 'flex', flexDirection: 'row', gap: '16px', marginBottom: '18px' } },
      ...presentation.groups.map((group, groupIndex) => ['div', { style: { display: 'flex', flexDirection: 'column', flexGrow: 1, flexBasis: 0, minWidth: 0 } },
        ['div', { style: { display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: '10px' } },
          ['div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', borderRadius: '50%', background: groupIndex === 0 ? T.amber : T.teal, color: T.white, fontSize: '23px', fontWeight: 700, marginRight: '10px' } }, String(groupIndex + 1)],
          ['div', { style: { color: T.ink, fontSize: `${TYPE.group}px`, fontWeight: 700 } }, group.label],
        ],
        ['div', { style: { display: 'flex', flexDirection: 'column', gap: '9px' } },
          ...group.item_ids.map((id) => itemCard(byId.get(id), presentation.short_titles[id], id === presentation.accent_item_id)),
        ],
      ]),
    ],

    // Honest scope note: per-item caveats live on the edition page linked by the QR.
    ['div', { style: { color: T.muted, fontSize: '19px', lineHeight: '28px', marginBottom: '12px' } }, '内容は各一次情報の公開時点に基づきます。各項目の留保条件はQR先のEditionページで確認できます。'],
    ['div', { style: { display: 'flex', flexDirection: 'row', alignItems: 'center', background: T.dark, borderRadius: '20px', padding: '14px 20px' } },
      ['div', { style: { flexGrow: 1, color: T.white, fontSize: `${TYPE.conclusion}px`, lineHeight: '42px', fontWeight: 700, paddingRight: '18px' } }, presentation.conclusion],
      ['img', { src: qr, width: 112, height: 112, style: { width: '112px', height: '112px', background: T.white, borderRadius: '10px', flexShrink: 0 } }],
    ],
    ['div', { style: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', color: T.muted, fontSize: `${TYPE.footer}px`, marginTop: '10px' } },
      ['div', {}, `出典: ${[...new Set(edition.items.map((i) => publisherLabel(i)))].join(' / ')}（確認日 ${fmtDate(edition.edition_date)}）`],
      ['div', {}, noteUrl],
    ],
  ];
}

async function main() {
  const id = process.argv[2];
  if (!id) throw new Error('usage: generate-news-poster.mjs <edition-id>');
  const edition = JSON.parse(readFileSync(join(editionsDir, `${id}.json`), 'utf8'));
  const presentationPath = join(presentationsDir, `${id}.json`);
  if (!existsSync(presentationPath)) throw new Error(`missing presentation sidecar: ${presentationPath}`);
  const presentation = JSON.parse(readFileSync(presentationPath, 'utf8'));
  const quality = validatePresentation(edition, presentation);
  if (!quality.ok) throw new Error(`poster presentation invalid:\n- ${quality.errors.join('\n- ')}`);
  const svg = await satori(toVdom(await buildPoster(edition, presentation)), {
    width: W, height: H,
    fonts: [
      { name: 'Noto Sans JP', data: font, weight: 400, style: 'normal' },
      { name: 'Noto Sans JP', data: fontBold, weight: 700, style: 'normal' },
    ],
  });
  const outDir = join(outRoot, id);
  mkdirSync(outDir, { recursive: true });
  const pngPath = join(outDir, `${id}-poster.png`);
  writeFileSync(pngPath, new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng());
  writeFileSync(join(outDir, `${id}-quality.json`), JSON.stringify({
    ...quality,
    dimensions: { width: W, height: H },
    type_px: TYPE,
    focal_area_target: '25-45%',
    acceptance: { static_gate: 'PASS', human_visual_gate: 'PENDING', score_threshold: 80 },
  }, null, 2));
  console.log(pngPath);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error); process.exit(1); });
}
