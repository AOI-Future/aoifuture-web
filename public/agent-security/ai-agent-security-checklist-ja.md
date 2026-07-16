# AIエージェントセキュリティ・セルフアセスメント

Version: 2026-07-16
Source: https://aoifuture.com/agent-security/checklist/

このチェックリストは、確認漏れを見つけるための公開資料です。チェック数によってAIエージェントの安全性や準拠を認証するものではありません。各項目について、設定パス、テストID、ログ、承認記録など、第三者が再確認できる証拠の場所を記録してください。

## Scope

- 対象エージェント:
- 環境:
- 対象ツール / MCP:
- 対象データ:
- 対象委譲経路:
- 評価日:
- 評価者:
- 対象外とした項目と理由:

## Identity / Delegation

- [ ] REQ-001 — エージェントは、人間の常設クレデンシャルを共有せず、独立したワークロードIDで動く。
  - Evidence:
- [ ] REQ-002 — 委譲する権限に、目的・期間・対象・操作・承認者・失効条件がある。
  - Evidence:
- [ ] REQ-051 — 子エージェントのスコープは親より狭く、委譲チェーンを相関IDで追跡できる。
  - Evidence:

## Tools / Actions / MCP

- [ ] REQ-010 — 利用可能なツールが明示的な許可リストにあり、ネットワーク・書込・コード・資金のリスク分類がある。
  - Evidence:
- [ ] REQ-011 — ツール権限が最小化され、入力をツール側のスキーマ・範囲・宛先で検証する。
  - Evidence:
- [ ] REQ-012 — コード実行・ブラウザ・ファイル操作が本番、資格情報、無制限ネットワークから隔離されている。
  - Evidence:
- [ ] REQ-015 — 高影響アクションの承認画面が、具体的な差分・宛先・特権・データ分類・ロールバック条件を示す。
  - Evidence:
- [ ] REQ-050 — MCPサーバーが審査済みで、バージョン固定・定義ハッシュ・変更時の再レビューがある。
  - Evidence:

## Content / RAG / Memory

- [ ] REQ-020 — RAG・ツール・メモリ由来の内容に来歴と信頼レベルがあり、信頼できない内容が上位ポリシーを上書きしない。
  - Evidence:
- [ ] REQ-021 — 取得・記憶した内容にTTLまたは鮮度シグナルがある。
  - Evidence:
- [ ] REQ-022 — 長期メモリへの書き込みがポリシー対象で、来歴付き・取り消し可能になっている。
  - Evidence:

## Observe / Stop / Recover

- [ ] REQ-030 — 入力、モデル応答、ツール結果、主体、承認、外部送信を、秘密を伏せて再構築できる。
  - Evidence:
- [ ] REQ-033 — 脅威ファミリーを覆う評価を、出荷前・変更時・定期スケジュールで再実行する。
  - Evidence:
- [ ] REQ-034 — ロールバック、状態復元、メモリ汚染からの復旧、資格情報失効を実際に演習している。
  - Evidence:
- [ ] REQ-042 — ツール、MCP、外部送信、メモリ書込、RAG、委譲、スケジュールを個別に止められる。
  - Evidence:

## Result

- Confirmed:
- Unknown:
- Out of scope:
- Next verification:
- Review owner:
- Review date:

## Next resources

- Reference Hub: https://aoifuture.com/agent-security/
- Evidence Demo: https://aoifuture.com/agent-security/evidence-demo/
- Free Japanese book: https://leanpub.com/agent-security-ja
- Free English book: https://leanpub.com/agent-security
- Free Webhook Check: https://aoifuture.com/tools/webhook-check

The paid Verification Kit executes a broader defined suite and retains JSON, PDF, manifest, and timestamp artifacts. It is not a certificate that an agent is secure and does not guarantee acceptance by a particular auditor or reviewer.
