# AOIFUTURE News Reading Depth and Editorial Clarity Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Give readers four truthful public Editions, an understandable editorial policy, visibly bounded Signal cards, and guarded scroll-assisted access to older Editions without turning AOIFUTURE News into an infinite feed or a reader-tracking system.

**Architecture:** Add explicit coverage-window timestamps to each Edition and make coverage end—not publication time or route date—the chronology key for latest, archive, and progressive history. Keep `published_at` and Edition-event timestamps as the real editorial review/publication events, preserve a fixture-only review sample, and backfill three public Editions only from separately approved DailyNews source selections. Render one server Edition and a normal previous-Edition link first; after a real user scroll, progressively enhance that link with a guarded `IntersectionObserver` which appends one exact same-origin server article at a time while retaining manual, no-JavaScript, failure, URL restoration, accessibility, finite-history, and privacy guarantees.

**Tech Stack:** Astro 6, TypeScript, JSON Schema 2020-12, Vitest, Playwright, Node.js build verification, static JSON content, Vercel Preview/production gates.

---

## 1. Scope, source authority, and fixed decisions

- Start from clean branch `feature/aoifuture-news-reading-depth` at production main `d73c2464b1c565b57790570da8ab3e459ce288de`. Before implementation, re-run `git status --short --branch`, `git rev-parse HEAD`, and `git diff --stat origin/main...HEAD`; stop if the base or cleanliness differs.
- The only deliverable from this planning task is this plan. Implementation, content drafting, source approval, pushing, deployment, scheduler changes, DNS, analytics, and domain normalization are separate gated work.
- `edition_id` remains immutable route identity. `edition_date` remains its calendar prefix. Neither field claims when source news happened or when the Edition was published.
- Add required RFC 3339 `coverage_start_at` and `coverage_end_at`. They state the actual source-selection window represented by an Edition. Validate `coverage_start_at <= coverage_end_at` by parsed instant.
- Date/identity coherence is explicit: in `Asia/Tokyo`, the calendar date of `coverage_end_at` must equal `edition_date`, and `edition_date` must equal `edition_id.slice(0, 10)`. Do not derive or rewrite IDs from timestamps.
- Catalog chronology is descending `coverage_end_at`, then descending `coverage_start_at`, then descending `published_at`, then descending `edition_id`. The latter two keys are deterministic tie-breaks for equal windows; tests must use exact equal-window fixtures.
- `published_at`, `generated_at`, Signal `published_at`/`observed_at`, Context revision timestamps, and RSS Edition-event `published_at` retain their current meanings. Never copy a 2026-07-21..23 source date into Edition or RSS publication time to simulate historical publication.
- RSS remains an event feed ordered by actual event `published_at`; coverage timestamps may be described in body/metadata but must not replace event `<pubDate>` or GUID/revision chronology.
- Production must contain exactly four public Editions representing coverage ending 2026-07-24, 2026-07-23, 2026-07-22, and 2026-07-21. Review mode may additionally expose the existing non-production review sample if it is re-identified without colliding with the real public 2026-07-23 Edition.
- The existing review sample must not masquerade as the public 2026-07-23 backfill. Move/re-identify it as `2026-07-23-0900` in review-only canonical content or keep it fixture-only; the implementation owner must choose the least disruptive route after the content graph test is RED. In either case, preserve its sample wording/status and add `selection_reason` to every sample Signal.
- Backfill candidate inputs are the exact DailyNews artifacts below. They are editorial inputs, not automatic publication authority:
  - `Report/DailyNews/digest/2026-07-21_news-roundup.md`
  - `Report/DailyNews/digest/2026-07-22_news-roundup.md`
  - `Report/DailyNews/digest/2026-07-23_news-roundup.md`
  - supporting direct-source evidence and run reports for those dates, including `source-packs/2026-07-21_agent-loop-human-oversight-workflow-evidence.md` only where a selected claim actually uses it.
- Existing local review-request files say “candidate,” “local handoff,” or “未送信”; they are not proof of publication approval. Writer/editor must produce an explicit source-selection approval packet before content implementation. If approval is absent or ambiguous, block rather than infer approval from a roundup or score.
- Select 3–5 strong Signals per new public Edition. Prefer direct official documentation, releases, repositories, papers, advisories, regulators, or original reporting. Do not pad to a target count.
- Reject duplicate normalized `source_url` values across the three backfills and the public 2026-07-24 Edition. A repeated company/topic is allowed only when the direct source and factual change are distinct; a repeated URL or materially repeated claim is not.
- Every Signal requires reader-facing `selection_reason`: one concise explanation of why this item belongs in AOIFUTURE News. It must not expose scores, FreshRSS, DailyNews workflow, ranking, review receipts, private paths, rejection logs, prompts, or audience profiling.
- Add `/news/editorial-policy/` explaining inclusion, exclusions, source hierarchy, caveats, corrections, and that inclusion does not imply comprehensiveness, popularity ranking, sponsorship, or pay-to-play.
- Cards must be immediately recognizable as bounded objects: defined non-glass background surface, visible 1px border/accent, consistent internal padding and inter-card gaps, compact source/type header, distinct Source fact / Why selected / Caveat / AOI note regions, and a source footer. Preserve DOM order, keyboard order, minimum 44px controls, 14px Japanese body minimum, and two-column density at existing tablet/desktop breakpoints.
- Automatic history loading is finite, one Edition per successful intersection, and starts only after actual user scroll intent plus resulting scroll movement. It must not run merely because the sentinel is initially visible, after a timer/idle callback, on restoration, or after script startup.
- Keep a normal previous-Edition anchor. Manual activation remains available before/after observer arming and after failures. JavaScript-off follows the anchor normally.
- Automatic append must not move focus. Manual append may retain the current focus behavior. Both announce completion through the existing polite live region.
- Automatic appends update `?through=` with `history.replaceState`; manual appends may use `pushState` so Back can undo an explicit reader action. Restoration and `popstate` follow only server-provided links and never synthesize arbitrary Edition URLs.
- Never add analytics, reader IDs, source-body storage, read receipts, per-card impression tracking, popularity/ranking, scroll-depth tracking, personalization, profiling, automatic publication, a content API, a new runtime dependency, or infinite history.
- Use fresh `mktemp` output directories or move old generated evidence to a task-owned trash directory. Do not use broad destructive cleanup. Never stage with `git add .` or `git add -A`.

## 2. Acceptance matrix

| Concern | Required proof |
|---|---|
| Coverage contract | Required fields, valid RFC 3339 instants, start <= end, JST end date = `edition_date`, ID/date coherence, deterministic equal-window sort |
| Publication truth | Backfills have actual review/publication timestamps; RSS event times remain actual; no date is backfilled merely to look historical |
| Editorial depth | Exactly four public Editions; 3–5 approved strong Signals in each backfill; no normalized URL/claim duplication with public 2026-07-24 |
| Selection clarity | Required non-empty `selection_reason` in all canonical and fixture Signals; visible on cards; no internal-workflow leakage |
| Policy | `/news/editorial-policy/` has metadata, canonical, robots mode, sitemap inclusion, header link, and card-level link |
| Card boundary | Surface, 1px border/accent, padding/gaps, separated semantic regions, source footer, stable DOM/tab order, two columns, no overflow |
| Observer guard | Initial intersection does nothing; real user scroll arms; one intersection appends one Edition; sentinel follows the tail |
| Lifecycle | Observer disconnects while pending/reconciling, reconnects after success/failure when eligible, stops at oldest, and prevents cycles/concurrency |
| Fallback | Ordinary link works with JS off; manual retry works after fetch/parse failure; no automatic focus stealing |
| History | Automatic `replaceState`, manual `pushState`, valid `through` reload/Back/Forward restoration, invalid target fail-closed |
| Privacy | No analytics/ranking/profiling/read tracking; automatic path records only local URL state |
| Release | Writer → source Debug → Editorial Reviewer → Engineer → Debug → image Reviewer → Preview → Release Reviewer → production |

## Task 1: Lock the coverage-window and selection-reason contracts

**Objective:** Make chronology and selection rationale explicit, required, and fail-closed before any content migration.

**Files:**
- Modify: `schemas/aoi-news-edition-v1.schema.json:7-83`
- Modify: `scripts/news-contract/validator.mjs`
- Modify: `src/lib/news/types.ts:17-65`
- Modify: `src/lib/news/load-news.ts:20-130`
- Modify: `fixtures/news-contract/non-production/import-bundle.json`
- Modify: `tests/news-contract.test.mjs`
- Modify: `tests/news-ui.test.ts`

**Step 1: Write RED schema and semantic tests**

Add fixture defaults and assertions equivalent to:

```js
const edition = () => ({
  schema_version: 'aoi.news.edition.v1',
  edition_id: '2026-07-23',
  edition_date: '2026-07-23',
  coverage_start_at: '2026-07-22T00:00:00+09:00',
  coverage_end_at: '2026-07-23T08:59:59+09:00',
  generated_at: stamp2,
  published_at: stamp2,
  // existing fields...
});

const item = (id, url, overrides = {}) => ({
  // existing fields...
  selection_reason: '運用境界を一次情報から具体的に確認できるため。',
  ...overrides,
});
```

Cover all of these failures with stable codes/paths:

1. either coverage field missing;
2. malformed or impossible date-time;
3. `coverage_start_at` later than `coverage_end_at`;
4. coverage end whose JST date differs from `edition_date`;
5. `edition_date` differing from the ID prefix;
6. missing, empty, whitespace-only, HTML-bearing, or over-limit `selection_reason`;
7. unknown/private selection fields such as `internal_score`, `rank`, or `selected_by_model`;
8. current canonical Signals and the non-production fixture serialize with a non-empty reason.

**Step 2: Run focused tests and confirm RED**

```bash
npm run test:news -- --run tests/news-contract.test.mjs tests/news-ui.test.ts
```

Expected: nonzero because coverage keys are unknown/missing, selection rationale is not in the schema/type, and chronology still uses publication time.

**Step 3: Implement the minimal contract**

- Add both coverage keys to the Edition required/property lists with `format: date-time`.
- Add `selection_reason` to the Signal required/property lists using `text500` unless Editorial Reviewer approves a tighter existing text definition.
- Add fields to exact-key allowlists, TypeScript interfaces, importer normalization, and public validation.
- Parse instants rather than compare strings.
- Convert `coverage_end_at` to an `Asia/Tokyo` date with `Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', ... })`; do not use host-local timezone.
- Emit distinct validation codes such as `coverage_window_order` and `coverage_date_coherence` in the shared validator; the Astro loader should surface those shared failures rather than implement contradictory semantics.
- Retain the ban on arbitrary private keys and HTML in public text.

**Step 4: Run tests and confirm GREEN**

```bash
npm run test:news -- --run tests/news-contract.test.mjs tests/news-ui.test.ts
npm run validate:news-contract
```

Expected: both exit 0; all negative cases fail only when individually injected.

**Step 5: Commit the contract slice**

```bash
git add schemas/aoi-news-edition-v1.schema.json scripts/news-contract/validator.mjs src/lib/news/types.ts src/lib/news/load-news.ts fixtures/news-contract/non-production/import-bundle.json tests/news-contract.test.mjs tests/news-ui.test.ts
git diff --cached --check
git commit -m "feat: define News coverage and selection rationale"
```

## Task 2: Make coverage chronology the single catalog order

**Objective:** Ensure latest, archive, static previous links, and progressive history all consume one deterministic coverage-based order while RSS remains publication-event ordered.

**Files:**
- Modify: `src/lib/news/load-news.ts:169-221`
- Modify: `src/pages/news/index.astro:10-27`
- Modify: `src/pages/news/[editionId].astro:12-47`
- Modify: `src/components/news/NewsArchiveNav.astro:8-76`
- Modify: `src/lib/news/metadata.mjs`
- Modify: `scripts/news-contract/rolling-feed.mjs` only if coverage metadata is deliberately exposed without changing event order
- Modify: `tests/news-ui.test.ts`
- Modify: `tests/news-metadata.test.mjs`
- Modify: `tests/news-rolling-feed.test.mjs`

**Step 1: Write RED chronology tests**

Create isolated valid Editions with deliberately misleading publication order:

```ts
const ordered = validateNewsCatalog([
  { ...base, edition_id: '2026-07-21', edition_date: '2026-07-21', coverage_end_at: '2026-07-21T23:00:00+09:00', published_at: '2026-07-25T12:00:00+09:00' },
  { ...next, edition_id: '2026-07-22', edition_date: '2026-07-22', coverage_end_at: '2026-07-22T23:00:00+09:00', published_at: '2026-07-25T11:00:00+09:00' },
], [], 'review');
expect(ordered.editions.map(({ edition_id }) => edition_id)).toEqual(['2026-07-22', '2026-07-21']);
```

Also prove equal end but different start, fully equal window but different publication time, and fully equal window/publication but different ID all sort by the fixed key sequence. Assert `/news/`, archive, and `previous` props use that exact array. Separately assert RSS event order still follows event `published_at`/revision rules and never uses coverage chronology for `<pubDate>`.

**Step 2: Run chronology tests and confirm RED**

```bash
npm run test:news -- --run tests/news-ui.test.ts tests/news-metadata.test.mjs tests/news-rolling-feed.test.mjs
```

Expected: nonzero because `load-news.ts` currently sorts descending `published_at`.

**Step 3: Implement one comparator**

Export or locally centralize:

```ts
export const compareNewsEditions = (a: NewsEdition, b: NewsEdition) =>
  Date.parse(b.coverage_end_at) - Date.parse(a.coverage_end_at)
  || Date.parse(b.coverage_start_at) - Date.parse(a.coverage_start_at)
  || Date.parse(b.published_at) - Date.parse(a.published_at)
  || b.edition_id.localeCompare(a.edition_id);
```

Use only the sorted catalog array in latest-page selection, individual-page previous lookup, archive iteration, and history-link rendering. If JSON-LD exposes coverage, use `temporalCoverage` as an interval string while retaining `datePublished: edition.published_at` and event-derived `dateModified`.

**Step 4: Run chronology tests and confirm GREEN**

Run the Step 2 command again. Expected: exit 0, including the explicit RSS non-regression.

**Step 5: Commit the chronology slice**

```bash
git add src/lib/news/load-news.ts src/pages/news/index.astro src/pages/news/'[editionId].astro' src/components/news/NewsArchiveNav.astro src/lib/news/metadata.mjs scripts/news-contract/rolling-feed.mjs tests/news-ui.test.ts tests/news-metadata.test.mjs tests/news-rolling-feed.test.mjs
git diff --cached --check
git commit -m "feat: order News editions by coverage window"
```

## Task 3: Prepare and approve the three source-selection packets

**Objective:** Establish editorial authority, deduplication, truthful windows, and public-safe Signal copy before an Engineer changes canonical content.

**Files:**
- Create outside the app runtime in a task-owned review workspace: three source-selection packets for 2026-07-21, 2026-07-22, and 2026-07-23
- Read only: the three exact DailyNews roundup paths listed in Scope, their date-matched run reports, direct sources, and any explicitly cited source packs
- No app repository source change in this task

**Step 1: Writer produces candidate packets**

For each date, record:

```text
coverage_start_at / coverage_end_at with evidence
3–5 selected direct URLs
source title / source kind / source publication timestamp when known
one public-safe source_fact
one reader-facing selection_reason
one caveat when source scope or vendor claims need qualification
one AOI note
rejection list with reasons (private; never imported)
actual packet review timestamp (candidate for Edition published_at only after approval)
```

Use `shugo-writer` for prose. Do not copy DailyNews body text as a public Signal, and do not turn DRAFT_META or feed counts into visible copy.

**Step 2: Source Debug gate**

An independent source Debugger reopens every selected direct URL and checks claim locator, source kind, title, publication timestamp, caveat, normalized URL, and whether the claimed coverage window is supported. It also computes normalized URL/claim overlap against public `src/content/news/editions/2026-07-24.json` and the other two packets.

Required result: `PASS`, `FAIL`, or `BLOCKED`, with each source URL and claim location. A local review request, roundup score, or pipeline success is not approval.

**Step 3: Editorial Reviewer gate**

After source Debug PASS, Editorial Reviewer checks selection strength, 3–5 count, no padding, no duplicate claim, source hierarchy, separation of fact/reason/caveat/note, tone, and public usefulness. Reviewer records explicit approval per item and the actual review timestamp.

**Step 4: Stop on missing approval**

If any date has fewer than three approved strong items, do not lower the bar or borrow from 2026-07-24. Block that Edition and therefore the four-public-Edition acceptance gate.

**Step 5: Handoff only approved packets to Engineer**

The handoff must name exact approved URLs, coverage instants, public text, receipt/claim-locator evidence, actual approval timestamp, and rejected items. No private source body, local secret, internal score, or hidden reasoning enters `src/content/news`.

## Task 4: Backfill three truthful public Editions and preserve the review fixture

**Objective:** Produce exactly four public Editions while retaining the non-production sample as an unmistakable review fixture and preserving real event times.

**Files:**
- Create: `src/content/news/editions/2026-07-21.json`
- Create: `src/content/news/editions/2026-07-22.json`
- Modify or replace: `src/content/news/editions/2026-07-23.json`
- Modify: `src/content/news/editions/2026-07-24.json`
- Create: `src/content/news/events/2026-07-21.json`
- Create: `src/content/news/events/2026-07-22.json`
- Modify or replace: `src/content/news/events/2026-07-23.json`
- Modify: `src/content/news/events/2026-07-24.json` only if reviewed public wording/coverage metadata requires it; never rewrite its actual timestamp
- Move/create review-only sample files with a non-colliding ID, for example `src/content/news/editions/2026-07-23-0900.json` and `src/content/news/events/2026-07-23-0900.json`, if the sample remains canonical
- Modify: `src/content/news/contexts/agent-authority.json` only to follow a re-identified review sample; do not attach old sample Signals to new public facts
- Modify: `src/content/news/contexts/connected-ai-boundaries.json` only for explicitly approved new evidence
- Modify: `fixtures/news-contract/non-production/import-bundle.json`
- Modify: `tests/news-contract.test.mjs`
- Modify: `tests/news-ui.test.ts`
- Modify: `tests/news-rolling-feed.test.mjs`

**Step 1: Write RED content-manifest tests**

Assert:

```ts
expect(loadNewsCatalog('production').editions.map((e) => e.edition_date))
  .toEqual(['2026-07-24', '2026-07-23', '2026-07-22', '2026-07-21']);
expect(loadNewsCatalog('production').editions).toHaveLength(4);
expect(loadNewsCatalog('production').editions.slice(1).every((e) => e.items.length >= 3 && e.items.length <= 5)).toBe(true);
```

Add a normalized source-URL uniqueness assertion across all public Editions and a fixture assertion that the sample is review-only, non-colliding, visibly labeled, and carries `selection_reason`. Assert each new Edition's `published_at` and revision-1 event `published_at` equal recorded review/publication evidence and are not merely its `edition_date` at a fabricated time.

**Step 2: Run content tests and confirm RED**

```bash
npm run test:news -- --run tests/news-contract.test.mjs tests/news-ui.test.ts tests/news-rolling-feed.test.mjs
npm run validate:news-contract
```

Expected: nonzero because only one public Edition exists and no approved backfill manifests are present.

**Step 3: Stage imports in fresh output**

Create one private publication bundle per approved Edition and run the importer to fresh directories:

```bash
STAGE_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/aoi-news-depth.XXXXXX")"
node scripts/import-news-contract.mjs --input <approved-2026-07-21-bundle.json> --output "$STAGE_ROOT/2026-07-21"
node scripts/import-news-contract.mjs --input <approved-2026-07-22-bundle.json> --output "$STAGE_ROOT/2026-07-22"
node scripts/import-news-contract.mjs --input <approved-2026-07-23-bundle.json> --output "$STAGE_ROOT/2026-07-23"
```

Inspect every staged file before copying exact approved public JSON into canonical paths. Do not import receipts, rejection lists, source bodies, or private wrappers.

**Step 4: Preserve publication truth**

- Set each Edition `published_at` to the actual recorded editorial approval/publication event, even if all three are published on the same later day.
- Create revision-1 events at actual event times and order them deterministically if multiple Editions are approved in one session.
- Do not alter Signal source publication timestamps.
- Keep the existing public 2026-07-24 event timestamp `2026-07-24T15:01:05+09:00` unless a real later reviewed revision is added; a new revision uses a new actual timestamp.
- Re-identify the old review sample and its events if retained, preserving its real review timestamps and review-only status.

**Step 5: Run content tests and confirm GREEN**

Run the Step 2 commands again. Expected: exit 0; production has exactly four Editions; review fixture is distinct; all URLs and claims are approved and unique.

**Step 6: Commit exact content paths**

```bash
git add <exact approved edition/event/context/fixture paths> tests/news-contract.test.mjs tests/news-ui.test.ts tests/news-rolling-feed.test.mjs
git diff --cached --check
git diff --cached --stat
git commit -m "content: add reviewed News edition history"
```

## Task 5: Add the editorial policy route and entry links

**Objective:** Explain selection and correction rules where readers can find them without implying exhaustiveness, ranking, sponsorship, or pay-to-play.

**Files:**
- Create: `src/pages/news/editorial-policy.astro`
- Modify: `src/components/news/NewsDeskHeader.astro:11-22`
- Modify: `src/components/news/NewsSignalCard.astro:22-83`
- Modify: `src/lib/news/metadata.mjs`
- Modify: `astro.config.mjs:13-32` only if the sitemap filter needs an explicit policy assertion
- Modify: `scripts/verify-news-build.mjs`
- Modify: `tests/news-metadata.test.mjs`
- Modify: `tests/news-vercel-config.test.mjs`
- Modify: `tests/news.spec.ts`

**Step 1: Write RED route and wording tests**

Test `/news/editorial-policy/` for one canonical, correct robots by mode, CollectionPage/WebPage JSON-LD as decided, Japanese description metadata, sitemap inclusion, and visible sections equivalent to:

- 選ぶもの: consequential change, operational relevance, verifiable source, distinct reader value;
- 選ばないもの: duplicated claims, unsupported rumors, pure promotion without verifiable change, padding;
- source hierarchy: official/direct first, then regulator/advisory/paper/original reporting, analysis only with attribution;
- caveats: vendor claims, preview/limited availability, benchmark limits, inaccessible sources;
- corrections: visible correction note, preserved event history, supersede/withdraw rather than silent rewrite;
- explicit disclaimer: not comprehensive, not a popularity ranking, not sponsored selection, not pay-to-play.

Assert the header has a normal `Editorial policy` link and each Signal offers a contextual policy link near “Why selected,” without changing source-link priority or tab order.

**Step 2: Run focused tests and confirm RED**

```bash
npm run test:news -- --run tests/news-metadata.test.mjs tests/news-vercel-config.test.mjs
npm run test:news:e2e -- --grep "editorial policy"
```

Expected: nonzero/failed test because the route and links do not exist.

**Step 3: Implement server-only policy content**

- Use `NewsLayout` and the current mode resolver; do not introduce a second layout or runtime fetch.
- Put policy prose directly in the Astro page as reviewed public content.
- Add metadata via a small `buildEditorialPolicyMetadata()` helper rather than inline divergent JSON-LD.
- Keep the card link short and adjacent to selection rationale; it must not compete visually with the direct source CTA.
- Ensure Astro sitemap includes the policy in both review and production builds.

**Step 4: Run focused tests and confirm GREEN**

Repeat Step 2. Expected: exit 0, exact route/metadata/link assertions pass.

**Step 5: Commit the policy slice**

```bash
git add src/pages/news/editorial-policy.astro src/components/news/NewsDeskHeader.astro src/components/news/NewsSignalCard.astro src/lib/news/metadata.mjs astro.config.mjs scripts/verify-news-build.mjs tests/news-metadata.test.mjs tests/news-vercel-config.test.mjs tests/news.spec.ts
git diff --cached --check
git commit -m "feat: explain News editorial selection policy"
```

## Task 6: Render bounded, semantically separated Signal cards

**Objective:** Make card boundaries and reading regions immediately understandable while preserving DOM order, accessibility, and two-column density.

**Files:**
- Modify: `src/components/news/NewsSignalCard.astro:22-83`
- Modify: `src/styles/news.css:3-14,259-385,512-661,663-842`
- Modify: `tests/news.spec.ts`
- Modify: `scripts/generate-news-layout-evidence.mjs`

**Step 1: Write RED DOM and computed-style tests**

Require direct child order:

```ts
expect(await signal.locator(':scope > [data-news-order]').evaluateAll((nodes) =>
  nodes.map((node) => node.getAttribute('data-news-order'))
)).toEqual(['source', 'headline', 'fact', 'selection', 'caveat', 'note', 'metadata', 'action']);
```

For every card at 390, 768, 1024, 1280, 1440, and 1728 widths, assert:

- non-transparent/non-body-equivalent background color;
- 1px solid border on all sides and a visible cyan accent (border edge or inset rule);
- consistent inline/block padding at least 20px mobile and 24px larger widths;
- positive grid gap so adjacent card borders do not collapse into one rule;
- fact, selection, caveat, note, and footer are separately addressable regions with headings/ARIA targets;
- two columns remain at 768+ according to current density contract;
- no overflow, minimum 14px JP body, source CTA and nav/policy links at least 44px;
- keyboard order follows DOM order and direct source remains the primary action.

Capture screenshot expectations at phone, tablet, and desktop. Use screenshots as review evidence, not as the sole boundary proof.

**Step 2: Run card tests and confirm RED**

```bash
npm run test:news:e2e -- --grep "Signal card boundaries|Edition density|horizontal overflow|keyboard"
```

Expected: nonzero because cards currently have only a top rule, no filled bounded surface, and no selection region.

**Step 3: Implement the minimal card structure**

Use a non-glass token, for example:

```css
:root {
  --news-card-surface: #071010;
  --news-card-border: #315858;
}
.news-signal-list { gap: 28px; }
.news-signal {
  min-width: 0;
  padding: clamp(20px, 3vw, 32px);
  border: 1px solid var(--news-card-border);
  background: var(--news-card-surface);
}
.news-signal--lead { box-shadow: inset 3px 0 0 var(--news-cyan-dim); }
```

- Do not use `.aoi-glass`, translucency, blur, bloom, or glass-on-glass for body cards.
- Keep a compact source/type/status header.
- Render Source fact, Why selected, Caveat (when present), and AOI note as sibling regions instead of nesting Caveat under Source fact.
- Render the source metadata and direct-source CTA as the footer/action boundary.
- Preserve all IDs and `aria-labelledby` relationships across progressively appended Editions.
- Adjust page-height budgets only after measuring the real result; do not relax overflow, body-size, target-size, or two-column requirements to make tests pass.

**Step 4: Run tests and generate fresh evidence**

```bash
npm run test:news:e2e -- --grep "Signal card boundaries|Edition density|horizontal overflow|keyboard"
EVIDENCE_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/aoi-news-card-evidence.XXXXXX")"
NEWS_EVIDENCE_ROOT="$EVIDENCE_ROOT" npm run evidence:news-layout
```

Expected: tests exit 0; fresh screenshots/metrics show bounded cards at all required widths without tracked generated residue.

**Step 5: Image Reviewer gate**

An independent image Reviewer compares phone/tablet/desktop screenshots and numeric computed styles. It checks card grouping, region hierarchy, density, source CTA prominence, no accidental glass, no clipping, and no visually merged adjacent borders. FAIL returns to Engineer.

**Step 6: Commit the card slice**

```bash
git add src/components/news/NewsSignalCard.astro src/styles/news.css tests/news.spec.ts scripts/generate-news-layout-evidence.mjs
git diff --cached --check
git commit -m "feat: clarify News signal card boundaries"
```

## Task 7: Refactor history loading into a testable one-append primitive

**Objective:** Separate guarded fetch/append behavior from click/observer/history orchestration before adding automatic loading.

**Files:**
- Modify: `src/scripts/news-edition-history.ts:1-157`
- Modify: `src/components/news/NewsEditionHistoryLoader.astro:12-28`
- Modify: `tests/news.spec.ts`

**Step 1: Write RED interaction tests**

Add tests proving a shared append primitive:

- accepts only the current server-provided same-origin exact href/target ID;
- requires one matching `[data-news-edition]`, one heading, and one matching fetched loader;
- appends one article and advances the persistent target once;
- does not execute fetched scripts;
- rejects non-HTML, non-2xx, cross-origin, duplicate/cycle, missing/multiple article, mismatched ID, malformed next link, and concurrent calls;
- manual invocation focuses the appended H2; automatic invocation does not;
- both modes announce success; failure keeps the unchanged ordinary anchor enabled.

**Step 2: Run interaction tests and confirm RED where behavior is not separable**

```bash
npm run test:news:e2e -- --grep "append primitive|same-origin|fetch failure|focus"
```

Expected: existing happy-path cases may pass, but automatic no-focus and explicit lifecycle/concurrency assertions fail.

**Step 3: Refactor without changing default behavior**

Introduce explicit call options:

```ts
interface AppendOptions {
  trigger: 'manual' | 'automatic' | 'restore';
  focusHeading: boolean;
  historyMode: 'push' | 'replace' | 'none';
}
```

Return a typed result such as `{ ok, reason, appendedId }`, keep mutation after complete response validation, and centralize pending/cycle guards. Do not add `IntersectionObserver` yet.

**Step 4: Run interaction tests and confirm GREEN**

Repeat Step 2 and existing through-history tests. Expected: exit 0 with unchanged manual/JS-off behavior.

**Step 5: Commit the refactor slice**

```bash
git add src/scripts/news-edition-history.ts src/components/news/NewsEditionHistoryLoader.astro tests/news.spec.ts
git diff --cached --check
git commit -m "refactor: isolate News history append lifecycle"
```

## Task 8: Arm automatic loading only after real user scroll

**Objective:** Add one-Edition-at-a-time IntersectionObserver loading without initial-load surprises or scroll-depth tracking.

**Files:**
- Modify: `src/components/news/NewsEditionHistoryLoader.astro`
- Modify: `src/scripts/news-edition-history.ts`
- Modify: `src/styles/news.css`
- Modify: `tests/news.spec.ts`

**Step 1: Write RED observer tests**

Use a controllable observer shim where helpful and real Playwright wheel/keyboard input for the user-intent boundary. Cover:

1. observer unavailable: ordinary manual link works and no automatic request occurs;
2. sentinel initially visible at page load: zero requests/appends;
3. timer/idle/programmatic initial restoration without user intent: zero automatic append;
4. trusted wheel/touch/scroll-key intent followed by actual scroll movement arms observation;
5. one intersecting callback appends exactly one Edition even if callback contains repeated entries;
6. repeated intersections while pending append nothing extra;
7. successful append keeps/moves the sentinel after the new tail, disconnects before mutation, then reconnects;
8. a long appended Edition pushes the sentinel below the viewport and does not immediately cascade-load another Edition;
9. after the reader scrolls again and the sentinel intersects, exactly one additional Edition appends;
10. oldest state disconnects permanently and renders an Archive link/finite state;
11. fetch/parse failure disconnects during request, reports error, leaves manual retry, and reconnects only after the sentinel exits/re-enters or another genuine scroll to avoid a retry loop;
12. automatic append never focuses a heading or changes the active element;
13. no analytics/network beacon/localStorage/sessionStorage/cookie/write outside normal Edition GETs and URL history.

If `navigator.connection.saveData` support is adopted, test that save-data disables only automatic observation while manual link remains. Do not add the branch without a testable cross-browser fallback.

**Step 2: Run observer tests and confirm RED**

```bash
npm run test:news:e2e -- --grep "scroll-triggered history|observer initial|long Edition|automatic focus|manual retry"
```

Expected: nonzero because no observer/sentinel exists.

**Step 3: Add server-first sentinel markup**

Keep the anchor and live region, and add a non-interactive sentinel after the link:

```astro
<div data-news-history-sentinel aria-hidden="true"></div>
```

The sentinel must remain in the persistent loader after appended history, not inside a fetched Edition. It is a loading boundary, not a reader-tracking marker.

**Step 4: Implement guarded observer lifecycle**

- Do not instantiate/observe on startup.
- Record trusted scroll intent from `wheel`, `touchmove`, scroll keys (`PageDown`, `PageUp`, arrows, Home/End, Space), and pointer interaction appropriate to scrollbar use.
- Arm only after intent is followed by a real scroll-position change; clear stale intent so a click followed much later by layout movement cannot arm loading.
- Observe only when a previous-Edition target exists, no request/reconciliation is pending, and the user-scroll gate is satisfied.
- On qualifying intersection, disconnect first, consume one current target snapshot, and call the append primitive once with `{ trigger: 'automatic', focusHeading: false, historyMode: 'replace' }`.
- After success, ensure the sentinel remains after the updated link/new tail. Reobserve only after layout settles and only if the sentinel is not still continuously intersecting; require exit/re-entry or a subsequent real scroll before the next automatic append.
- After failure, retain the link and live error; never auto-retry in a loop.
- At terminal oldest state, remove observer eligibility and show the Archive link.

**Step 5: Run observer tests and confirm GREEN**

Repeat Step 2. Expected: exit 0 and request counters prove exactly one automatic GET per qualifying intersection.

**Step 6: Commit the observer slice**

```bash
git add src/components/news/NewsEditionHistoryLoader.astro src/scripts/news-edition-history.ts src/styles/news.css tests/news.spec.ts
git diff --cached --check
git commit -m "feat: load older News editions after reader scroll"
```

## Task 9: Reconcile automatic/manual history with `through` and Back

**Objective:** Preserve reload/Back behavior without automatic back-stack spam or arbitrary URL construction.

**Files:**
- Modify: `src/scripts/news-edition-history.ts:106-154`
- Modify: `tests/news.spec.ts`

**Step 1: Write RED history-mode tests**

Cover a synthetic four-public-Edition chain:

- manual append uses one `pushState` and Back truncates one explicit action;
- automatic append uses `replaceState`; two automatic appends do not add two Back entries;
- mixed manual then automatic history leaves one meaningful Back boundary;
- reload at `?through=2026-07-21` restores the finite server-linked chain without focusing or arming the observer;
- valid Back/Forward truncates/restores exact chains and reconnects observer only after later real scroll;
- unknown, malformed, hidden, cyclic, or unreachable `through` follows only server links, preserves the successful prefix, removes invalid state with `replaceState`, and keeps manual fallback;
- canonical and JSON-LD remain query-free.

**Step 2: Run history tests and confirm RED**

```bash
npm run test:news:e2e -- --grep "automatic replaceState|mixed history|through restoration|Back"
```

Expected: nonzero because existing click behavior always pushes and automatic behavior does not exist.

**Step 3: Implement explicit state transition rules**

- Move URL mutation into the append primitive result handler.
- Manual success: `pushState` to resulting `through`.
- Automatic success: `replaceState` to resulting `through`.
- Restoration: no new entry; invalid-state cleanup uses `replaceState`.
- Keep unrelated query keys but never include query in canonical metadata.
- `popstate` reconciliation disconnects observation, uses server-provided immediate-previous links, prevents duplicate IDs/cycles, and reconnects only after reconciliation plus a later user-scroll gate.

**Step 4: Run history tests and confirm GREEN**

Repeat Step 2. Expected: exit 0 with finite URL restoration and no automatic stack spam.

**Step 5: Commit the history slice**

```bash
git add src/scripts/news-edition-history.ts tests/news.spec.ts
git diff --cached --check
git commit -m "fix: preserve News history during automatic loading"
```

## Task 10: Expand build verification, route manifests, and responsive evidence

**Objective:** Make four-Edition coverage, policy, selection rationale, card boundaries, and privacy requirements build-gating facts in review and production.

**Files:**
- Modify: `scripts/verify-news-build.mjs:15-142`
- Modify: `scripts/generate-news-layout-evidence.mjs`
- Modify: `tests/news-vercel-config.test.mjs`
- Modify: `tests/news-metadata.test.mjs`
- Modify: `tests/news.spec.ts`
- Modify: `package.json` only if a focused non-destructive verification command is needed

**Step 1: Write RED verifier fixture cases**

Refactor the verifier enough to inject a fresh build root and assert nonzero for:

- fewer/more than four public Editions;
- wrong coverage order or invalid coverage metadata;
- missing policy route, canonical, metadata, or sitemap URL;
- missing `selection_reason` in generated card HTML;
- leaked internal term in selection rationale (`FreshRSS`, score/rank, DailyNews path, review receipt, prompt);
- duplicate public normalized source URL;
- missing card surface/border/padding contract in generated CSS;
- changed RSS event timestamp/order caused by coverage sorting;
- review-only sample leaking into production routes/feed/sitemap;
- observer script containing analytics, beacon, storage/cookie, or external fetch behavior.

**Step 2: Run verifier tests and confirm RED**

```bash
npm run test:news -- --run tests/news-vercel-config.test.mjs tests/news-metadata.test.mjs
```

Expected: nonzero because the verifier does not know the new route/contract.

**Step 3: Implement deterministic verification**

- Build expected Edition route sets from validated, coverage-sorted content.
- Assert production count exactly four and exact coverage-end date sequence.
- Add `/news/editorial-policy/` to route and sitemap expectations.
- Scan public serialized content/HTML for required selection rationale and forbidden internal-workflow keys/terms without banning legitimate public words by accident.
- Keep `datePublished`/event feed assertions tied to real publication/event timestamps.
- Verify generated script references only same-origin Edition fetches and History/Observer APIs; prefer behavioral E2E proof over brittle minified-source regex for privacy.

**Step 4: Run unit/verifier tests and confirm GREEN**

Repeat Step 2. Expected: exit 0; injected leak fixtures still exit nonzero.

**Step 5: Generate fresh responsive proof**

Use a fresh directory, never overwrite prior tracked evidence in place:

```bash
EVIDENCE_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/aoi-news-depth-evidence.XXXXXX")"
NEWS_EVIDENCE_ROOT="$EVIDENCE_ROOT" npm run evidence:news-layout
```

Required screenshots: 390x844, 768x1024, 1024x1366, 1440x1000. Required numeric readback: card background/border/padding/gap, columns/rows, overflow offenders, target size, body sizes, sentinel position before/after one append, and active element before/after automatic append.

**Step 6: Commit verifier code only**

```bash
git add scripts/verify-news-build.mjs scripts/generate-news-layout-evidence.mjs tests/news-vercel-config.test.mjs tests/news-metadata.test.mjs tests/news.spec.ts package.json package-lock.json
git diff --cached --check
git commit -m "test: verify News reading depth and clarity"
```

Do not commit temporary screenshots/build output unless a later explicitly scoped evidence task requests exact artifacts.

## Task 11: Run complete Engineer self-tests in fresh outputs

**Objective:** Produce repeatable local evidence for the independent Debug gate without deleting shared output or claiming independent approval.

**Files:**
- No source changes unless a test reveals a task-scoped defect.
- Do not add `dist/`, Playwright reports, temporary packets, or screenshots to Git.

**Step 1: Confirm exact repository state**

```bash
git status --short --branch
git rev-parse HEAD
git diff --check
```

Expected: intended task commits only; no unrelated or generated residue.

**Step 2: Run contract and unit tests**

```bash
npm run test:news
npm run validate:news-contract
```

Expected: both exit 0; production catalog fixture reports exactly four public Editions.

**Step 3: Build and verify review mode using fresh copied work output**

Use the normal build only when its output is task-local and disposable; otherwise move an existing `dist` to a timestamped task trash path before building rather than `rm -rf`.

```bash
if [ -e dist ]; then mv dist "${TMPDIR:-/tmp}/aoi-news-old-dist-$(date +%Y%m%d%H%M%S)"; fi
VERCEL_ENV=preview npm run build
VERCEL_ENV=preview npm run verify:news-build:review
VERCEL_ENV=preview npm run test:news:e2e
```

Expected: exit 0; review route set includes policy and any explicitly retained review fixture, all rationale text, no overflow, and guarded observer behavior.

**Step 4: Build and verify production mode without destructive cleanup**

```bash
if [ -e dist ]; then mv dist "${TMPDIR:-/tmp}/aoi-news-review-dist-$(date +%Y%m%d%H%M%S)"; fi
VERCEL_ENV=production npm run build
VERCEL_ENV=production npm run verify:news-build:production
VERCEL_ENV=production npm run test:news:e2e
```

Expected: exit 0; exactly four public Edition routes plus News index/archive/policy/public Context routes; review sample absent; RSS publication events remain truthful.

**Step 5: Run the repository-wide relevant check**

```bash
if [ -e dist ]; then mv dist "${TMPDIR:-/tmp}/aoi-news-production-dist-$(date +%Y%m%d%H%M%S)"; fi
npm run build
```

Expected: exit 0 and non-News routes still build.

**Step 6: Inspect exact diff and record the immutable candidate**

```bash
git status --short
git diff --check
git diff origin/main...HEAD -- schemas scripts src/content/news src/lib/news src/components/news src/layouts src/pages/news src/styles/news.css fixtures tests package.json package-lock.json astro.config.mjs
test -z "$(git status --porcelain)"
CANDIDATE_SHA=$(git rev-parse HEAD^{commit})
git cat-file -e "${CANDIDATE_SHA}^{commit}"
printf '%s\n' "$CANDIDATE_SHA"
git status --short --branch
```

Expected: Tasks 1–10 have already committed every implementation slice, so the cleanliness assertion exits 0 and the existing tip is recorded as one exact candidate SHA. This step does not create, squash, amend, or rewrite a commit. If a test or build leaves tracked changes, stop: inspect them, discard task-local generated residue, or—only for an intentional task-owned source change—return to the owning Task's exact-path staging and commit step, rerun Steps 1–5, and then restart this step. Never stage a path merely because a test touched it. The recorded candidate must have a clean index and worktree. Do not push or deploy.

## Task 12: Independent Debug gate

**Objective:** Independently reproduce the baseline/risks and verify the exact Engineer SHA before visual, Preview, or release review.

**Files:**
- No source changes unless Debug returns FAIL to Engineer.

**Step 1: Check exact immutable candidate**

Debugger checks out the Engineer SHA and records commit/tree, Node/npm versions, and clean status.

**Step 2: Independently test contract/content truth**

Re-run or independently inspect:

- coverage required/order/date coherence/equal-window tie cases;
- four public Editions, 3–5 Signals in each backfill, source approval packets, normalized URL and material-claim deduplication;
- actual Edition/RSS event timestamps versus approval records; no historical backdating;
- required `selection_reason` in canonical current content and review fixture; internal-term leak negatives;
- policy route/canonical/robots/metadata/sitemap/header/card links and required disclaimers.

**Step 3: Independently test interaction/accessibility/privacy**

Exercise initial no-load, real wheel/key scroll, one append/intersection, long Edition sentinel movement, disconnect/reconnect, oldest state, concurrency/cycle, fetch/parse failure and manual retry, no-JS, manual focus, automatic no-focus, mixed `pushState`/`replaceState`, Back/Forward/reload/invalid `through`, same-origin exact article extraction, aria-live, and no tracking/storage/beacons.

**Step 4: Independently test visuals**

Read numeric card styles and screenshots at 390, 768, 1024, 1280, 1440, and 1728. Confirm visible bounded cards, distinct regions, two-column density, 44px controls, 14px JP body, no horizontal overflow, and no glass body surface.

Required handoff: `PASS`, `FAIL`, or `BLOCKED` with exact SHA, commands, exit codes, source/evidence paths, screenshots, and environment assumptions. FAIL stops the chain and returns to Engineer; Engineer self-test is not Debug approval.

## Task 13: Image Reviewer and Preview gates

**Objective:** Validate visual clarity and the real Preview runtime at the same immutable candidate before release review.

**Files:**
- No source changes. Any change creates a new SHA and invalidates downstream approvals.

**Step 1: Image Reviewer gate**

After Debug PASS, image Reviewer inspects the exact-SHA responsive screenshots and numeric evidence. PASS requires immediate card-boundary comprehension, correct region hierarchy, readable density, source-first action, non-glass material, and no overflow/clipping. REVISE returns to Engineer.

**Step 2: Authorize Preview action**

Preview deployment is external and must wait for explicit owner authorization. Confirm Vercel project identity and that production alias is unchanged. Deploy exact SHA to Preview only, never `--prod`.

**Step 3: Preview readback**

Verify Preview URL routes and generated assets:

- `/news/`, all review-visible Edition routes, `/news/archive/`, `/news/editorial-policy/`, Context routes, feed, and sitemap;
- noindex review mode and review labels;
- exact source links and selection rationales;
- observer/no-JS/failure/history/accessibility scenarios;
- computed card boundaries and responsive screenshots;
- no console errors, external analytics, read tracking, or unexpected requests;
- production `aoifuture.com` remains unchanged.

Required Preview result: deployment ID/URL, exact SHA/tree, command/log results, route manifest, screenshots, failures, and rollback/cleanup plan.

## Task 14: Release Reviewer decision packet

**Objective:** Require an independent release-level review after functional, source, editorial, visual, and Preview evidence exists.

**Files:**
- No source changes.

Release Reviewer verifies the exact SHA and evidence chain:

```text
Writer approval packet
→ source Debug PASS
→ Editorial Reviewer PASS
→ Engineer candidate/self-test
→ independent Debug PASS
→ image Reviewer PASS
→ Preview PASS
```

The decision packet must include:

- exact candidate SHA/tree and Preview deployment ID/URL;
- four-public-Edition route/feed/sitemap manifest;
- coverage windows and actual publication/event timestamps;
- approved source list and deduplication proof;
- policy wording and no-comprehensiveness/ranking/sponsorship/pay-to-play assertions;
- interaction/accessibility/privacy results;
- image review screenshots/metrics;
- known warnings/environment assumptions;
- current known-good production deployment ID;
- proposed production action and exact rollback action;
- explicit owner authorization field.

Release Reviewer returns PASS, REVISE, or BLOCKED. PASS does not deploy. Any new commit invalidates Debug, image, Preview, and Release approval.

## Task 15: Production live gate and rollback

**Objective:** Publish only the approved immutable candidate, verify the public artifact, and roll back immediately on any failed acceptance check.

**Files:**
- No source changes.
- Ops-only after Release Reviewer PASS and explicit owner authorization.

**Step 1: Reconfirm authorization and rollback target**

Verify exact SHA/tree, clean worktree, Vercel target/project, production environment, all gate records, known-good production deployment ID, and owner authorization. Abort on mismatch.

**Step 2: Deploy through the established production path only**

Do not change DNS, scheduler, analytics, environment variables, project linkage, or unrelated aliases. Capture deployment ID, logs, and alias result.

**Step 3: Live production readback**

Fetch and browser-test:

- `/news/` shows the latest coverage-end Edition;
- exactly four public Edition routes for 2026-07-21..24;
- `/news/archive/` orders them by coverage end;
- `/news/editorial-policy/` is indexable, canonical, linked, and in sitemap;
- review fixture routes/context/events are absent;
- RSS contains actual public Edition events in actual publication order/times;
- each backfill has 3–5 approved Signals and visible selection rationale;
- card boundaries and responsive metrics pass at phone/tablet/desktop;
- initial observer does not load, actual scroll loads one, manual/no-JS/failure/history behavior works;
- no unexpected analytics, beacons, storage, profiling, ranking, or reader tracking;
- critical non-News routes remain healthy.

**Step 4: Roll back on any failed check**

Immediately promote/restore the recorded known-good production deployment using the established Vercel rollback mechanism. Re-read the public alias, `/news/`, and critical non-News routes. Do not hotfix production; open a new Engineer task with evidence.

**Step 5: Record live result**

PASS requires deployment ID, exact SHA/tree, alias, live route/feed/sitemap hashes or equivalent readback, browser evidence, and rollback readiness. A successful deployment command without readback is not a successful release.

## Final acceptance checklist

- [ ] `coverage_start_at` and `coverage_end_at` are required, valid instants with start <= end.
- [ ] Coverage end's JST date equals `edition_date`; Edition ID prefix equals `edition_date`.
- [ ] Edition ordering is coverage end, coverage start, publication time, then Edition ID, all descending.
- [ ] RSS and metadata retain actual publication/review event semantics; no backdated publication claims exist.
- [ ] Production has exactly four public Editions covering 2026-07-21..24.
- [ ] Each backfill contains 3–5 explicitly approved strong direct/primary Signals with no padding.
- [ ] Public normalized source URLs/material claims do not duplicate one another or public 2026-07-24.
- [ ] Current public content and review fixture require public-safe `selection_reason` with no internal-workflow leakage.
- [ ] `/news/editorial-policy/` explains inclusion, exclusions, hierarchy, caveats, corrections, and no comprehensiveness/popularity/sponsorship/pay-to-play implication.
- [ ] Header and cards link to editorial policy without displacing the direct source action.
- [ ] Signal cards have a defined non-glass surface, visible 1px border/accent, consistent padding/gaps, and distinct fact/selection/caveat/note/footer regions.
- [ ] Card DOM/tab order, unique IDs/ARIA, two-column density, 14px JP body, 44px controls, and no-overflow requirements pass.
- [ ] Initial observer visibility, timer, idle, and restoration do not auto-load.
- [ ] Actual user scroll arms loading; one qualifying intersection appends exactly one immediate previous Edition.
- [ ] Sentinel follows the tail; pending/reconciliation disconnects; success/failure reconnect rules prevent cascades/retry loops.
- [ ] Automatic append does not steal focus; manual append retains accessible focus; both use polite announcements.
- [ ] Fetch failure preserves ordinary manual retry; JS-off navigation and observer-unavailable fallback work.
- [ ] Same-origin exact article extraction, concurrency/cycle guards, and finite oldest state pass.
- [ ] Automatic appends use `replaceState`; manual appends use meaningful `pushState`; reload/Back/Forward/invalid `through` pass.
- [ ] No analytics, reader IDs, popularity/ranking, profiling, read tracking, beacon, storage, or external automatic fetch is added.
- [ ] Review and production unit, contract, build, verifier, E2E, responsive, accessibility, metadata, feed, and sitemap checks pass.
- [ ] Writer, source Debug, Editorial Reviewer, Engineer, independent Debug, image Reviewer, Preview, and Release Reviewer approve the same immutable SHA/evidence chain.
- [ ] Production requires explicit owner authorization, live readback, and a recorded known-good rollback deployment.
