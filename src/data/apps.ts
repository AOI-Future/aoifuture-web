// /apps/ 階層の単一レジストリ（唯一の真実）。
// アプリを一覧へ載せる = ここに1エントリ追加するだけ。
//
// ライフサイクル思想:
//   どのアプリも まず aoifuture.com/apps/<slug> の LP から始まる。
//   育ったら独自ドメインの専用サイトを持つ（`site` を設定）。
//   その後も /apps/<slug> の紹介ページは残し、そこから専用サイトへ送り出す。
// → 全アプリが必ず /apps/<slug> ページを持つ。`site` の有無で役割が変わるだけ:
//     site なし … そのページ自体がフル LP（CTA は GitHub ★ 等）
//     site あり … 紹介ページ＋「専用サイトへ →」の外部誘導

export type AppStatus = 'IN DEV' | 'EARLY SIGNAL' | 'BETA' | 'LIVE';

export interface AppEntry {
  id: string;        // 表示用連番 '001'
  slug: string;      // /apps/<slug> と apps/<slug>.astro のファイル名
  name: string;      // 一覧・ページ見出し
  desc: string;      // 一覧の1行説明
  status: AppStatus; // EARLY SIGNAL → BETA → LIVE
  repo?: string;     // 開発リポ（内部メモ。表示しない）
  site?: string;     // 独自ドメイン専用サイト（育ったら設定）。あれば外部誘導
}

export const apps: AppEntry[] = [
  {
    id: '001',
    slug: 'harbor',
    name: 'AOI HARBOR',
    desc: 'MacのApple Foundation Modelを艦隊全体のローカルLLMゲートウェイに',
    status: 'EARLY SIGNAL',
    repo: 'AOI-Future/aoi-harbor',
  },
  {
    id: '002',
    slug: 'aoi-tap',
    name: 'AOI TAP',
    desc: 'iPhoneの声を、オンデバイスで文字起こし＋日英対訳 → そのままAIが読めるノートに',
    status: 'IN DEV',
    repo: 'AOI-Future/aoi-tap',
  },
  // 例) 育って独自ドメインを持ったら `site` を足すだけ（紹介ページは残す）:
  // { id:'003', slug:'studiee', name:'STUDIEE', desc:'…', status:'LIVE', repo:'studiee-ios', site:'https://studiee.app' },
];
