# 熊本地震支援情報：公式一次情報更新・公開ゲート運用

対象：`/support/kumamoto-2026/` の更新担当者。復旧・受付終了まで、公式情報を安全に確認し、公開候補をレビュー済みの Git 変更として扱うための runbook です。

> このページおよび本 runbook は、資格・会計・寄付の助言をしません。金銭の受け取り、口座情報、決済先をページ側で案内・転載しません。利用者には必ず掲載元の公式ページで条件を確認してもらいます。

## 正本と情報源の境界

- 現在のページデータ（`src/data/kumamoto-relief.ts`）と route（`src/pages/support/kumamoto-2026.astro`）を実装上の正本とする。
- Git の PR と commit review を、公開候補の正本・変更履歴とする。Notion は任意の候補台帳であり、公開の承認・根拠・正本ではない。
- 根拠は、熊本県、中央共同募金会、熊本県社協、日本赤十字などの支援主体自身、または自治体・指定公式機関が発行する一次情報だけに限定する。
- X、ニュース、第三者まとめ、転載記事は候補の検知に使えても、受付中・金額・口座・対象の根拠にはしない。URL 短縮、個人口座、SNS 単独情報は掲載しない。
- 公式ページの銀行情報・決済リンク・口座番号・金額を LP に転載しない。行動先は公式ページへの確認入口に限定する。

## status の意味と掲載制約

| status | 使える条件 | LP の扱い |
| --- | --- | --- |
| `open` | 当該公式ページが、現在そのアクション（受付・募集等）を受け付けていると確認できる | 公式の action URL へ進める。ただし LP 自身は口座・決済・寄付を受けない |
| `preparing` | 対象・終了・受付状態が未確認、または準備中 | 公式確認リンクだけを出す。受付中とは書かない |
| `information` | 最新情報の確認入口。募集や受付を断定できない | `officialUrl` の確認入口だけを出す |

`open` であっても、LP で受付中の事実・期間・配分先を独自に保証しない。公式ページの記載が優先される。状態を確認できないときは `open` にしない。

## 1件ずつの更新手順

各カードを独立した変更として扱い、複数件を一括で推測更新しない。

1. **候補を保存する**：発見日時、候補 URL、候補の発行主体、対象カード、候補の要旨を作業記録に保存する。SNS・ニュースは「候補」と明記し、根拠扱いしない。
2. **公式ページを同定する**：ドメイン、発行主体、ページタイトル、対象災害・地域を確認する。短縮 URL や第三者リダイレクトを根拠 URL にしない。
3. **5項目を照合する**：公式ページ上で、(a) 誰が支援を受ける／活動するのか、(b) 何への支援か、(c) 現在の受付状態、(d) 公式に記載された日付、(e) 公式 URL を照合する。読めない・矛盾する・終了不明なら `preparing` または `information` とする。
4. **データを更新する**：`src/data/kumamoto-relief.ts` の該当 1 件だけを変更する。`officialUrl` と必要な `actionUrl` は公式 HTTPS URL とし、個人口座・決済情報・転載額を追加しない。説明文も受付中と誤認されない表現にする。
5. **日時を分離する**：公式ページに表示された更新日を `sourceUpdatedAt` に記録し、掲載がなければ `not-published` とする。監査用の `checkedAtJst` は必ず ISO JST datetime `YYYY-MM-DDTHH:MM:SS+09:00` とし、確認日を公式更新日として代用しない。実際の確認が 08:05 頃でも、記録値は安全側に切り捨てた `2026-07-31T08:00:00+09:00` のように、実際より後の確認を示さない値にする。
6. **ローカル検証する**：対象変更を含むテストを実行し、`npm run build` を実行する。失敗・警告・リンク不備を解消できなければ公開候補にしない。
7. **独立 Reviewer を置く**：更新者とは別の Reviewer が、公式 URL を直接開き、5項目、status、日付の分離、誤認を招く文言、秘密・口座・決済情報の混入、差分と build 結果を確認する。更新者だけの自己承認は不可。
8. **Owner が公開承認する**：Owner がレビュー済み commit/PR、検証結果、公開対象 route、想定状態を確認し、明示的に公開承認する。承認前に deploy しない。
9. **production readback を記録する**：Vercel の deployment 結果と、本番 URL の readback を別々に記録する。本番 route を取得し、更新したカードの状態、リンク先、表示日時、他カードの非変更を確認する。deployment 成功だけで公開完了としない。

## exact staging / preflight

候補メモ、source 全文、Notion export、秘密は staging に持ち込まない。データ更新の一時ファイルが必要な場合だけ、OS 外部の `mktemp -d` は使わず、repo 内で **gitignore 済みの `tmp/` 配下**に短命な staging directory を作り、終了時に必ず削除する。開始時に次を実行し、`git check-ignore -q tmp/` が不合格なら作業を止めて Owner に直す。

```bash
cd /Users/shugo/project/aoifuture-web-worktrees/kumamoto-relief-lp
git check-ignore -q tmp/
stage_dir="tmp/kumamoto-relief-$(date +%s)"
mkdir -p "$stage_dir"
trap 'rm -rf "$stage_dir"' EXIT
```

変更対象ファイルは次の3つだけである（Task2ページ、route、`.gitignore`、その他の生成物は変更しない）。

- `docs/operations/kumamoto-relief-source-update.md`
- `src/data/kumamoto-relief.ts`
- `tests/kumamoto-relief-data.test.ts`

データ更新では、`open` は `actionUrl` 必須かつ `officialUrl` と同一、`preparing` / `information` は `actionUrl` を持たないこと、`not-published` は安全表示（受付中と断定せず公式確認入口のみ）になることを、データ契約テストで確認する。候補や秘密をコピーせず、必要な入力は公式 URL の確認結果だけを手入力する。

```bash
git status --short
git diff --check
npx vitest run tests/kumamoto-relief-data.test.ts
git diff --cached --name-only
```

最後の出力は上記の所有ファイルだけであることを目視確認する。`tmp/` は commit 前に削除され、候補メモ・source 全文・Notion export・秘密が status や diff に現れないことを確認する。

## 変更記録（evidence record）テンプレート

実際の秘密、口座情報、決済情報、人名、個人連絡先は記録しない。Reviewer/Owner は役割名またはチケット識別子で記録する。

```text
item id:
source URL:
publisher:
source update date: YYYY-MM-DD / not-published
checkedAtJst: YYYY-MM-DDTHH:MM:SS+09:00
what changed:
reviewer: reviewer-role-or-ticket-id
proposed commit: <SHA or PR>
production receipt: deployment-id/status + live-readback-URL/status
```

## 期限切れ・変更・撤回と rollback

- `open` は人間の Owner が責任者となり、少なくとも毎日 JST 09:00 前後と受付終了日当日に公式ページを再確認する。監視・候補検知だけは自動化してよいが、自動判定を公開承認の代わりにしない。
- 受付終了日の翌日までに再確認できない、公式ページに到達できない、または状態が不明なら、安全側に `preparing` または `information` へ戻す。CTA は公式確認だけにし、受付中とは表示しない。
- 公式ページが closed、内容変更、または unavailable になったら、同じ更新で `open` を解除する。`preparing` / `information` に戻し、公式確認入口に戻すか CTA を削除する。
- 公開済みの古い action link、古い受付期間、金額、口座情報の転載を残さない。新しい公式根拠が確認できるまで受付中と断定しない。
- 事故（誤リンク、終了後の `open`、誤った対象・日付・状態）が判明したら、まず action link を外す、または `open` を解除して、直ちに再 build する。Reviewer、Owner 承認、production readback を再実施する。
- rollback は最後に公開されたレビュー済み commit を候補にするが、終了・変更した公式情報を復活させない。安全側の変更（CTA 削除／確認入口化）を優先し、復旧後も独立レビューを要する。

### production receipt（分離記録）

Owner 承認後の Vercel GUI/CLI 操作だけを許可し、deployment の成功と本番 readback の合格を同一視しない。receipt には次の項目を別々に残す。

```text
deployed SHA:
deployment ID:
known-good deployment ID:
readback verdict: PASS / FAIL
rollback reason:
rollback result: NOT_REQUIRED / SUCCESS / FAIL
post-rollback readback: PASS / FAIL (URL/status/checkedAtJst)
```

readback が `FAIL` の場合は公開成功扱いにしない。直ちに action を削除して安全な確認入口にするか、終了・古い情報を復活させないことを確認した known-good deployment に rollback する。rollback 後も post-rollback readback を実施し、失敗なら再度 action を削除して Owner に escalate する。Vercel GUI/CLI の実行手順は Owner の明示承認後に限る。

## release gate と Git 操作

直接 `main` へ push、直接 deploy、Owner 承認なしの公開は禁止する。通常は feature branch → PR → Reviewer review → Owner の明示的な public approval → Vercel deployment → production readback の順にする。Vercel deployment の記録と live readback の記録は分離する。

作業前に状態と差分を確認する（既存の `test-results/` 等、タスク外の変更は触らない）。ドキュメント変更だけを対象にする場合のコマンド例：

```bash
cd /Users/shugo/project/aoifuture-web-worktrees/kumamoto-relief-lp

git status --short --branch
git diff -- docs/operations/kumamoto-relief-source-update.md

git diff --check -- docs/operations/kumamoto-relief-source-update.md

git add -- docs/operations/kumamoto-relief-source-update.md src/data/kumamoto-relief.ts tests/kumamoto-relief-data.test.ts
git diff --cached --check -- docs/operations/kumamoto-relief-source-update.md src/data/kumamoto-relief.ts tests/kumamoto-relief-data.test.ts
git diff --cached --name-only
git diff --cached --stat -- docs/operations/kumamoto-relief-source-update.md src/data/kumamoto-relief.ts tests/kumamoto-relief-data.test.ts
git commit --only -m "docs: tighten Kumamoto relief update gates" -- docs/operations/kumamoto-relief-source-update.md src/data/kumamoto-relief.ts tests/kumamoto-relief-data.test.ts
git status --short --branch
git show --stat --oneline HEAD -- docs/operations/kumamoto-relief-source-update.md
```

データ変更を伴う更新では、対象テスト、`npm run build`、Reviewer の確認を commit/PR の記録に添付する。push、PR merge、Vercel の公開操作は、この runbook の作成作業では実行しない。

## 最終チェックリスト

- [ ] 公式一次情報を直接確認した。X／ニュース／第三者情報だけを根拠にしていない。
- [ ] 誰・何・受付状態・公式日付・公式 URL を照合した。
- [ ] `status` の意味に合い、受付中を推測していない。
- [ ] `sourceUpdatedAt` と `checkedAtJst` を分け、`checkedAtJst` が `YYYY-MM-DDTHH:MM:SS+09:00` である。
- [ ] LP に口座、決済リンク、金額、個人情報、短縮 URL を載せていない。
- [ ] テストと build が成功した。
- [ ] 独立 Reviewer の記録がある。
- [ ] Owner の明示的な公開承認がある。
- [ ] Vercel deployment と production readback を別々に記録した。
- [ ] 公式ページの終了・変更・不在時に `open` を解除できる。
- [ ] `open` を毎日 JST 09:00 前後・受付終了日当日に再確認し、翌日までに確認できなければ安全側へ戻す。
- [ ] production receipt の deployed SHA / deployment ID / known-good deployment ID / readback / rollback / post-rollback readback を分離記録した。
