# 令和8年熊本地震 支援情報LP Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** スマートフォン利用者が、公式に確認済みの支援先を「誰に・何に届くか」で選び、公式サイト上で安全に行動できる静的LPを提供する。

**Architecture:** `aoifuture.com/support/kumamoto-2026/` に、支援先を型付きローカルデータとして持つ Astro 静的ページを追加する。掲載先は公式一次情報に限定し、各カードの行動ボタンは公式の寄付ページへ直接リンクする。口座番号の転載、寄付の受領、埋め込み決済、X投稿の自動転載は行わない。更新はデータファイルのPR/レビューを正本にし、Xは候補検知だけに使う。

**Tech Stack:** Astro 6、TypeScript、既存 Tailwind CSS v4、Playwright。

**Source baseline (2026-07-31 JST):**
- 熊本県「令和8年熊本地震に係る義援金の受付について」: https://www.pref.kumamoto.jp/soshiki/27/274572.html
- 中央共同募金会「令和8年熊本地震／ボラサポ」: https://www.akaihane.or.jp/saigai/2026kumamoto_earthquake/
- 熊本県災害ボランティア情報: https://www.fukushi-kumamoto.or.jp/kvc/

---

## Non-goals and safety boundary

- 寄付金・個人情報・決済情報を当サイトでは受け取らない。
- 銀行口座番号を転載しない。公式ページへの遷移前に表示・確認する責任を寄付者へ戻す。
- X、ニュース記事、まとめサイトのみを根拠に掲載・更新しない。
- 未確認の物資支援、ボランティア募集、自治体別受付を「受付中」と断定しない。
- 本ページの公開デプロイは、独立したソース確認・Reviewer・運用責任者の明示承認後に別途行う。

## Editorial data contract

1. 各支援カードは `id`, `name`, `kind`, `recipient`, `purpose`, `actionLabel`, `officialUrl`, `sourceUpdatedAt`, `checkedAtJst`, `status`, `notes` を持つ。
2. `officialUrl` は当該主体の公式ドメインに限る。短縮URL、決済代行URL、X URLは不可。
3. `status` は `open` / `preparing` / `information` のみ。`preparing` は寄付導線を作らず公式情報リンクにする。
4. 更新者は一次情報を読んで `checkedAtJst` を更新し、出典側の更新日時と差分をPRに記録する。Xは候補URLを発見する用途だけで、掲載根拠にはしない。
5. `lastVerifiedAt` はページ上部に集約表示し、古い情報の永続表示を避けるため更新運用の可視化に使う。

---

### Task 1: Create source-controlled relief data and its tests

**Objective:** 初期カードを公式一次情報に対応させ、掲載に必要な説明フィールドを型で強制する。

**Files:**
- Create: `src/data/kumamoto-relief.ts`
- Create: `tests/kumamoto-relief-data.test.ts`

**Step 1: Write failing tests**

Test that every card uses HTTPS, has an official source URL, contains a recipient and purpose, and that only `open` cards expose an action URL.

**Step 2: Run test to verify failure**

Run: `npx vitest run tests/kumamoto-relief-data.test.ts`
Expected: FAIL because the data module does not exist.

**Step 3: Write minimal implementation**

Create the typed data model with exactly these initial items:
- 熊本県の義援金: 被災された方々の支援を目的に熊本県が開設した義援金。配分先・配分時期は公式ページで未確認のため断定しない。受付期間は公式情報をカードの補足に表示。行動先は熊本県公式ページ。
- ボラサポ・令和8年熊本地震: 被災地の災害ボランティアセンター等と連携するボランティアグループ/NPOの活動を支える支援金。行動先は中央共同募金会公式ページ。
- 熊本県災害ボランティア情報: 物資支援、活動支援金、募集状況の公式確認入口。`information` 扱いで、支援を募集していると断定しない。

**Step 4: Run test to verify pass**

Run: `npx vitest run tests/kumamoto-relief-data.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add src/data/kumamoto-relief.ts tests/kumamoto-relief-data.test.ts
git commit -m "feat: add verified Kumamoto relief source data"
```

### Task 2: Build the mobile-first support page

**Objective:** 支援の届き先と用途を先に理解し、公式ページへ安全に遷移できる一画面を作る。

**Files:**
- Create: `src/pages/support/kumamoto-2026.astro`
- Create: `src/styles/kumamoto-relief.css`
- Modify: `src/layouts/Layout.astro` only if page-specific metadata cannot be supplied by slots.

**Step 1: Write failing test**

Create `tests/kumamoto-relief.spec.ts` with assertions for the route, H1, all three source cards, a visible “一次情報で確認” safety explanation, and external links having `target="_blank"` and `rel="noopener noreferrer"`.

**Step 2: Run test to verify failure**

Run: `npx playwright test tests/kumamoto-relief.spec.ts`
Expected: FAIL because the route does not exist.

**Step 3: Write minimal implementation**

- Use a calm, high-contrast, no-ad, no-tracking-needed page-specific surface; do not present the cyberpunk home treatment as a disaster interface.
- Make the primary question visible above the fold: “支援は、どこに・何に届くのか”。
- Render three data-backed cards; the first two must state recipient and use of funds before their `公式サイトで確認して支援する` buttons.
- Include an “いま、物資や現地ボランティアを考えている方へ” section that sends visitors to the 熊本県社会福祉協議会 official status page, explicitly saying conditions can change and independent visits or unrequested shipments must not be assumed.
- Include “掲載方針”: official-first, checked timestamp, X is only a detection signal, information may be removed/changed when official pages change.
- Include a concise phishing warning: never send money based only on an SNS post; verify the destination page and its recipient name on the official site.
- Use semantic landmarks, 44px minimum action targets, focus styling, `prefers-reduced-motion`, no emoji, and a source list with checked timestamps.
- Ensure analytics is not loaded for this page: use a layout/page option or a dedicated minimal layout. Do not collect donation-related behavior in the initial release.

**Step 4: Run tests to verify pass**

Run:
```bash
npx playwright test tests/kumamoto-relief.spec.ts
npm run build
```
Expected: both PASS.

**Step 5: Commit**

```bash
git add src/pages/support/kumamoto-2026.astro src/styles/kumamoto-relief.css tests/kumamoto-relief.spec.ts src/layouts/Layout.astro
git commit -m "feat: add Kumamoto relief information landing page"
```

### Task 3: Review the operational update path

**Objective:** 復旧までの継続運営で、誤情報・古い情報・支援先の混同を避ける。

**Files:**
- Create: `docs/operations/kumamoto-relief-source-update.md`

**Step 1: Create a reviewer checklist**

Specify the update sequence: X/news candidate → official source match → record source update time and JST check time → reviewer approves wording/action link → build/Playwright → deploy approval → production readback.

**Step 2: Document expiry and rollback rules**

Define that an expired, paused, or changed official program becomes `information` or is removed immediately; the action button must never lead to an expired program.

**Step 3: Validate document structure**

Run: `git diff --check -- docs/operations/kumamoto-relief-source-update.md`
Expected: no output.

**Step 4: Commit**

```bash
git add docs/operations/kumamoto-relief-source-update.md
git commit -m "docs: define Kumamoto relief source update gate"
```

### Task 4: Integration verification and readiness review

**Objective:** 実装・ソース運用・アクセシビリティ・公開境界を横断確認する。

**Files:** no production changes expected.

**Step 1: Run focused tests**

```bash
npx vitest run tests/kumamoto-relief-data.test.ts
npx playwright test tests/kumamoto-relief.spec.ts
npm run build
```

**Step 2: Verify locally**

Use `npm run preview` and a browser readback. Confirm on a mobile viewport that the recipient/purpose precede the action controls and no bank account details, donation form, or analytics request appears.

**Step 3: Independent review gates**

- Spec review: confirm every stated safety and content requirement is satisfied.
- Code quality review: confirm page-specific CSS cannot alter unrelated routes, all external links are hardened, and no source claim lacks a named official URL.
- Ops review: do not deploy. Provide a precise deployment + production-readback checklist for an owner-approved release.

---

## Rejected alternatives

- **Public Notion only:** fast to edit, but poor for action-first mobile design, source-status visualization, accessibility controls, and code-reviewed history. Use Notion only as an optional internal update queue later, not the public canonical experience.
- **`/apps/` 配下:** 既存の `/apps/<slug>` は自社開発アプリの製品導線として明文化されており、本件は公的機関ではないAOI Futureが提供する公式情報ガイドである。プロダクト一覧に混在させないため、`/support/kumamoto-2026` を独立した情報LPとして実装する。
- **wfhradio.tokyo:** its advertising/reporting context risks making a disaster-support page look monetized or editorialized.
- **nozaki.com:** personal voice is valuable for an explanatory post, but a single person’s site is a weaker long-running operational home than a neutral, dedicated AOI Future public-benefit route.
- **Embedded third-party donation widgets:** introduce privacy, availability, and recipient-identity ambiguity. Direct official links keep the money and personal data out of this project.
