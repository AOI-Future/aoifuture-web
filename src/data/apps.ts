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
//
// 法務ページ（/apps/terms, /apps/privacy）の対象一覧もここから派生する。
// `scope: 'native'` のみがネイティブ共通規約・Data Not Collected ポリシーに載る。
// `scope: 'web'` は /apps/ 一覧には出るが、上記法務の「ネイティブ」対象外。

export type AppStatus = 'IN DEV' | 'EARLY SIGNAL' | 'BETA' | 'LIVE';

/** 法務ページでネイティブ共通条項の対象にするか */
export type AppScope = 'native' | 'web';

export interface AppEntry {
  id: string;        // 表示用連番 '001'
  slug: string;      // /apps/<slug> と apps/<slug>.astro のファイル名
  name: string;      // 一覧・ページ見出し
  desc: string;      // 一覧の1行説明
  status: AppStatus; // IN DEV → EARLY SIGNAL → BETA → LIVE
  scope: AppScope;   // native = terms/privacy 共通条項の対象
  /** 法務ページ用プラットフォーム表記（scope が native のとき必須） */
  legalPlat?: string;
  /** 法務ページ用1行説明（scope が native のとき必須） */
  legalNote?: string;
  repo?: string;     // 開発リポ（GitHub `org/repo`。LP の ★ リンク等）
  site?: string;     // 独自ドメイン専用サイト（育ったら設定）。あれば外部誘導
}

export const apps: AppEntry[] = [
  {
    id: '001',
    slug: 'harbor',
    name: 'AOI HARBOR',
    desc: 'MacのApple Foundation Modelを艦隊全体のローカルLLMゲートウェイに',
    status: 'EARLY SIGNAL',
    scope: 'native',
    legalPlat: 'macOS',
    legalNote: 'ローカル LLM ゲートウェイ',
    repo: 'AOI-Future/aoi-harbor',
  },
  {
    id: '002',
    slug: 'aoi-tap',
    name: 'AOI TAP',
    desc: 'iPhoneの声を、オンデバイスで文字起こし＋日英対訳 → そのままAIが読めるノートに',
    status: 'IN DEV',
    scope: 'native',
    legalPlat: 'iOS / macOS / watchOS',
    legalNote: 'オンデバイス文字起こし・日英対訳 → Markdown',
    repo: 'AOI-Future/aoi-tap',
  },
  {
    id: '003',
    slug: 'afterhours',
    name: 'AFTERHOURS',
    desc: '誰もいない、終わらない空間へ。音と光をたどるブラウザ探索ゲーム',
    status: 'BETA',
    scope: 'web',
  },
  // 例) 育って独自ドメインを持ったら `site` を足すだけ（紹介ページは残す）:
  // { id:'004', slug:'studiee', name:'STUDIEE', desc:'…', status:'LIVE', scope:'native', legalPlat:'iOS', legalNote:'…', repo:'AOI-Future/studiee-ios', site:'https://studiee.app' },
];

/** GitHub リポ URL（`repo` が `org/name` 形式のとき） */
export function githubRepoUrl(repo: string): string {
  return `https://github.com/${repo}`;
}

export function getAppBySlug(slug: string): AppEntry | undefined {
  return apps.find((a) => a.slug === slug);
}

/** /apps/terms と /apps/privacy の SCOPE 一覧（ネイティブのみ） */
export function appsForNativeLegal(): Pick<AppEntry, 'name' | 'legalPlat' | 'legalNote'>[] {
  return apps
    .filter((a) => a.scope === 'native')
    .map(({ name, legalPlat, legalNote }) => ({
      name,
      legalPlat: legalPlat ?? '',
      legalNote: legalNote ?? '',
    }));
}
