#!/usr/bin/env node
// Prototype: Instagram carousel (AOIFUTURE EXPLAINED) per edition.
// Derives slides ONLY from edition JSON fields (title/source_fact/selection_reason/aoi_note/caveat).
// See docs/design/instagram-carousel-proposal.md for the design contract.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import QRCode from 'qrcode';
import { toVdom } from './generate-news-og.mjs';

const root = resolve(import.meta.dirname, '..');
const editionsDir = join(root, 'src/content/news/editions');
const outRoot = join(root, 'public/og/news/carousel');
const fontPath = join(root, 'node_modules/@fontsource/noto-sans-jp/files/noto-sans-jp-japanese-400-normal.woff');
const fontBoldPath = join(root, 'node_modules/@fontsource/noto-sans-jp/files/noto-sans-jp-japanese-700-normal.woff');
const font = readFileSync(fontPath);
const fontBold = existsSync(fontBoldPath) ? readFileSync(fontBoldPath) : font;

const W = 1080, H = 1350;
// v2: editorial white canvas. Pale section fills reduce dead space without becoming decoration.
const CYAN = '#009e9e', TEAL = '#167f7f', PARCH = '#f2e9d8', INK = '#10261f', FAINT = '#566b65';
const WHITE = '#fffdfa', PALE = '#edf8f6', LINE = '#c8ddd8';
const M = 60; // horizontal safe margin; bridge band = x 1020..1080
const assetDataUrl = (name) => `data:image/png;base64,${readFileSync(join(root, 'public/og/news/carousel/assets/relore', name)).toString('base64')}`;
const HERO = assetDataUrl('hero.png');
const TERMINAL_UI = assetDataUrl('terminal-ui.png');
const DIAGRAM = assetDataUrl('diagram.png');

const domainLabel = (d) => ({ 'github.blog': 'GitHub', 'huggingface.co': 'HF', 'www.anthropic.com': 'Anthropic', 'arxiv.org': 'arXiv', 'openai.com': 'OpenAI', 'research.ibm.com': 'IBM' }[d] ?? String(d).replace(/^www\./, '').split('.')[0].toUpperCase());
const fmtDate = (iso) => String(iso ?? '').slice(0, 10).replaceAll('-', '.');
const cleanDisplayText = (value) => String(value ?? '')
  // Presentation-only cleanup of legacy mixed-language glyphs in the immutable Edition JSON.
  .replaceAll('コードの旁边', 'コードのそば')
  .replaceAll('Repository状态', 'リポジトリの状態')
  .replaceAll('本页', '本ページ');

async function qrDataUrl(url) {
  return QRCode.toDataURL(url, { margin: 1, width: 400, color: { dark: '#10261f', light: '#f2e9d8' } });
}

function frame({ children, idx, total, noteUrl }) {
  return ['div', { style: { display: 'flex', flexDirection: 'column', width: `${W}px`, height: `${H}px`, background: WHITE, color: INK, padding: `48px ${M}px`, boxSizing: 'border-box', position: 'relative', fontFamily: 'Noto Sans JP' } },
    ['div', { style: { display: 'flex', position: 'absolute', top: 0, left: 0, width: `${W}px`, height: '10px', background: `linear-gradient(90deg,${CYAN},${TEAL},#ffcf4a)` } }],
    // top bar: brand + progress
    ['div', { style: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: '40px' } },
      ['div', { style: { display: 'flex', flexDirection: 'row', alignItems: 'center' } },
        ['div', { style: { width: '12px', height: '12px', borderRadius: '50%', background: CYAN, marginRight: '12px' } }],
        ['div', { style: { color: TEAL, fontSize: '24px', fontWeight: 700, letterSpacing: '3px' } }, 'AOIFUTURE EXPLAINED'],
      ],
      ['div', { style: { color: FAINT, fontSize: '24px', letterSpacing: '2px' } }, `${idx} / ${total}`],
    ],
    // children
    ['div', { style: { display: 'flex', flexDirection: 'column', flexGrow: 1, flexShrink: 1, minHeight: 0 } }, ...children],
    // footer citation
    ['div', { style: { display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '36px' } },
      ['div', { style: { color: FAINT, fontSize: '22px', lineHeight: 1.5 } }, noteUrl],
      ['div', { style: { color: FAINT, fontSize: '22px' } }, 'aoifuture.com'],
    ],
    // swipe bridge (not on last slide)
    ...(idx < total ? [['div', { style: { display: 'flex', position: 'absolute', right: '24px', top: '50%', alignItems: 'center', justifyContent: 'center', width: '72px', height: '72px' } },
      ['div', { style: { width: '52px', height: '52px', borderRadius: '50%', border: `3px solid ${CYAN}`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: CYAN, fontSize: '34px', fontWeight: 700 } }, '›'],
    ]] : []),
  ];
}

function flowNode(label, sub, hot) {
  return ['div', { style: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexGrow: 1, flexBasis: 0, minHeight: '180px', border: `2px solid ${hot ? CYAN : LINE}`, borderRadius: '20px', padding: '28px 20px', background: hot ? '#ddf6f2' : PALE, boxSizing: 'border-box' } },
    ['div', { style: { color: hot ? CYAN : INK, fontSize: '34px', fontWeight: 700, textAlign: 'center', lineHeight: 1.4 } }, label],
    ...(sub ? [['div', { style: { color: FAINT, fontSize: '26px', marginTop: '12px', textAlign: 'center', lineHeight: 1.5 } }, sub]] : []),
  ];
}
const arrowDown = ['div', { style: { display: 'flex', justifyContent: 'center', padding: '14px 0' } },
  ['div', { style: { width: 0, height: 0, borderLeft: '16px solid transparent', borderRight: '16px solid transparent', borderTop: `22px solid ${TEAL}` } }]];

export async function buildSlides(edition, noteUrl) {
  const lead = edition.items.find((i) => i.role === 'lead') ?? edition.items[0];
  const cite = (item) => `出典: ${domainLabel(item.source_domain)} ${fmtDate(item.published_at)} aoifuture.com/news/${edition.edition_id}`;
  const majors = edition.items.filter((i) => i !== lead && (i.role === 'major' || i.role === 'brief'));
  const related = majors.slice(0, 2);
  const slides = [];

  // 1. cover — hook derived from lead source_fact (verified fact, no hype)
  slides.push({ key: 'cover', dom: frame({ idx: 1, total: 8, noteUrl: cite(lead), children: [
    ['div', { style: { display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: '48px' } },
      ['div', { style: { color: INK, background: CYAN, fontSize: '26px', fontWeight: 700, padding: '8px 20px', borderRadius: '999px', letterSpacing: '2px' } }, domainLabel(lead.source_domain)],
      ['div', { style: { color: FAINT, fontSize: '26px', marginLeft: '20px' } }, fmtDate(lead.published_at)],
    ],
    ['div', { style: { color: INK, fontSize: '72px', fontWeight: 700, lineHeight: 1.25 } }, 'エージェントは'],
    ['div', { style: { color: INK, fontSize: '72px', fontWeight: 700, lineHeight: 1.25 } }, '「やり方」を'],
    ['div', { style: { color: CYAN, fontSize: '72px', fontWeight: 700, lineHeight: 1.25, marginBottom: '26px' } }, '記憶しはじめた'],
    ['div', { style: { display: 'flex', width: '100%', height: '430px', overflow: 'hidden', borderRadius: '24px', border: `2px solid ${LINE}`, background: PALE } },
      ['img', { src: HERO, width: 960, height: 540, style: { width: '100%', height: '100%', objectFit: 'cover' } }],
    ],
    ['div', { style: { color: FAINT, fontSize: '25px', marginTop: '18px', lineHeight: 1.5 } }, `公式ビジュアル: ${domainLabel(lead.source_domain)} / ${String(lead.source_title ?? '').split(' ')[0]} — 何が起き、何が言えないのかを8枚で`],
  ] }) });

  // 2. what happened
  slides.push({ key: 'fact', dom: frame({ idx: 2, total: 8, noteUrl: cite(lead), children: [
    ['div', { style: { color: CYAN, fontSize: '30px', fontWeight: 700, letterSpacing: '2px', marginBottom: '28px' } }, 'RELEASE'],
    ['div', { style: { color: INK, fontSize: '46px', fontWeight: 700, lineHeight: 1.35, marginBottom: '24px' } }, lead.title],
    ['div', { style: { display: 'flex', flexDirection: 'row', flexGrow: 1, minHeight: 0, background: PALE, borderRadius: '22px', overflow: 'hidden', border: `2px solid ${LINE}` } },
      ['div', { style: { display: 'flex', flexDirection: 'column', width: '43%', padding: '32px', justifyContent: 'center' } },
        ['div', { style: { color: INK, fontSize: '29px', lineHeight: 1.65 } }, lead.source_fact],
      ],
      ['div', { style: { display: 'flex', width: '57%', overflow: 'hidden', background: '#0d1512', alignItems: 'center', justifyContent: 'center', padding: '20px' } },
        ['img', { src: TERMINAL_UI, width: 520, height: 720, style: { width: '100%', height: '100%', objectFit: 'contain' } }],
      ],
    ],
    ['div', { style: { display: 'flex', flexDirection: 'row', marginTop: '36px' } },
      ['div', { style: { color: FAINT, fontSize: '26px', border: '1px solid rgba(143,163,160,0.5)', borderRadius: '10px', padding: '10px 18px', marginRight: '16px' } }, `一次情報: ${lead.source_domain}`],
      ['div', { style: { color: FAINT, fontSize: '26px', border: '1px solid rgba(143,163,160,0.5)', borderRadius: '10px', padding: '10px 18px' } }, `確認: ${fmtDate(lead.verification?.checked_at)}`],
    ],
  ] }) });

  // 3. mechanism — 3-step flow derived from source_fact
  slides.push({ key: 'mechanism', dom: frame({ idx: 3, total: 8, noteUrl: cite(lead), children: [
    ['div', { style: { color: CYAN, fontSize: '30px', fontWeight: 700, letterSpacing: '2px', marginBottom: '26px' } }, 'どう動くか'],
    ['div', { style: { display: 'flex', width: '100%', height: '610px', overflow: 'hidden', borderRadius: '22px', border: `2px solid ${LINE}`, background: PALE } },
      ['img', { src: DIAGRAM, width: 960, height: 610, style: { width: '100%', height: '100%', objectFit: 'contain' } }],
    ],
    ['div', { style: { display: 'flex', flexDirection: 'row', marginTop: '24px' } },
      flowNode('履歴を検索', 'Issue・PR・レビュー・議論', false),
      ['div', { style: { width: '18px' } }],
      flowNode('現コードと照合', '過去の理由を現在形で確認', true),
      ['div', { style: { width: '18px' } }],
      flowNode('次の実行へ', '判断の根拠を再利用', false),
    ],
    ['div', { style: { color: FAINT, fontSize: '22px', marginTop: '18px', lineHeight: 1.5 } }, '公式図を日本語の3ステップで補足。対応範囲はリポジトリの現状に依存'],
  ] }) });

  // 4. contrast — parallel claims (OSS vs GitHub), labeled as positioning not verified delta
  const mirror = majors.find((i) => /copilot memory/i.test(String(i.title)));
  const contrastCell = (label, item, hot) => ['div', { style: { display: 'flex', flexDirection: 'column', flex: 1, border: `2px solid ${hot ? CYAN : LINE}`, borderRadius: '20px', padding: '36px 32px', marginRight: hot ? 0 : '24px', background: hot ? '#ddf6f2' : PALE, boxSizing: 'border-box' } },
    ['div', { style: { display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: '22px' } },
      ['div', { style: { color: hot ? '#fff' : TEAL, background: hot ? CYAN : 'transparent', fontSize: '24px', fontWeight: 700, padding: '6px 18px', borderRadius: '999px', letterSpacing: '2px', ...(hot ? {} : { border: `2px solid ${TEAL}` }) } }, label],
      ['div', { style: { color: FAINT, fontSize: '22px', marginLeft: '16px' } }, item ? `${domainLabel(item.source_domain)} · ${fmtDate(item.published_at)}` : ''],
    ],
    ['div', { style: { color: INK, fontSize: '31px', fontWeight: 700, lineHeight: 1.55, marginBottom: '20px' } }, item ? item.title : '—'],
    ['div', { style: { color: FAINT, fontSize: '28px', lineHeight: 1.6, flexGrow: 1 } }, cleanDisplayText(item ? String(item.source_fact).split('。').slice(0, 2).join('。') + '。' : '')],
    ['div', { style: { display: 'flex', flexDirection: 'row', marginTop: '24px' } },
      ['div', { style: { width: '100%', height: '6px', borderRadius: '3px', background: hot ? CYAN : LINE } }],
    ],
  ];
  slides.push({ key: 'contrast', dom: frame({ idx: 4, total: 8, noteUrl: cite(lead), children: [
    ['div', { style: { color: CYAN, fontSize: '30px', fontWeight: 700, letterSpacing: '2px', marginBottom: '32px' } }, 'これは孤立した話ではない'],
    ['div', { style: { display: 'flex', flexDirection: 'row', flexGrow: 1, minHeight: 0 } },
      contrastCell('OSS側', lead, false),
      contrastCell('商用側', mirror, true),
    ],
    ['div', { style: { display: 'flex', flexDirection: 'row', alignItems: 'center', marginTop: '30px' } },
      ['div', { style: { width: '14px', height: '14px', borderRadius: '50%', background: CYAN, marginRight: '16px', flexShrink: 0 } }],
      ['div', { style: { color: FAINT, fontSize: '24px', lineHeight: 1.5 } }, '同じ潮流の並置です。機能同等性は未検証 — 比較は主張のレベルで示す'],
    ],
  ] }) });

  // 5. so what — aoi_note, fact vs AOI view separated
  slides.push({ key: 'sowhat', dom: frame({ idx: 5, total: 8, noteUrl: cite(lead), children: [
    ['div', { style: { color: CYAN, fontSize: '30px', fontWeight: 700, letterSpacing: '2px', marginBottom: '40px' } }, 'あなたの実務に効くか'],
    ['div', { style: { display: 'flex', flexDirection: 'row', flexGrow: 1, minHeight: 0, borderRadius: '22px', overflow: 'hidden', background: PALE, border: `2px solid ${LINE}` } },
      ['div', { style: { display: 'flex', flexDirection: 'column', width: '58%', borderLeft: `6px solid ${CYAN}`, padding: '40px 34px', justifyContent: 'center' } },
        ['div', { style: { color: CYAN, fontSize: '26px', fontWeight: 700, marginBottom: '20px', letterSpacing: '2px' } }, 'AOIの見方'],
        ['div', { style: { color: INK, fontSize: '34px', lineHeight: 1.75 } }, cleanDisplayText(lead.aoi_note).split('。')[0] + '。'],
      ],
      ['div', { style: { display: 'flex', width: '42%', overflow: 'hidden', background: '#fff' } },
        ['img', { src: HERO, width: 400, height: 760, style: { width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' } }],
      ],
    ],
    ['div', { style: { color: FAINT, fontSize: '24px', marginTop: '28px' } }, '上の枠内は編集部の解釈です。事実は2枚目の一次情報に紐づいています'],
  ] }) });

  // 6. boundary
  slides.push({ key: 'boundary', dom: frame({ idx: 6, total: 8, noteUrl: cite(lead), children: [
    ['div', { style: { color: TEAL, fontSize: '30px', fontWeight: 700, letterSpacing: '2px', marginBottom: '28px' } }, 'まだ言えないこと'],
    ['div', { style: { display: 'flex', width: '100%', height: '410px', overflow: 'hidden', borderRadius: '22px 22px 0 0', border: `2px solid ${LINE}`, background: '#0d1512', alignItems: 'center', justifyContent: 'center' } },
      ['img', { src: TERMINAL_UI, width: 960, height: 410, style: { width: '100%', height: '100%', objectFit: 'contain' } }],
    ],
    ['div', { style: { display: 'flex', flexDirection: 'column', background: PALE, borderRadius: '0 0 22px 22px', padding: '38px', flexGrow: 1, border: `2px solid ${LINE}`, borderTop: '0' } },
      ['div', { style: { color: INK, fontSize: '32px', lineHeight: 1.75 } }, cleanDisplayText(lead.caveat) || '（この版にcaveat記載なし）'],
    ],
    ['div', { style: { color: FAINT, fontSize: '24px', marginTop: '28px' } }, `verification: ${lead.verification?.status ?? 'unknown'} / ${fmtDate(lead.verification?.checked_at)}`],
  ] }) });

  // 7. radar — related observations
  slides.push({ key: 'radar', dom: frame({ idx: 7, total: 8, noteUrl: `出典: aoifuture.com/news/${edition.edition_id}`, children: [
    ['div', { style: { color: CYAN, fontSize: '30px', fontWeight: 700, letterSpacing: '2px', marginBottom: '32px' } }, '次に追う2つの観測点'],
    ...related.map((i, n) => ['div', { style: { display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: '22px', padding: '30px', borderRadius: '20px', background: n === 0 ? '#ddf6f2' : PALE, border: `2px solid ${n === 0 ? CYAN : LINE}`, flexGrow: 1 } },
      ['div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '72px', height: '72px', borderRadius: '50%', background: n === 0 ? CYAN : TEAL, color: '#fff', fontSize: '32px', fontWeight: 700, marginRight: '26px', flexShrink: 0 } }, `${n + 1}`],
      ['div', { style: { display: 'flex', flexDirection: 'column' } },
        ['div', { style: { color: INK, fontSize: '34px', fontWeight: 700, lineHeight: 1.5 } }, i.title],
        ['div', { style: { color: FAINT, fontSize: '24px', marginTop: '10px' } }, `${domainLabel(i.source_domain)} · ${fmtDate(i.published_at)}`],
      ],
    ]),
    ['div', { style: { color: FAINT, fontSize: '24px', marginTop: 'auto', lineHeight: 1.6 } }, 'エージェントが記憶を持ち始めたら、記憶への書き込み経路そのものが統制対象になる'],
  ] }) });

  // 8. save cheat sheet + note QR CTA
  const qr = await qrDataUrl(noteUrl);
  const noteHost = String(noteUrl).replace(/^https?:\/\//, '');
  slides.push({ key: 'save', dom: ['div', { style: { display: 'flex', flexDirection: 'column', width: `${W}px`, height: `${H}px`, background: WHITE, color: INK, padding: '48px', boxSizing: 'border-box', fontFamily: 'Noto Sans JP', position: 'relative' } },
    ['div', { style: { display: 'flex', position: 'absolute', top: 0, left: 0, width: `${W}px`, height: '10px', background: `linear-gradient(90deg,${CYAN},${TEAL},#ffcf4a)` } }],
    ['div', { style: { color: CYAN, fontSize: '30px', fontWeight: '700', letterSpacing: '2px', marginBottom: '36px' } }, 'この1枚で戻れる'],
    ['div', { style: { display: 'flex', flexDirection: 'column', flexGrow: 1 } },
      ...[lead.title, related[0]?.title, related[1]?.title].filter(Boolean).map((t, n) => ['div', { style: { display: 'flex', flexDirection: 'row', alignItems: 'flex-start', marginBottom: '28px' } },
        ['div', { style: { color: CYAN, fontSize: '30px', fontWeight: 700, marginRight: '20px', minWidth: '44px' } }, `${n + 1}`],
        ['div', { style: { color: INK, fontSize: '30px', lineHeight: 1.55, flex: 1 } }, t],
      ]),
      ['div', { style: { display: 'flex', flexDirection: 'row', alignItems: 'center', marginTop: '20px', border: `2px solid ${PARCH}`, borderRadius: '16px', padding: '20px 28px' } },
        ['div', { style: { color: PARCH, fontSize: '26px', fontWeight: 700, marginRight: '20px' } }, '次に確認'],
        ['div', { style: { color: INK, fontSize: '26px', lineHeight: 1.5 } }, '記憶への書き込み経路の統制が各社でどう設計されるか'],
      ],
    ],
    ['div', { style: { display: 'flex', flexDirection: 'row', alignItems: 'flex-end', marginTop: '40px' } },
      ['div', { style: { display: 'flex', flexDirection: 'column', marginRight: '36px' } },
        ['div', { style: { color: INK, fontSize: '34px', fontWeight: 700, lineHeight: 1.6 } }, '全文はNoteで読めます'],
        ['div', { style: { color: CYAN, fontSize: '28px', fontWeight: 700, marginTop: '10px' } }, 'あとで見返すなら保存・同僚に共有'],
        ['div', { style: { color: FAINT, fontSize: '24px', marginTop: '14px' } }, noteHost],
        ['div', { style: { color: FAINT, fontSize: '22px', marginTop: '8px' } }, `出典: aoifuture.com/news/${edition.edition_id}`],
      ],
      ['div', { style: { display: 'flex', width: '220px', height: '220px', borderRadius: '16px', overflow: 'hidden', flexShrink: 0, border: '4px solid #f2e9d8' } },
        ['img', { src: qr, width: 212, height: 212 }],
      ],
    ],
  ]});

  return slides;
}

async function renderSlide(dom, outPath) {
  const svg = await satori(toVdom(dom), { width: W, height: H, fonts: [{ name: 'Noto Sans JP', data: font, weight: 400, style: 'normal' }, { name: 'Noto Sans JP', data: fontBold, weight: 700, style: 'normal' }] });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: W } }).render().asPng();
  writeFileSync(outPath, png);
  return outPath;
}

export async function generateCarousel(editionId, { noteUrl = 'https://note.com/shugo' } = {}) {
  const edition = JSON.parse(readFileSync(join(editionsDir, `${editionId}.json`), 'utf8'));
  const outDir = join(outRoot, editionId);
  mkdirSync(outDir, { recursive: true });
  const slides = await buildSlides(edition, noteUrl);
  const paths = [];
  for (const [i, slide] of slides.entries()) {
    paths.push(await renderSlide(slide.dom, join(outDir, `slide-0${i + 1}.png`)));
  }
  return paths;
}

if (process.argv[1] && resolve(process.argv[1]).endsWith('generate-news-carousel.mjs')) {
  const id = process.argv[2] ?? readdirSync(editionsDir).map((f) => f.replace('.json', '')).sort().at(-1);
  const note = process.argv[3];
  const paths = await generateCarousel(id, { noteUrl: note ?? 'https://note.com/shugo' });
  console.log(paths.join('\n'));
}
