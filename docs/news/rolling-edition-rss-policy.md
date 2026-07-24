# Rolling Edition RSS 運用・反応レビュー方針

Status: **LOCAL CANDIDATE — 未公開。フィード運用、定期確認、計測はまだ開始していない。**

## 1. 二時間ごとの確認と、公開は別の時計で動かす

原典の確認は、おおむね二時間ごとを運用上の目安にする。ただし、二時間たったこと自体はRSSを更新する理由にならない。`generated_at`や確認時刻だけが進んだ場合、項目の順序だけが変わった場合、内部状態だけが変わった場合は、公開イベントを作らない。

RSSへ出すのは、公開Editionに次の意味ある変化があり、レビューを通ったときだけとする。

- Signalの追加
- 公開中のSource factまたはCaveatの訂正
- 訂正注記や訂正種別の変更
- 原典を確認できなくなった状態への変更
- Signalの取り下げ
- Edition noteの意味ある変更

比較処理が返すのは、あくまでイベント候補である。候補にはGUIDも公開時刻もなく、そのままRSS itemにはできない。人間の公開責任者がReviewerの確認結果を受け、公開用のtitle、summary、時刻、対象Signalを含むイベントを明示的に承認した時点を「公開」とする。時刻や定期処理だけで、この地点を越えてはならない。

## 2. Edition IDを正本にし、RSSではrevisionを積む

Webの正本は、`edition_id`ごとに一つのcanonical Edition URLとする。既存の`YYYY-MM-DD`に加え、同日複数回の将来形として`YYYY-MM-DD-HHMM`を許可する。`edition_date`は表示用の暦日であり、必ずID先頭10文字と一致させる。URL、GUID、内部リンクは日付ではなく完全な`edition_id`から作る。RSSは同じEditionへの意味ある変更をrevisionとして追加する。

GUIDは `aoi-news-<edition_id>-rNNN` の形で、revision 1から欠番なく増やす。revision 1の公開時刻はEditionの`published_at`と一致させ、以後の時刻は必ず前のrevisionより後に置く。RSS itemのlinkは、各revisionで別ページを作らず、同じ日付付きcanonical Editionへ向ける。

公開済みイベントは追記専用であり、後から書き換え、削除、並べ替えをしない。再buildや再確認で新しいレビュー済みイベントが増えていなければ、GUID、順序、公開時刻を変えない。Editionの並びは`published_at`降順、同時刻なら`edition_id`降順とする。

EditionとActive Contextには`publication_status`を必須で持たせる。完全なreview graphを先に検証し、`VERCEL_ENV=production`の場合だけ`public`の閉じた部分グラフを生成する。それ以外の環境はreview modeとして全件を表示し、`noindex, nofollow`を保つ。productionではreview-onlyのroute、Context、event、RSS item、sitemap URL、表示文言を生成しない。

## 3. 公開payloadを小さく保つ

公開イベントに置けるのは、schema version、GUID、Edition IDと日付、revision、event kind、公開用titleと短いsummary、公開時刻、canonical Edition URL、変更対象の公開Signal IDだけである。RSS itemは、そのうちtitle、summary、GUID、公開時刻、Edition URLと、対象Signalの公開titleだけから組み立てる。

外部記事の本文、取得したRSS本文、receipt、ローカルpath、内部score、prompt、推論過程、Reviewerの個人情報、未公開URL、読者識別子は出さない。公開payloadに未定義フィールドが混ざった場合や、参照先・時刻・revisionの整合が取れない場合は、公開せずに止める。

## 4. 訂正、確認不能、取り下げを混ぜない

Source factまたはCaveatを訂正するときは、Signalに`change.kind = corrected`、前回より後の`corrected_at`、読者向けの`correction_note`をそろえ、Edition側の`corrected_at`も同じ時刻へ進める。レビュー後、`signal-corrected` revisionを追記する。WebのEditionが現在状態の正本であり、RSSは訂正があった事実を知らせる入口である。

原典へ一時的または継続的に到達できず、内容の撤回までは判断していない場合は`signal-source-unavailable`として扱う。取り下げる場合は、公開状態を`verification.status = withdrawn`かつ`change.kind = withdrawn`にしたうえで、`signal-withdrawn`を使う。確認不能を取り下げに見せたり、Signalを黙って消したりしない。

訂正負荷が高いときも、公開済みrevisionを消して履歴を整え直してはならない。新規公開を止め、Webの正本を訂正し、次のレビュー済みrevisionで経緯を残す。

## 5. 読者反応は集計値だけで見る

将来の見直しに使えるのは、承認済みanalyticsで得られる集計値に限る。候補は、RSS経由のEdition pageview、feed endpointへの需要が取得可能な場合の総request数、Editionの読了・到達傾向、公開Signalから原典へのclick傾向である。いずれもrevisionや期間単位の集計として扱い、個人の購読履歴を再構成しない。

読者ごとのID、hidden ID、fingerprint、メールアドレスは集めない。RSS URLへ読者別parameterを付けず、アクセスやclickを個人単位で結合しない。必要な集計が承認済みanalyticsで取れない場合は、新しい追跡を足すのではなく「未計測」と記録する。

M2/F1Rは、初期の観察期間を終えた時点、または判断できるだけの実revisionがたまった時点で見直す。見るのは、更新一件あたりの確認・訂正コスト、feedの通知量、RSSからEditionや原典へ進む集計傾向、読者がrevisionと一日一Editionの関係を誤解していないか、である。観察前に継続、頻度変更、廃止の結論を固定しない。

## 6. 停止・rollback条件

次のいずれかが続く場合、意味あるrevisionの新規公開を止め、原因確認を優先する。

- 時刻だけの更新や細かな変更が通知され、feed noiseが増えた
- 訂正または取り下げの処理が追いつかない
- RSS itemとcanonical Editionの現在状態が食い違う
- 公開allowlist外の情報が混ざった、または混入を否定できない
- 読者が一つのEditionと複数revisionの関係を誤認している

rollbackは、最後に検証済みのbuild候補へ戻すか、feed discoveryと配信を止める。公開済みイベント記録を遡って改変する操作はrollbackに含めない。再開には、原因の修正、生成物の読み戻し、公開payload検査、Reviewer確認、人間の公開承認をもう一度そろえる。

## 7. Opsに残る作業

現在あるのは、非本番sampleを使ったローカル候補と検証結果までであり、feedはliveではない。Opsには次が残る。

1. おおむね二時間ごとの確認jobを設計する。ただし、jobは変更候補の作成までとし、自動公開しない。
2. Reviewer確認から人間の公開承認、イベントartifact追加、buildまでの手順と権限境界を決める。
3. 本番データでsample表示を外す条件、feed discovery、robots／sitemapを含む公開gateを別途通す。
4. feed endpoint、生成失敗、revision不整合、canonical不一致を監視し、停止手順をrunbookにする。
5. 利用できる承認済みanalyticsと集計粒度を確認し、個人追跡なしで取得できない指標は未計測のまま残す。
6. 初回観察後のレビュー日または「十分な実revision」の判定担当を決める。

この文書は運用境界を定めるものであり、scheduler作成、Preview、deploy、feed公開、robots切り替え、外部計測の追加を承認するものではない。
