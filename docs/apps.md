# /apps/ 運用ルール

aoifuture.com 配下に自社開発アプリを載せる仕組み。`/tools/` 階層と同じ思想で、
**全アプリが必ず `aoifuture.com/apps/<slug>` の紹介ページを持つ**。

## トリガールール（いつ /apps に載せるか）

> **AOI-FUTURE GitHub Org に「製品として出す」ソフトを置いたら、`aoifuture.com/apps/<slug>` ページを1枚作る。**

- 判定基準は置き場所＝**意思表示**。Org（`github.com/AOI-Future`）に入れる = 「これは自社プロダクトとして世に出す」宣言。→ apps ページ対象。
- 個人実験・社内ツール・使い捨ては個人アカウント（`0xshugo/...`）に置く。→ apps 対象外。
- 個人 repo のまま製品化が進むこともあるが、**製品化の意思が固まった時点で Org へ移管**するのが正（移管前でも紹介ページは先行作成可＝コードの置き場所とページの有無は独立）。並行開発で先に Org へ移ることもあり、それも正しい最終形（例: `AOI-Future/aoi-tap` は移管済み）。
- ページの初期形は status に応じて選ぶ: 配布前=CTA なしの紹介、公開リポ=GitHub ★、配布中=DL/TestFlight。

## ライフサイクル（これが基本思想）

```
  ① LP スタート        ② 育つ              ③ 独立
  /apps/<slug> が      自社ドメイン配下で    独自ドメイン取得
  そのままフルLP    →  反応・実績を蓄積  →  専用サイトへ graduate
  (CTA=★/DL 等)                            /apps/<slug> は紹介ページとして残し外部誘導
```

- どのアプリも **まず `/apps/<slug>` の LP から始める**（独自ドメインは取らない）。
- 育ったら独自ドメインの専用サイトを持つ。
- **独立後も `/apps/<slug>` の紹介ページは消さない** — そこから専用サイトへ送り出す。
- → A/B の二択ではなく連続したライフサイクル。ページの「役割」が変わるだけ。

## リポジトリの責任分界（重要）

| 対象 | 置き場所 | 理由 |
|---|---|---|
| アプリ本体のコード | **各アプリの独立リポ**（製品は `AOI-Future/<repo>`、実験は `0xshugo/<repo>`） | Web サイトにアプリコードを統合しない |
| `/apps/<slug>` 紹介ページ・LP | **この `aoifuture-web` リポ** | サイト資産はサイトリポで一元管理 |
| 独自ドメインの専用サイト | **各アプリ側**（独立リポ / 独立ホスティング） | graduate 後はアプリ側の責務 |

> 鉄則: **アプリのコードは aoifuture-web に入れない。入るのは LP / 紹介ページだけ。**

## 単一レジストリ

`src/data/apps.ts` が `/apps/` 一覧の唯一の真実。一覧に載せる = ここに1エントリ追加。

```ts
{ id:'002', slug:'aoi-tap', name:'AOI TAP', desc:'…', status:'BETA', repo:'AOI-Future/aoi-tap' }
```

| フィールド | 用途 |
|---|---|
| `id` | 表示用連番 `'002'` |
| `slug` | `/apps/<slug>` と `apps/<slug>.astro` のファイル名 |
| `name` / `desc` | 一覧・見出し |
| `status` | `EARLY SIGNAL` → `BETA` → `LIVE` |
| `repo?` | 開発リポ（内部メモ。非表示） |
| `site?` | **独自ドメイン専用サイト。育ったら設定** → 一覧に `SITE ↗`、紹介ページに外部誘導 |

`site` の有無が①〜③の役割を切り替える唯一のスイッチ。

## アプリ追加手順

1. `feat/apps-<slug>` ブランチを切る（`main` は触らない＝デプロイ直結のため）。
2. `src/data/apps.ts` にエントリを1つ追加。
3. `src/pages/apps/<slug>.astro` を作る（`apps/harbor.astro` を雛形に。黒/シアン/mono 美学、`<Layout>`、左上 BACK、`<Fragment slot="head">` で OGP）。
   - **site なし**: そのページがフル LP。
   - **site あり**: 紹介ページ＋「専用サイトへ →」を主 CTA に。
4. `npx astro build` でローカル検証。
5. PR / レビュー後、**`main` へ merge = 本番デプロイ（外部公開アクション）→ ユーザー確認必須**。

## デプロイ規律

- ホスティング = **Vercel**（Cloudflare ではない）。`main` への push で auto-deploy。
- したがって作業は必ず feature ブランチ。`main` merge / push は「公開」= 要ユーザー確認。
- 計測は既設の Vercel Analytics + GA（Cookie 同意ゲート付き）。流入分離は `?ref=...`。

## graduate（独立）時の手順

1. 専用サイトを各アプリ側で立ち上げ・独自ドメインを向ける。
2. `apps.ts` のエントリに `site: 'https://<domain>'` を追加。
3. `apps/<slug>.astro` を「紹介＋外部誘導」へ縮約（フル LP は専用サイトへ移す）。
4. 紹介ページは**残す**（SEO・回遊・ブランド一覧性のため）。

## 情報の所在マップ（どこに何があるか）

このルールを別プロジェクトから再利用するとき、各情報の正本は以下:

| 情報 | 正本の場所 | 補足 |
|---|---|---|
| アプリ本体のコード | **GitHub `AOI-Future/<repo>`**（製品） / `0xshugo/<repo>`（実験・移管前） | Org にあるか＝製品かの判定軸 |
| `/apps/` 一覧の真実 | **`aoifuture-web/src/data/apps.ts`** | エントリ1つ＝1アプリ |
| 各アプリの LP/紹介ページ | **`aoifuture-web/src/pages/apps/<slug>.astro`** | サイト資産はサイトリポ |
| **この運用ルールの正本** | **`aoifuture-web/docs/apps.md`**（この文書） | 迷ったらここに戻る |
| ルールの発見性（横展開） | **グローバル Skill `aoifuture-apps`**（`~/.claude/skills/`） | 他リポで作業中でも想起される入口。中身はこの文書を指す |
| 横断想起 | **auto-memory `project_apps_hierarchy`** | セッションを跨いだ存在の記憶 |
| 開発中アプリの WIP/設計 | **各アプリ repo の `docs/specs/`** + **project-scratch** | 例: aoi-tap は `~/project/aoi-tap/docs/specs/` と scratch handoff |

> 原則: **ルールは「それが支配する対象」の隣に置き、重複させない。** Skill / memory は正本（この文書）への“ポインタ”であって、内容を二重管理しない。
