# Local Quest Phase 0 — 作業メモ（再開用）

- **status**: Phase 0 merge 済み（#33 `71b32bd` / #34 `2b84490`）。Phase 1 hardening merge 済み（#35 `f841736`）、本番 deploy success（両 Vercel context）。公開URL https://aoifuture.com/play/localquest （noindex・サイト内導線なし）
- **updated**: 2026-10-03（Phase 2a extractor PASS・PR、縦切り次）
- **Notion**: Company OS / Local Quest（page `3ed51456-e70c-8111-8cbb-f95fe114f889`, Status Spec, P1）
- **方針（ユーザー承認済み）**: aoifuture-web の中に作る / Phase 0–1 は Astro + localStorage（Next.js/Postgres は Phase 2）/ afterhours を土台にする

## 完了済み（commit 0203c70）

- `src/lib/backside/ir.ts` — `BacksideWorld` IR、`COMPILER_VERSION='backside-compiler/0.1.0'`、`validateWorld`
- `src/lib/backside/compiler.ts` — `compileTopology` / `compiledLayout`（RoomSource & Layout）/ `sectorCentre` / `seedFrom`、`METRES_PER_CELL=80`
- `src/lib/backside/quest.ts` — `questReducer`（DRAFT→ACCEPTED→ACTIVE→COMPLETED/ABANDONED/EXPIRED、不正イベントは同一objectを返す）、`currentStep`、`isFinished`、`draftQuest`
- `src/lib/backside/fixtures/sample-town.ts` — `sampleTown`（seed 20261002, spawn station）、`sampleQuest()`（first-signal: konbini → station）
- `src/lib/afterhours/geography.ts` / `world.ts` — 外部 RoomSource を受けられるよう拡張
- `tsconfig.afterhours.json` — `src/lib/localquest/*.ts` を include 済み
- `src/lib/localquest/game.ts` — 実装済み・typecheck clean（describe に seed 引数、showMenu/begin で hud/pause/menu-footer 切替、init で start 有効化）
- `src/pages/play/localquest.astro` — 作成済み・build 通過（dist に play/localquest/index.html）
- `playwright.localquest.config.ts` + `tests/localquest.spec.ts` + npm `test:localquest` — 9 passed（desktop/phone/tablet × 3）
- `tests/backside.test.ts`（vitest 6 passed。全体 vitest は 970 tests passed、FAIL 26 files は vitest が Playwright `*.spec.ts` を拾う既存設定由来）。`npm run check:afterhours` clean、afterhours Playwright 25 passed / 2 skipped

## 残タスク（この順）

1. [done] `src/lib/localquest/game.ts` — afterhours `game.ts` を雛形に、floor/shaft/lift/bookmark/notebook を除去。`compileTopology(sampleTown)` → `compiledLayout` → `new World(scene, seed, 0, layout)`。ring を現 step の anchor に置き、距離 < 1.5 で `reach` + `sound.collect()`、COMPLETED で完了表示。save key `aoi.localquest.v1`（`{version:1, sourceId, compilerVersion, seed, quest, pos}`、不一致・破損はリセット）
2. [done] `src/pages/play/localquest.astro` — afterhours の `ah-*` マークアップ/CSS を流用（notebook/lift/bookmark なし、絵文字なし）
3. [done] `playwright.localquest.config.ts`（port 4329）+ `tests/localquest.spec.ts`（クリア・reload復元・破損save・page error なし）+ npm script `test:localquest`
4. [done 2026-10-02] 検証: `npm run check:afterhours` / vitest / `npm run test:afterhours` / `npm run test:localquest` / `npm run build`
5. [done 2026-10-02] Notion 更新: GitHub = `https://github.com/AOI-Future/aoifuture-web`、Next Action =「afterhoursを土台にPhase 0着手」→ read-back 一致確認（Status は Spec のまま）
6. [done] a11y 実測: `tests/localquest.spec.ts` にタップ44px・コントラスト4.5:1 の自動監査を追加（menu/HUD × 3 viewport、12 passed、故意の不良要素で検出を確認）
7. [done] harness-reviewer PASS（tree 8c017da）→ ローカル commit `0203c70`。low 指摘4件（save の quest 形状検証、version/sourceId/seed 不一致E2E、DRAFT/ACCEPTED からの abandon 仕様、hashLayout 等価の単体テスト）は Phase 1 で対応

## Phase 1 hardening（2026-10-03, #35 merge `f841736`）

- [done] save の quest 形状検証: `quest.ts` に `isQuest(v, anchors?)`（status enum・steps/anchor 実在・step 範囲・ACTIVE/COMPLETED の step 整合）。`game.ts` の `load()` が使用
- [done] E2E: version / sourceId / seed / compilerVersion 不一致と不正 quest（status・未知 anchor・step 範囲外・空 steps）でリセット。旧検証へ戻すと落ちることを mutation で確認
- [done] abandon は DRAFT/ACCEPTED/ACTIVE から許可、終了後は無視（コメント + 単体テスト）
- [done] hashLayout 等価: 既定 layout と明示 `hashLayout` の deep-equal + golden sha256（#34 以前の出力と一致）

- 未対応 low 指摘（harness-reviewer, tree `1bc69b5`）: `isQuest` は quest id / steps が fixture と一致するかを見ない。DRAFT/ACCEPTED で step≠0 を受理する

## Phase 2a 実在エリア対応（Real Geography Compiler, 2026-10-03, branch `feat/localquest-real-geography`）

ユーザー選択「実在エリア対応を先に」。実在エリア → Topology → 固有ワールド。

- [done] `src/lib/backside/reality.ts` — provider 中立の `GeoSnapshot` → `extractTopology`。2本以上の街路が共有するノード＝交差点、80m セルでクラスタ、街路を交差点間 edge に縮約、POI は最寄り交差点へ接続、街路連結成分ごとにクラスタ（近接する別ネットワークを融合しない）、最大連結成分のみ残す（同数なら中心に近い方）。内部キーは `j:`/`n:`/`w:` 接頭辞で provider id 衝突を防ぐ。spawn は駅、無ければ中心最寄り交差点。area 名は出力せず `REAL AREA` 固定
- Topology over replica: 出力に実名・provider id を含めない（id は `${kind}-${rank}`、座標は m 丸め）。seed は `provider:areaId:topology` から決定的。要素順に依存しない
- [done] `src/lib/backside/providers/overpass.ts` — Overpass QL 生成と応答パースのみ（**fetch しない**）。OSM は ODbL、表示時は「© OpenStreetMap contributors」必須（snapshot に license/attribution を保持）
- [done] `fixtures/overpass-grid.ts`（架空 4x4 グリッド）+ `tests/reality.test.ts` 11 tests（reality+backside 計21）。`check:afterhours` / build 通過
- harness-reviewer FAIL（`2049125`）の指摘6件を修正: 島の駅による spawn 孤立、id 衝突、名称漏洩、relation 非対応の明示、クラスタの成分跨ぎ、shape node 処理
- [done] 修正 commit `86c1122` → harness-reviewer PASS（candidate sha256 `2ba7632b…`）。vitest reality+backside 21/21、tsc、`check:afterhours`、`npm run build` 通過
- 非ブロッキング指摘（縦切りで対応）: 同一セル・約15m の別ネットワークが格子交差点と融合しない回帰テスト、名称漏洩テストの正規表現が seed を誤検出しないよう除外、`area.id` 中立性の注記維持
- **確定方針（2026-10-03 ユーザー確定、追加調査不要）**
  1. MVP provider は OSM/Overpass。公開インスタンスは開発者による小規模1回取得のみ（本番 backend にしない）。provider 境界は維持
  2. world 生成に LLM を使わない。同一 source + compiler version + seed → 同一 BacksideWorld。AI API 無しで動く
  3. プレイ毎に Overpass を呼ばない: fetch → normalize → compile → cache/save → game（実行時は生成済み world を読む）
  4. raw OSM / 生成データは git に入れない（`.cache` 等 gitignore）。git はコード・schema・最小 fixture・ライセンス文書のみ
  5. 帰属表示: ゲーム内共通 component「© OpenStreetMap contributors」→ https://www.openstreetmap.org/copyright 、README に「Map data © OpenStreetMap contributors」「Open Database License (ODbL)」
  6. 縦切り: 小さな固定1エリアで 取得1回 → parse → topology → compile → JSON Schema 検証 → 3D → 一人称で歩ける。既存テストを壊さない
  7. `compileReality(source, options) -> BacksideWorld` を独立 module に。出力に OSM id・実名を含めない。compiler に Overpass 固有ロジックを入れない
  8. 対象外: LLM world 生成、動的クエスト、東京全域、本番 Overpass、AR、マルチプレイ、大規模DB、複雑なエリアUI
- [next] 縦切り実装（上記 6・7 と帰属表示・README）

## 制約

- merge / deploy はユーザー承認まで禁止（push・PR作成は承認済み）
- `.worktrees/`（別タスク所有）と `test-results/` は触らない・commit しない
- UI は AGENTS.md 準拠（絵文字禁止、#000 背景、コントラスト4.5:1、タップ44px、`npm run build` 通過）
