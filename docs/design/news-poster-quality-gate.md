# AOIFUTURE SNSポスター品質ゲート v1

対象: `scripts/generate-news-poster.mjs` が生成する 1080×1350px の1枚ポスター。

## 目的

「情報が掲載できる」を最低線とし、その上でフィード上の停止力、3秒理解、信頼、保存価値を毎回同じ条件で判定する。単発のデザイン調整ではなく、Editionごとに同じ入力契約・静的検査・実画像レビューを通す。

## 入力契約

各Editionは `src/content/news/presentations/<edition_id>.json` を持つ。公開済みEdition JSONは変更しない。

presentation sidecarには次を明示する。

- `kicker`: シリーズ内テーマ
- `headline_lines`: 1〜2行、各16文字以内
- `dek`: 34文字以内の具体的な補足
- `hero`: 3ノードの決定論的な主役図と、その意味を示すcaption
- `groups`: 3グループ。Editionの全itemを重複なく1回ずつ含める
- `short_titles`: 全itemに対する30文字以内の、意味が完結したSNS見出し
- `conclusion`: 事実とAOI解釈の境界を守った一文
- `accent_item_id`: 1件だけ。アクセントを競合させない

機械的な文字切断・省略は禁止する。意味が入らない場合は短い完全文へ編集し、その後に固定段階でフォントを下げる。

## 固定デザイントークン

- Canvas: 1080×1350px、safe margin 48px
- Background: ivory `#F7F5EF`
- Ink: `#142320`
- Teal: `#087E78`
- Pale teal: `#E7F2EE`
- Warm accent: amber `#D78A32`（1箇所を主役にする）
- Headline: 72/76px
- Dek: 30/42px
- Hero node: 30px
- Group heading: 30px
- Item headline: 24/32px
- Metadata: 19px
- Conclusion: 29/42px
- Footer: 18px（出典とURLだけ）

## 自動失格条件

`validatePresentation()` が次を検査し、1件でも該当すれば画像を生成しない。

1. Editionのitemが欠落・重複・未知IDを含む
2. 3グループでない
3. SNS見出しが欠落、30文字超過
4. 見出しが3行以上、または1行16文字超過
5. `…`、`→`、`※`、emoji、置換文字など未保証グリフを含む
6. 重要本文が24px未満
7. 本文・メタ情報のコントラストが4.5:1未満
8. heroが3ノードでない

対象テスト: `tests/news-poster.test.mjs`

## 実画像レビュー

静的PASS後、生成PNGを実ピクセルでレビューする。総合80/100以上、かつ必須項目が全PASSで公開候補になる。

- Stop-scroll: 20点。主役が1つで、headline+heroが画面25〜45%を占める
- 3秒理解: 20点。主題と最重要変化を1文で言える
- Scanability: 20点。3グループを迷わず走査でき、色・形の競合がない
- Trust: 20点。全itemにpublisher/date、footerに確認日、留保条件の参照先が読める
- Saveability: 20点。9件を後から参照でき、QRの文字URLもある

### 必須PASS

- 全itemが表示される
- 切れ、重なり、キャンバス外への溢れがない
- 豆腐グリフ、`…`、単語途中切れがない
- 見出しと改行が自然な日本語
- 主役図が縮小表示でも理解できる
- 結論、QR、出典、URLが完全に表示される

自動計測だけで3秒理解は保証できない。最終的な実画像レビューは省略しない。

## 2026-09-27版の基準結果（手動レビュー証跡）

以下は自動ゲートの出力ではなく、生成PNGを実ピクセルで確認した手動レビューの記録である。生成時のquality JSONは、別工程のレビューが終わるまで意図的に `human_visual_gate: PENDING` を保持する。

- Review target: `public/og/news/poster/2026-09-27-0550/2026-09-27-0550-poster.png`
- Review method: Hermes `vision_analyze` による実画像検査
- Static validator: PASS
- Unit tests: 10/10 PASS
- Final visual review: ACCEPT、blockerなし
- Stop-scroll 9/10
- 3秒理解 8/10
- Scanability 9/10
- Trust 9/10
- Saveability 9/10
- 換算: 88/100、受け入れ基準80を通過

この記録は当該PNGだけに適用する。将来のEditionへ点数を継承しない。