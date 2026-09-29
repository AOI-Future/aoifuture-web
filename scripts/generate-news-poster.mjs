#!/usr/bin/env node
// Poster variant: ONE dense 1080x1350 SNS-native summary per edition.
// Derives content ONLY from edition JSON (title/source_fact/role/published_at).
// Design contract: docs/design/instagram-carousel-proposal.md — SNSネイティブ高密度ポスター方向.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import QRCode from 'qrcode';
import { toVdom } from './generate-news-og.mjs';

const root = resolve(import.meta.dirname, '..');
const editionsDir = join(root, 'src/content/news/editions');
const outRoot = join(root, 'public/og/news/poster');
const fontPath = join(root, 'node_modules/@fontsource/noto-sans-jp/files/noto-sans-jp-japanese-400-normal.woff');
const fontBoldPath = join(root, 'node_modules/@fontsource/noto-sans-jp/files/noto-sans-jp-japanese-700-normal.woff');
const font = readFileSync(fontPath);
const fontBold = existsSync(fontBoldPath) ? readFileSync(fontBoldPath) : font;

const W = 1080, H = 1350;
const CYAN = '#009e9e', TEAL = '#167f7f', PARCH = '#f2e9d8', INK = '#10261f', FAINT = '#5c6f69';
const WHITE = '#fffdfa', PALE = '#edf8f6', LINE = '#c8ddd8', GOLD = '#e8a800', CORAL = '#e0563f';
const M = 44;

const domainLabel = (d) => ({ 'github.blog': 'GitHub', 'huggingface.co': 'HF', 'www.anthropic.com': 'Anthropic', 'arxiv.org': 'arXiv', 'openai.com': 'OpenAI', 'research.ibm.com': 'IBM' }[d] ?? String(d).replace(/^www\./, '').split('.')[0].toUpperCase());
const fmtDate = (iso) => String(iso ?? '').slice(0, 10).replaceAll('-', '.');
const cleanDisplayText = (value) => String(value ?? '')
  .replaceAll('コードの旁边', 'コードのそば')
  .replaceAll('Repository状态', 'リポジトリの状態')
  .replaceAll('状态', '状態')
  .replaceAll('判别', '判別')
  .replaceAll('本页', '本ページ');

async function qrDataUrl(url) {
  return QRCode.toDataURL(url, { margin: 1, width: 320, color: { dark: '#10261f', light: '#f2e9d8' } });
}

const tag = (label, color = TEAL) => ['div', { style: { display: 'flex', alignItems: 'center', background: color, color: '#fff', borderRadius: '999px', padding: '4px 16px', fontSize: '22px', fontWeight: 700, flexShrink: 0 } }, label];

const sectionHead = (num, text, accent = CYAN) => ['div', { style: { display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: '14px' } },
  ['div', { style: { width: '44px', height: '44px', borderRadius: '50%', background: accent, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', fontWeight: 700, marginRight: '14px', flexShrink: 0 } }, String(num)],
  ['div', { style: { color: INK, fontSize: '34px', fontWeight: 700, lineHeight: 1.3 } }, text],
];

const itemRow = (item) => ['div', { style: { display: 'flex', flexDirection: 'column', background: PALE, borderLeft: `6px solid ${CYAN}`, borderRadius: '0 14px 14px 0', padding: '14px 18px', marginBottom: '10px' } },
  ['div', { style: { color: INK, fontSize: '27px', fontWeight: 700, lineHeight: 1.45 } }, cleanDisplayText(item.title)],
  ['div', { style: { color: FAINT, fontSize: '21px', marginTop: '6px' } }, `${domainLabel(item.source_domain)}・${fmtDate(item.published_at)}`],
];

const clip = (s, n) => { s = cleanDisplayText(String(s ?? '')); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };
// Prefer natural clause boundaries over mid-word ellipsis; shrink instead of chop.
const smartClip = (s, n) => {
  s = cleanDisplayText(String(s ?? '')).replace(/※/g, '').trim();
  if (s.length <= n) return s;
  const window = s.slice(0, n);
  // cut at last sentence/clause punctuation
  for (const sep of ['。', '；', '、', '・']) {
    const cut = window.lastIndexOf(sep);
    if (cut >= Math.floor(n * 0.45)) return window.slice(0, cut);
  }
  // cut before a Latin token start (don't split model names mid-token)
  const spaces = [...window.matchAll(/[  ]/g)].map((m) => m.index);
  if (spaces.length) { const last = spaces[spaces.length - 1]; if (last >= Math.floor(n * 0.45)) return window.slice(0, last); }
  const latin = [...window.matchAll(/[A-Za-z]/g)].map((m) => m.index);
  if (latin.length) { const first = latin[latin.length - 1]; if (first >= Math.floor(n * 0.45)) return window.slice(0, first); }
  return window;
};

// Two-line title: short kicker + subtitle (no awkward mid-phrase wrap).
const posterTitle = (edition) => {
  let t = cleanDisplayText(edition.title ?? '').replace(/^AOIFUTURE News：/, '');
  const parts = t.split('——');
  if (parts.length >= 2) return { kicker: parts[0].trim(), sub: parts.slice(1).join('——').trim() };
  return { kicker: t, sub: '' };
};

// Editorially short, complete social headlines. Never show an incomplete clause.
const POSTER_TITLES = {
  'huggingface-relore-repository-memory': 'HF、記憶ツールreloreを公開',
  'github-agentic-autofix-copilot-memory': 'GitHub自動修正、Copilot Memoryを利用',
  'github-codeql-2-27-1': 'CodeQL更新、C/C++・C#・Kotlinに対応',
  'anthropic-enzyme-discovery': 'Claude、新規酵素系の発見に貢献',
  'github-ssh-algorithm-removal': 'GitHub、SHA-1 RSA鍵を段階的に廃止',
  'nvidia-nemotron-diarization': 'NVIDIA、リアルタイム話者分離を公開',
  'ibm-agent-consistency-eval': 'IBM、エージェントの一貫性評価を提起',
  'arxiv-sage-reasoning-bias': 'SAGE、長期推論の2つのバイアスを緩和',
  'arxiv-adwm-counterfactual-mpc': 'AD-WM、反事実的制御の世界モデルを提案',
};
const posterItemTitle = (item) => POSTER_TITLES[item.id] ?? cleanDisplayText(item.title);

export async function buildPoster(edition) {
  const lead = edition.items.find((i) => i.role === 'lead') ?? edition.items[0];
  const rest = edition.items.filter((i) => i !== lead);
  const majors = rest.filter((i) => i.role === 'major');
  const briefs = rest.filter((i) => i.role === 'brief');
  const watches = rest.filter((i) => i.role === 'watch');
  const noteUrl = `aoifuture.com/news/${edition.edition_id}`;
  const qr = await qrDataUrl(`https://${noteUrl}`);
  const dekConclusion = String(edition.dek ?? '').split('。').filter(Boolean).pop() ?? 'AIのいまを、ひとめで。';

  const children = [
    // kicker
    ['div', { style: { display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' } },
      ['div', { style: { color: TEAL, fontSize: '22px', fontWeight: 700, letterSpacing: '3px' } }, 'AOIFUTURE EXPLAINED'],
      ['div', { style: { color: FAINT, fontSize: '22px' } }, `${fmtDate(edition.edition_date ?? edition.edition_id)} 版・全${edition.items.length}件`],
    ],
    // hook headline: kicker + subtitle split (no mid-phrase wrap)
    ['div', { style: { color: INK, fontSize: '56px', fontWeight: 700, lineHeight: 1.3, marginBottom: '6px' } }, posterTitle(edition).kicker],
    ...(posterTitle(edition).sub ? [['div', { style: { color: TEAL, fontSize: '34px', fontWeight: 700, lineHeight: 1.4, marginBottom: '14px' } }, posterTitle(edition).sub]] : []),
    ['div', { style: { color: FAINT, fontSize: '23px', lineHeight: 1.5, marginBottom: '22px' } }, smartClip(lead.source_fact, 58)],
    // section 1: derived from lead (clause-boundary short lines, no mid-word ellipsis)
    sectionHead(1, '何が変わった？'),
    ['div', { style: { display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '22px' } },
      ...[posterItemTitle(lead), '1つの実行でissueからPRまで一気通貫', 'GitHubのCopilot Memoryと同じ潮流'].map((t, i) => ['div', { style: { display: 'flex', flexDirection: 'row', alignItems: 'baseline' } },
        ['div', { style: { color: CYAN, fontSize: '25px', fontWeight: 700, marginRight: '12px', flexShrink: 0 } }, `${i + 1}.`],
        ['div', { style: { color: INK, fontSize: '26px', lineHeight: 1.45 } }, t]]),
    ],
    // section 2: same wave (majors, clause-boundary short lines)
    ...(majors.length ? [sectionHead(2, '同じ波がほかにも', GOLD),
      ['div', { style: { display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '22px' } },
        ...majors.map((m) => ['div', { style: { display: 'flex', flexDirection: 'row', alignItems: 'center', background: PALE, borderLeft: `6px solid ${CYAN}`, borderRadius: '0 12px 12px 0', padding: '10px 16px' } },
          ['div', { style: { flexGrow: 1, color: INK, fontSize: '24px', fontWeight: 700, lineHeight: 1.4 } }, posterItemTitle(m)],
          ['div', { style: { color: FAINT, fontSize: '19px', marginLeft: '12px', flexShrink: 0 } }, `${domainLabel(m.source_domain)} ${fmtDate(m.published_at)}`]]),
      ]] : []),
    // section 3: briefs + watch as single lines
    ...(briefs.length || watches.length ? [sectionHead(3, 'ほかのアップデート', TEAL),
      ['div', { style: { display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '22px' } },
        ...briefs.map((b) => ['div', { style: { display: 'flex', flexDirection: 'row', alignItems: 'baseline' } },
          ['div', { style: { color: FAINT, fontSize: '20px', marginRight: '10px', flexShrink: 0, width: '92px' } }, domainLabel(b.source_domain)],
          ['div', { style: { color: INK, fontSize: '22px', lineHeight: 1.5 } }, posterItemTitle(b)]]),
        ...(watches.length ? [['div', { style: { display: 'flex', flexDirection: 'row', alignItems: 'baseline', marginTop: '6px', background: PARCH, borderRadius: '10px', padding: '8px 12px' } },
          tag('Watch', CORAL),
          ['div', { style: { color: INK, fontSize: '21px', lineHeight: 1.5, marginLeft: '12px' } }, posterItemTitle(watches[0])]]] : []),
      ]] : []),
    // caveat line
    ['div', { style: { color: FAINT, fontSize: '19px', lineHeight: 1.5 } }, smartClip(edition.items.find((i) => i.caveat)?.caveat ?? '記載は各一次情報の時点に依存', 52)],
    // conclusion banner + QR
    ['div', { style: { display: 'flex', flexDirection: 'row', alignItems: 'center', background: INK, borderRadius: '18px', padding: '16px 22px', marginTop: '18px' } },
      ['div', { style: { flexGrow: 1, color: '#fff', fontSize: '26px', fontWeight: 700, lineHeight: 1.5 } }, clip(dekConclusion, 38)],
      ['img', { src: qr, width: 118, height: 118, style: { width: '118px', height: '118px', marginLeft: '20px', flexShrink: 0, borderRadius: '10px' } }],
    ],
    ['div', { style: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', marginTop: '12px' } },
      ['div', { style: { color: FAINT, fontSize: '18px', lineHeight: 1.5 } }, `出典: ${[...new Set(edition.items.map((i) => domainLabel(i.source_domain)))].join(' / ')}（確認日 ${fmtDate(edition.edition_date ?? edition.edition_id)}）`],
      ['div', { style: { color: FAINT, fontSize: '18px' } }, noteUrl],
    ],
  ];

  return ['div', { style: { display: 'flex', flexDirection: 'column', width: `${W}px`, height: `${H}px`, background: WHITE, color: INK, padding: `44px ${M}px`, boxSizing: 'border-box', position: 'relative', fontFamily: 'Noto Sans JP' } },
    ['div', { style: { display: 'flex', position: 'absolute', top: 0, left: 0, width: `${W}px`, height: '10px', background: `linear-gradient(90deg,${CYAN},${TEAL},${GOLD})` } }],
    ...children,
  ];
}

async function main() {
  const id = process.argv[2];
  if (!id) throw new Error('usage: generate-news-poster.mjs <edition-id>');
  const edition = JSON.parse(readFileSync(join(editionsDir, `${id}.json`), 'utf8'));
  const dom = await buildPoster(edition);
  const svg = await satori(toVdom(dom), {
    width: W, height: H,
    fonts: [
      { name: 'Noto Sans JP', data: font, weight: 400, style: 'normal' },
      { name: 'Noto Sans JP', data: fontBold, weight: 700, style: 'normal' },
    ],
  });
  const outDir = join(outRoot, id);
  mkdirSync(outDir, { recursive: true });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng();
  const outPath = join(outDir, `${id}-poster.png`);
  writeFileSync(outPath, png);
  console.log(outPath);
}

main().catch((e) => { console.error(e); process.exit(1); });
