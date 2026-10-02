# Local Quest Phase 0 — 作業メモ（再開用）

- **status**: Phase 0 merge 済み（#33 `71b32bd` / #34 `2b84490`）。Phase 1 hardening を branch `feat/localquest-phase1-hardening` で PR 化。merge/deploy はユーザー承認待ち
- **updated**: 2026-10-03
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

## Phase 1 hardening（2026-10-03, branch `feat/localquest-phase1-hardening`）

- [done] save の quest 形状検証: `quest.ts` に `isQuest(v, anchors?)`（status enum・steps/anchor 実在・step 範囲・ACTIVE/COMPLETED の step 整合）。`game.ts` の `load()` が使用
- [done] E2E: version / sourceId / seed / compilerVersion 不一致と不正 quest（status・未知 anchor・step 範囲外・空 steps）でリセット。旧検証へ戻すと落ちることを mutation で確認
- [done] abandon は DRAFT/ACCEPTED/ACTIVE から許可、終了後は無視（コメント + 単体テスト）
- [done] hashLayout 等価: 既定 layout と明示 `hashLayout` の deep-equal + golden sha256（#34 以前の出力と一致）

## 制約

- merge / deploy はユーザー承認まで禁止（push・PR作成は承認済み）
- `.worktrees/`（別タスク所有）と `test-results/` は触らない・commit しない
- UI は AGENTS.md 準拠（絵文字禁止、#000 背景、コントラスト4.5:1、タップ44px、`npm run build` 通過）
