# AOIFUTURE News Rolling Edition History and Production Cutover Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Decouple Edition identity from calendar date, add accessible user-triggered progressive Edition history, and make one validated content graph render safely as review-only Preview or public production output.

**Architecture:** Keep `edition_id` as the immutable route key (`YYYY-MM-DD` or `YYYY-MM-DD-HHMM`) and `edition_date` as calendar/display metadata constrained to the ID prefix. Load and validate the complete graph first, then derive a review catalog or a fail-closed production catalog whose public Editions, Contexts, events, routes, metadata, feed, and sitemap form a closed public subgraph. Render each Edition once on the server; the latest page progressively fetches individual same-origin Edition HTML and appends that exact article after demoting its H1, while the ordinary link remains the no-JavaScript and failure fallback.

**Tech Stack:** Astro 6, TypeScript, JSON Schema, Vitest, Playwright, Node.js build verifiers, Vercel environment metadata.

---

## Scope, invariants, and non-goals

- Start from branch `feature/aoifuture-news-m2-f1r` at `820b53524117a6f77ae237cde0809741bcb63ca4`; re-check `git status --short --branch` and `git diff --stat origin/main...HEAD` before implementation.
- `edition_id` is the only Edition route identity. Accept legacy `YYYY-MM-DD` and future `YYYY-MM-DD-HHMM`; do not rewrite legacy IDs or infer identity from `edition_date`.
- `edition_date` remains an RFC 3339 date used for display/calendar semantics and must exactly equal `edition_id.slice(0, 10)`.
- Catalog order is descending `published_at`, then descending `edition_id` as a deterministic tie-break. Duplicate Edition IDs and duplicate canonical route paths fail validation rather than being hidden by a `Map`.
- Add required `publication_status: "public" | "review-only"` to Edition and Active Context documents. Set `2026-07-24` and `connected-ai-boundaries` to `public`; set the `2026-07-23` sample and `agent-authority` to `review-only`.
- Review mode includes the complete valid graph, renders all routes, keeps visible Preview language, and emits `noindex, nofollow`. Local, unset, development, and Vercel Preview environments are review mode.
- Production mode exists only when `VERCEL_ENV` is exactly `production`. Do not accept an app flag, query string, hostname, branch name, or public client variable as an override.
- Every build validates the complete graph before filtering. Production then filters to `public` nodes and validates that public-only graph again. A public Edition referencing a review-only Context, or a public Context referencing a review-only Edition's Signal, fails the build as a public-closure violation.
- Production emits only public Edition and Context routes, public events, public RSS items, and public sitemap URLs. Review-only source facts, titles, URLs, topic labels, routes, event text, metadata, and JSON-LD must not leak into any production artifact.
- Production UI removes `EDITORIAL REVIEW PREVIEW`, sample, and no-production labels; uses `ROLLING EDITION` and public index wording; emits `index, follow`; and uses the normal Rolling Edition RSS title.
- `/news/` remains finite on first response. It exposes one explicit `前のEditionを読む` link and never auto-loads on scroll, intersection, idle, or timer.
- Each click appends at most one immediately previous visible Edition. JavaScript fetches only the link's same-origin individual Edition URL. JavaScript-off follows the link normally.
- The appended node is the server-rendered `[data-news-edition]` article from that response. Replace its single H1 with H2, preserve its contents/attributes, use Edition-prefixed IDs and references, announce completion with `aria-live`, and focus the appended Edition heading.
- Persist the oldest displayed Edition as `?through=<edition_id>` using History API. Back/forward and reload reconcile the displayed chain to that URL; restoration may sequentially refetch the finite chain but ordinary activation still loads exactly one Edition per click.
- A malformed, unreachable, review-hidden, or failed `through` target never injects arbitrary HTML. A fetch/network/parse failure reports an accessible error and leaves the ordinary fallback link usable.
- Canonical URLs never include `through` or any other loader query.
- When no older visible Edition exists, omit the loader or render a normal Archive link; never render a dead load control.
- Do not add analytics, reader identifiers, source-body storage, private receipts, automatic publication, infinite scroll, content API endpoints, redirects from date to ID, or a new dependency.
- Implementation gates are Engineer self-test → Debug Gate → Reviewer Gate → Ops Preview/live gate. No production deployment occurs during implementation or independent code review.

## Task 1: Lock Edition ID and publication-status contracts

**Objective:** Extend schemas and contract validation so route identity and visibility are explicit, deterministic, and fail closed.

**Files:**
- Modify: `schemas/aoi-news-edition-v1.schema.json:7-15`
- Modify: `schemas/aoi-news-context-v1.schema.json:7-17`
- Modify: `schemas/aoi-news-edition-event-v1.schema.json:21-43`
- Modify: `scripts/news-contract/validator.mjs:23-30,161-221,274-338,340-500`
- Test: `tests/news-contract.test.mjs`
- Test: `tests/news-rolling-feed.test.mjs`

**Step 1: Write RED schema and semantic tests**

Add focused cases that prove:

1. Edition and event IDs accept both `2026-07-24` and `2026-07-24-1530`.
2. `2026-07-24-x`, impossible dates, malformed HHMM, and IDs whose date prefix differs from `edition_date` fail.
3. Edition and Context documents require exactly one allowed `publication_status`.
4. Duplicate Edition IDs fail with `duplicate_edition_id` even if all other data matches.
5. Duplicate canonical routes fail with `duplicate_edition_route`.
6. Two Editions with equal `published_at` can coexist and are distinguished by ID.
7. Event IDs and `edition_url` derive from full `edition_id`, including the `-HHMM` suffix.

Use cloned existing fixtures; do not invent factual Signal content.

**Step 2: Run the focused tests and confirm RED**

Run:

```bash
npm run test:news -- --run tests/news-contract.test.mjs tests/news-rolling-feed.test.mjs
```

Expected: FAIL because the schemas only accept date-shaped IDs, status is unknown/missing, date equality is over-constrained, and duplicate Edition route identity is not checked.

**Step 3: Implement the minimal contract changes**

- Define the Edition ID pattern once in validator logic as date plus optional valid 24-hour `HHMM`; JSON Schemas use the equivalent anchored regex.
- Add required `publication_status` enum fields to Edition and Context schemas.
- Add `publication_status` to validator allowlists.
- Validate real date prefix and `edition_date === edition_id.slice(0, 10)` independently of the optional time suffix.
- In complete catalog and publication-bundle validation, collect Edition IDs and canonical route strings `/news/${edition_id}/`; report duplicate ID and duplicate route errors before constructing lookup maps.
- Build event URL as `https://aoifuture.com/news/${edition.edition_id}/` and keep deterministic event IDs based on the full ID.
- Preserve existing source URL, private-key, reciprocal-reference, correction, receipt, and transition checks.

**Step 4: Run the focused tests and confirm GREEN**

Run the Step 2 command again.

Expected: PASS for legacy and timestamped identity/status tests without weakening existing negative cases.

**Step 5: Commit the contract slice**

```bash
git add schemas/aoi-news-edition-v1.schema.json schemas/aoi-news-context-v1.schema.json schemas/aoi-news-edition-event-v1.schema.json scripts/news-contract/validator.mjs tests/news-contract.test.mjs tests/news-rolling-feed.test.mjs
git commit -m "feat: define News edition identity and visibility"
```

## Task 2: Add explicit status to reviewed content and import paths

**Objective:** Migrate current content and the publication importer without changing reviewed facts or private/public boundaries.

**Files:**
- Modify: `src/content/news/editions/2026-07-24.json`
- Modify: `src/content/news/editions/2026-07-23.json`
- Modify: `src/content/news/contexts/connected-ai-boundaries.json`
- Modify: `src/content/news/contexts/agent-authority.json`
- Modify: `fixtures/news-contract/non-production/import-bundle.json`
- Modify: `scripts/news-contract/importer.mjs:26-38`
- Modify: `src/lib/news/types.ts:50-97`
- Test: `tests/news-contract.test.mjs:317-348`

**Step 1: Write RED migration/import tests**

Assert exact assignments (`2026-07-24` and connected AI are public; sample and agent authority are review-only), stable JSON import output includes status, and an import attempting to overwrite an existing different Edition route/ID fails before writing any file.

**Step 2: Run the importer slice and confirm RED**

```bash
npm run test:news -- --run tests/news-contract.test.mjs
```

Expected: FAIL because content lacks status and importer collision behavior is not explicit.

**Step 3: Apply the data/type/import migration**

- Add only `publication_status` to the four canonical content documents and fixture equivalents; do not edit source facts, URLs, timestamps, revisions, or receipts.
- Add a shared `NewsPublicationStatus` union and required fields to `NewsEdition` and `NewsContext`.
- Before atomic writes, make the importer reject a destination whose canonical Edition route is already owned by a different identity; retain all-or-nothing validation and stable JSON formatting.
- Keep imported filenames `${edition_id}.json`; this naturally supports both accepted ID forms.

**Step 4: Run contract validation and confirm GREEN**

```bash
npm run test:news -- --run tests/news-contract.test.mjs
npm run validate:news-contract
```

Expected: both commands exit 0; output files in temporary tests contain only public schema fields.

**Step 5: Commit the migration slice**

```bash
git add src/content/news/editions/2026-07-24.json src/content/news/editions/2026-07-23.json src/content/news/contexts/connected-ai-boundaries.json src/content/news/contexts/agent-authority.json fixtures/news-contract/non-production/import-bundle.json scripts/news-contract/importer.mjs src/lib/news/types.ts tests/news-contract.test.mjs
git commit -m "feat: classify News content publication status"
```

## Task 3: Build one validated review/public catalog boundary

**Objective:** Validate all content first, then expose either the complete review graph or a closed public production graph with stable Edition ordering.

**Files:**
- Create: `src/lib/news/publication-mode.mjs`
- Modify: `src/lib/news/load-news.ts:18-220`
- Modify: `src/lib/news/types.ts:94-124`
- Test: `tests/news-ui.test.ts`

**Step 1: Write RED mode, ordering, duplicate, and closure tests**

Test the pure mode resolver with `undefined`, empty, `development`, `preview`, mixed-case/whitespace variants, and exact `production`. Add catalog tests for descending `published_at` then descending `edition_id`, full review visibility, public production visibility, and these build-stopping public closure failures:

- public Edition Signal → review-only Context;
- public Context current support → review-only Edition Signal;
- public Context historical revision evidence → review-only Edition Signal.

Also assert complete-graph validation still catches an invalid review-only node during production mode; filtering must not hide invalid content.

**Step 2: Run loader tests and confirm RED**

```bash
npm run test:news -- --run tests/news-ui.test.ts
```

Expected: FAIL because the loader has one global date-sorted catalog and no mode/closure boundary.

**Step 3: Implement the pure mode and catalog projection**

- Export `resolveNewsPublicationMode(vercelEnv)` returning `production` only for exact `production`, otherwise `review`.
- Refactor `validateNewsCatalog(editionsRaw, contextsRaw, mode = 'review')` to validate/normalize the complete graph, enforce duplicate identities/routes, and sort Editions by parsed `published_at` descending then `edition_id` descending.
- For production, filter both node classes by status and pass the result through the same reciprocal/public closure validator. Throw an error naming the public node and hidden dependency if closure is incomplete.
- Expose `loadNewsCatalog(mode?)`, `getEditionById(id, mode?)`, `getContextBySlug(slug, mode?)`, and `getSignalReference(signalId, mode?)`. Change `NewsSignalReference` from `editionDate` to `editionId` plus `editionDate` if display code still needs both.
- Avoid two independently validated global catalogs: cache by mode only after the complete graph has passed validation.

**Step 4: Run loader tests and confirm GREEN**

Run the Step 2 command again.

Expected: PASS with deterministic order and all closure negatives proven.

**Step 5: Commit the catalog slice**

```bash
git add src/lib/news/publication-mode.mjs src/lib/news/load-news.ts src/lib/news/types.ts tests/news-ui.test.ts
git commit -m "feat: project validated News catalogs by environment"
```

## Task 4: Filter events only after complete event validation

**Objective:** Keep event history valid in review mode while production exposes events only for public Editions.

**Files:**
- Modify: `scripts/news-contract/rolling-feed.mjs:19-103,259-310`
- Modify: `src/lib/news/load-news-events.ts:1-40`
- Modify: `src/pages/news/feed.xml.ts:1-17`
- Test: `tests/news-rolling-feed.test.mjs`

**Step 1: Write RED event-visibility tests**

Prove that:

- the complete review events are validated before any filter;
- production returns only events whose Edition is public;
- an invalid review-only event still fails a production build;
- timestamped Edition event URL/GUID uses full identity;
- review RSS keeps Preview title and all valid review events;
- production RSS has the normal title and contains neither the 2026-07-23 event nor its review-only text/URL.

**Step 2: Run rolling-feed tests and confirm RED**

```bash
npm run test:news -- --run tests/news-rolling-feed.test.mjs
```

Expected: FAIL because all events are exposed and feed mode is manually passed as `sample`.

**Step 3: Implement validated event projection**

- Validate all event files against the complete review catalog first.
- Derive visible events by membership in the already-projected catalog, never by trusting event text/status.
- Require a revision-1 event for every visible Edition and retain immutable sequence checks for every complete event stream.
- Replace `{ sample }` with an explicit publication mode or `review` boolean derived at the page/build boundary; normal production channel wording must not be caller-optional.
- Keep feed order `published_at` then deterministic event ID, and update the description from “daily Edition” to “Rolling Edition.”

**Step 4: Run rolling-feed tests and confirm GREEN**

Run the Step 2 command again.

Expected: PASS with stable review and production XML snapshots and private/review-only term scans.

**Step 5: Commit the event slice**

```bash
git add scripts/news-contract/rolling-feed.mjs src/lib/news/load-news-events.ts src/pages/news/feed.xml.ts tests/news-rolling-feed.test.mjs
git commit -m "feat: filter News events for public production"
```

## Task 5: Rename the dynamic route and make all links identity-based

**Objective:** Route each Edition by canonical `edition_id` everywhere while retaining date only as display metadata.

**Files:**
- Delete: `src/pages/news/[date].astro`
- Create: `src/pages/news/[editionId].astro`
- Modify: `src/lib/news/metadata.mjs:18-85`
- Modify: `src/components/news/NewsArchiveNav.astro:31-75`
- Modify: `src/components/news/NewsSignalCard.astro:54-73`
- Modify: `src/pages/news/index.astro:1-21`
- Modify: `src/pages/news/archive/index.astro:1-25`
- Modify: `src/pages/news/context/[slug].astro:1-35`
- Test: `tests/news-metadata.test.mjs`
- Test: `tests/news-ui.test.ts`

**Step 1: Write RED route/link/metadata tests**

Add a synthetic `2026-07-24-1530` Edition cloned from existing test data and assert static params, canonical, JSON-LD Edition URLs/anchors, archive links, Context backlinks, and Signal references all use `/news/2026-07-24-1530/`, while visible `<time>` still uses `2026-07-24`. Assert unknown ID has no fallback and loader query is absent from canonical construction.

**Step 2: Run metadata/UI tests and confirm RED**

```bash
npm run test:news -- --run tests/news-metadata.test.mjs tests/news-ui.test.ts
```

Expected: FAIL because links and metadata use `edition_date`, and the static route param is `date`.

**Step 3: Implement identity-based routes and links**

- Rename the Astro route and its `params` key to `editionId`.
- Generate only mode-visible static paths using `edition.edition_id`.
- Replace every Edition URL/anchor construction with `edition_id`; retain `edition_date` only in human-facing dates and `<time datetime>`.
- Pass one environment-derived mode consistently to catalog, event, route, and metadata calls within each page.
- Keep canonicals constant absolute path strings so `?through=` can never enter metadata.

**Step 4: Run metadata/UI tests and confirm GREEN**

Run the Step 2 command again.

Expected: PASS for both legacy and timestamped identities.

**Step 5: Commit the route slice**

```bash
git add src/pages/news/'[editionId].astro' src/pages/news/'[date].astro' src/lib/news/metadata.mjs src/components/news/NewsArchiveNav.astro src/components/news/NewsSignalCard.astro src/pages/news/index.astro src/pages/news/archive/index.astro src/pages/news/context/'[slug].astro' tests/news-metadata.test.mjs tests/news-ui.test.ts
git commit -m "refactor: route News editions by edition id"
```

## Task 6: Render environment-correct labels, robots, metadata, and sitemap

**Objective:** Make review and production HTML visibly and mechanically distinct without allowing a partial production switch.

**Files:**
- Modify: `astro.config.mjs:1-24`
- Modify: `src/layouts/NewsLayout.astro:5-48`
- Modify: `src/components/news/NewsEdition.astro:5-48`
- Modify: `src/pages/news/archive/index.astro:11-24`
- Modify: `src/pages/news/context/[slug].astro:26-34`
- Modify: `tests/news-metadata.test.mjs`
- Modify: `tests/news-vercel-config.test.mjs`
- Test: `tests/news.spec.ts`

**Step 1: Write RED review/production presentation tests**

Assert review HTML has Preview labels and `noindex, nofollow`; production has no Preview/no-production/sample phrases, shows `ROLLING EDITION`, uses public archive/index copy, and emits exactly one `index, follow`. Assert `astro.config.mjs` applies the same exact-`VERCEL_ENV` mode to sitemap filtering and excludes all review-only Edition/Context URLs in production.

**Step 2: Run presentation/config tests and confirm RED**

```bash
npm run test:news -- --run tests/news-metadata.test.mjs tests/news-vercel-config.test.mjs
```

Expected: FAIL because labels and robots are hard-coded review behavior and sitemap does not know publication visibility.

**Step 3: Implement mode-aware rendering**

- Add a required `mode` prop to News layout and label-bearing components/pages.
- Render robots, footer, hero label, archive title/description/warning, and RSS discovery title from that mode.
- Keep preview/local copy explicit and production copy calm: “ROLLING EDITION,” “AOIFUTURE News index,” and finite/source-first language without authorization warnings.
- In Astro sitemap configuration, compute mode from `process.env.VERCEL_ENV`, load or derive the allowed News route set, and filter review-only Edition/Context paths only in production. Do not remove non-News URLs.
- Ensure production sitemap includes `/news/`, each public Edition, public Context, and archive, but not feed XML if the sitemap integration already excludes endpoints.

**Step 4: Run presentation/config tests and confirm GREEN**

Run the Step 2 command again.

Expected: PASS in both mode matrices.

**Step 5: Commit the presentation slice**

```bash
git add astro.config.mjs src/layouts/NewsLayout.astro src/components/news/NewsEdition.astro src/pages/news/archive/index.astro src/pages/news/context/'[slug].astro' tests/news-metadata.test.mjs tests/news-vercel-config.test.mjs tests/news.spec.ts
git commit -m "feat: render News review and production modes"
```

## Task 7: Give every Edition fragment collision-free server IDs

**Objective:** Make multiple server-rendered Edition articles valid and accessible in one document before adding client behavior.

**Files:**
- Modify: `src/components/news/NewsEdition.astro:10-48`
- Modify: `src/components/news/NewsSignalCard.astro:4-81`
- Modify: `src/components/news/NewsActiveContext.astro:24-44` only if shared ID helpers require it
- Test: `tests/news.spec.ts`

**Step 1: Write RED DOM uniqueness tests**

Create a test harness or component rendering test with two Editions. Assert all `id` values are unique, every `aria-labelledby` target exists, Edition note/Signals headings include an Edition prefix, and every Signal anchor remains addressable from its canonical individual page.

**Step 2: Run the focused browser test and confirm RED**

```bash
npm run test:news:e2e -- --grep "Edition IDs"
```

Expected: FAIL because `edition-note-heading` and `signals-heading` repeat.

**Step 3: Prefix IDs in server markup**

- Derive a safe prefix from already-validated `edition_id`, for example `edition-${edition.edition_id}`.
- Prefix Edition heading, note, Signals section, Signal title/fact/note/caveat IDs and matching ARIA references.
- Preserve a stable Signal anchor contract by putting the canonical Signal ID on a dedicated anchor target or by updating all metadata/archive links to the prefixed ID. Choose one contract and test it; do not leave two elements with the same ID.
- Add `data-news-edition-heading` to the single Edition H1 so client code does not rely on heading text or broad selectors.

**Step 4: Run the focused browser test and confirm GREEN**

Run the Step 2 command again.

Expected: PASS with no duplicate IDs or broken references.

**Step 5: Commit the ID slice**

```bash
git add src/components/news/NewsEdition.astro src/components/news/NewsSignalCard.astro src/components/news/NewsActiveContext.astro tests/news.spec.ts
git commit -m "fix: scope News edition fragment ids"
```

## Task 8: Add the server-first previous Edition control

**Objective:** Provide a finite, accessible previous-Edition link that works without JavaScript and exposes enough server metadata for progressive enhancement.

**Files:**
- Create: `src/components/news/NewsEditionHistoryLoader.astro`
- Modify: `src/pages/news/index.astro:9-21`
- Modify: `src/pages/news/[editionId].astro`
- Modify: `src/styles/news.css`
- Test: `tests/news.spec.ts`

**Step 1: Write RED no-JavaScript and finite-chain tests**

In review mode assert `/news/` links from `2026-07-24` to `2026-07-23`; in production assert no previous loader is present because the only older Edition is review-only, or an Archive link is shown. Assert the individual public/review routes expose their own next-older visible link where one exists, terminal Edition has no dead loader, the target is a normal same-origin `href`, and no scroll/observer auto-load mechanism exists.

**Step 2: Run the focused E2E tests and confirm RED**

```bash
npm run test:news:e2e -- --grep "previous Edition|JavaScript disabled"
```

Expected: FAIL because no previous-Edition control exists.

**Step 3: Render the link from catalog order**

- Add a small server component with a persistent container, status node (`aria-live="polite"`, `aria-atomic="true"`), and ordinary anchor labeled `前のEditionを読む`.
- Compute the immediate next item from the already sorted visible catalog; never compare dates or parse URLs in the component.
- Render data attributes for current and target Edition IDs plus the link URL; do not serialize the catalog or content into client HTML.
- Place the component after the Edition article on latest and individual pages. On the terminal Edition, omit it or link to `/news/archive/` with distinct Archive text.
- Style it as a 44px minimum control with existing News focus rules and no glass-on-glass.

**Step 4: Run the focused E2E tests and confirm GREEN**

Run the Step 2 command again with JavaScript enabled and disabled projects/contexts.

Expected: PASS; JS-off follows the individual Edition route and no control can load more than its one linked target.

**Step 5: Commit the server-control slice**

```bash
git add src/components/news/NewsEditionHistoryLoader.astro src/pages/news/index.astro src/pages/news/'[editionId].astro' src/styles/news.css tests/news.spec.ts
git commit -m "feat: add server-first previous News edition link"
```

## Task 9: Progressively append exactly one server-rendered Edition

**Objective:** Enhance the ordinary link with guarded same-origin fetch, exact article extraction, heading demotion, accessible announcement, and robust fallback.

**Files:**
- Create: `src/scripts/news-edition-history.ts`
- Modify: `src/components/news/NewsEditionHistoryLoader.astro`
- Modify: `src/styles/news.css`
- Test: `tests/news.spec.ts`

**Step 1: Write RED interaction/security/failure tests**

Intercept requests and assert one click causes exactly one GET to the immediate previous individual URL and appends exactly one new `[data-news-edition]`. Verify the appended article's serialized subtree matches the fetched server article except for the deliberate H1→H2 replacement and runtime focus attribute, IDs remain unique, the new H2 receives focus, and status is announced. Add negative cases for cross-origin href, non-2xx response, missing/multiple article nodes, mismatched `data-news-edition`, malformed HTML, and aborted fetch; each must append nothing, report an accessible failure, re-enable the control, and preserve a usable fallback link.

**Step 2: Run interaction tests and confirm RED**

```bash
npm run test:news:e2e -- --grep "appends one Edition|fetch failure|same-origin"
```

Expected: FAIL because the link still navigates normally.

**Step 3: Implement the minimal enhancement**

- Attach one click handler to the explicit loader; do not use scroll, `IntersectionObserver`, timer, or idle callbacks.
- Validate `new URL(anchor.href, location.href).origin === location.origin` before preventing navigation. If invalid, leave normal navigation behavior.
- Disable repeat activation only while the request is pending.
- Fetch with same-origin credentials and an HTML `Accept` header; require `response.ok` and HTML content.
- Parse with `DOMParser`, require exactly one matching Edition article, require the expected target ID, import/clone that node, replace exactly one `[data-news-edition-heading]` H1 with H2 while copying attributes and child nodes, then append it to a dedicated history container.
- Read the fetched document's server-rendered next-older link to update the persistent loader. Never execute fetched scripts or assign fetched HTML to the whole document.
- Announce the appended Edition and focus its H2 with temporary/programmatic `tabindex="-1"`.
- On failure, do not mutate the article list or href; show a concise error and leave the ordinary link enabled.

**Step 4: Run interaction tests and confirm GREEN**

Run the Step 2 command again.

Expected: PASS, including byte/subtree equivalence normalization and all failure fallbacks.

**Step 5: Commit the progressive enhancement slice**

```bash
git add src/scripts/news-edition-history.ts src/components/news/NewsEditionHistoryLoader.astro src/styles/news.css tests/news.spec.ts
git commit -m "feat: progressively append previous News editions"
```

## Task 10: Restore Edition history through URL and browser navigation

**Objective:** Make the finite appended chain reloadable and reversible with `?through=<edition_id>` while keeping canonical identity clean.

**Files:**
- Modify: `src/scripts/news-edition-history.ts`
- Modify: `src/components/news/NewsEditionHistoryLoader.astro`
- Test: `tests/news.spec.ts`

**Step 1: Write RED History API tests**

Cover:

1. One click changes `/news/` to `/news/?through=2026-07-23` using `pushState` only after append succeeds.
2. A second click in a three-Edition synthetic chain appends one more Edition and advances `through` once.
3. Browser Back removes Editions newer than the desired displayed boundary and restores the correct next link without a document navigation.
4. Forward restores the chain.
5. Reload with a valid reachable `through` sequentially restores the exact chain and final focus/announcement state without adding a history entry per internal fetch.
6. Unknown, malformed, hidden-in-production, or non-reachable `through` fails closed to the current finite page and usable server link; canonical remains query-free.
7. A restoration fetch failure leaves the successfully restored prefix and a working fallback link for the next Edition.

**Step 2: Run history tests and confirm RED**

```bash
npm run test:news:e2e -- --grep "through history|Back|reload restoration"
```

Expected: FAIL because appended state is not represented in the URL.

**Step 3: Implement URL-driven reconciliation**

- Treat the server current Edition as chain index zero and maintain ordered loaded article IDs/URLs.
- After a user append succeeds, call `history.pushState` with only the resulting `through` query; preserve unrelated query keys if any, but canonical output remains unchanged.
- On `popstate`, reconcile to the URL: truncate already-loaded suffixes when moving newer; sequentially follow only server-provided immediate-previous links when moving older.
- On initial load, parse `through` with the same Edition ID grammar and restore by following the finite server chain. Never construct an Edition URL directly from arbitrary query text.
- Bound restoration by encountered unique IDs and stop on cycle, duplicate, missing link, mismatch, or failure.
- Use `replaceState` only to remove an invalid/unreachable `through`; never rewrite canonical link metadata.

**Step 4: Run history tests and confirm GREEN**

Run the Step 2 command again.

Expected: PASS for click, Back, Forward, reload, invalid target, and partial failure.

**Step 5: Commit the history slice**

```bash
git add src/scripts/news-edition-history.ts src/components/news/NewsEditionHistoryLoader.astro tests/news.spec.ts
git commit -m "feat: restore News edition history from URL"
```

## Task 11: Make build verification mode-aware and privacy-complete

**Objective:** Prove generated review and production artifacts have exact route, feed, metadata, sitemap, and source-closure boundaries.

**Files:**
- Modify: `scripts/verify-news-build.mjs:1-112`
- Modify: `package.json:5-20`
- Modify: `tests/news-vercel-config.test.mjs`
- Test: `tests/news.spec.ts`

**Step 1: Write RED verifier tests/fixtures**

Refactor the verifier enough to test a supplied build root and explicit expected mode. Add negatives for a review-only route copied into production, review-only text/URL/event in production HTML/RSS/sitemap, missing public route, wrong robots, Preview label in production, public route omitted from sitemap, duplicate canonical, canonical containing `through`, and invalid full graph hidden behind production filtering.

**Step 2: Run verifier tests and confirm RED**

```bash
npm run test:news -- --run tests/news-vercel-config.test.mjs
```

Expected: FAIL because verification has six hard-coded review routes and one sample feed expectation.

**Step 3: Implement deterministic dual-mode verification**

- Discover canonical content files rather than hard-coding dates, but derive expected route sets only after complete validation.
- Require an explicit verifier mode argument (`review` or `production`) and compare it to the resolved `VERCEL_ENV`; mismatch exits nonzero.
- Review checks: all valid routes exist, Preview/noindex labels exist, review RSS includes all reviewed events.
- Production checks: only public routes exist, review-only routes are absent, robots are `index, follow`, normal labels/title exist, and public RSS/sitemap match exact expected sets.
- Scan every generated News HTML/XML/sitemap artifact for review-only Edition/Context titles, slugs, IDs, source URLs, source titles, event titles/summaries, and known private terms. Do not rely only on the literal phrase “review-only.”
- Retain canonical/JSON-LD/social metadata, direct source, self-hosted font/license, no external font, content type, deterministic feed, and artifact count checks.
- Add scripts such as `verify:news-build:review` and `verify:news-build:production` that pass explicit modes; keep the generic command only if it fails without an explicit mode.

**Step 4: Run verifier tests and confirm GREEN**

Run the Step 2 command again.

Expected: PASS for clean fixtures and nonzero exits for every injected leak/mismatch.

**Step 5: Commit the verifier slice**

```bash
git add scripts/verify-news-build.mjs package.json package-lock.json tests/news-vercel-config.test.mjs tests/news.spec.ts
git commit -m "test: verify News review and production artifacts"
```

## Task 12: Run complete local review and production gates

**Objective:** Produce repeatable evidence that both build modes pass and differ only at the intended visibility/presentation boundary.

**Files:**
- Modify only if a test exposes a defect in task-owned News files.
- Evidence is command output and commit SHA; do not add generated `dist/`, Playwright reports, or screenshots to git.

**Step 1: Verify source state and complete unit/contract suite**

```bash
git status --short --branch
npm run test:news
npm run validate:news-contract
```

Expected: clean tracked state before tests; all News unit/contract tests and contract CLI pass.

**Step 2: Verify review build**

```bash
rm -rf dist
VERCEL_ENV=preview npm run build
VERCEL_ENV=preview npm run verify:news-build:review
VERCEL_ENV=preview npm run test:news:e2e
```

Expected: complete review graph/routes, Preview labels, noindex, review feed, history and accessibility tests all pass.

**Step 3: Verify production build**

```bash
rm -rf dist
VERCEL_ENV=production npm run build
VERCEL_ENV=production npm run verify:news-build:production
VERCEL_ENV=production npm run test:news:e2e
```

Expected: full graph validates; only public closure/routes/events/feed/sitemap remain; production labels and robots pass; 2026-07-23 and agent-authority artifacts/text/URLs are absent.

**Step 4: Run the repository-wide relevant check**

```bash
npm run build
```

Expected: default local review build exits 0 and existing non-News routes still build.

**Step 5: Inspect residue and exact diff**

```bash
git status --short
git diff --check
git diff origin/main...HEAD -- schemas scripts/news-contract src/lib/news src/components/news src/layouts/NewsLayout.astro src/pages/news src/styles/news.css tests package.json package-lock.json astro.config.mjs
```

Expected: no `dist/`, test report, temporary server, or unrelated file is staged; diff contains only scoped implementation and tests.

**Step 6: Create the immutable Engineer candidate**

```bash
git add <exact task-owned paths reported by git status>
git diff --cached --check
git diff --cached --stat
git commit -m "feat: prepare News rolling production edition"
git rev-parse HEAD^{commit}
git status --short --branch
```

Expected: one exact candidate SHA and clean worktree. Do not push, deploy, alias, or change production.

## Task 13: Independent Debug and Reviewer gates

**Objective:** Require independent functional and code/privacy approval at the exact Engineer SHA before any external action.

**Files:**
- No source changes unless a gate returns FAIL to Engineer.

**Step 1: Debug Gate**

Debugger checks out the exact SHA and independently reruns:

- legacy and timestamped Edition ID positive/negative tests;
- duplicate ID/route and date-prefix failures;
- full-graph-before-filter and public-closure failures;
- dual builds and exact route/feed/sitemap privacy scans;
- click-one-only, no-scroll-autoload, JS-off navigation, same-origin guard, fetch/parse failure fallback;
- unique IDs/ARIA targets, heading demotion, live announcement, focus;
- `through` click/Back/Forward/reload/invalid/partial-failure scenarios;
- responsive overflow at 390/768/1024/1280/1440/1728 and 44px controls.

Expected handoff: `PASS`, `FAIL`, or `BLOCKED` with exact SHA, commands, exit codes, artifacts inspected, and unresolved environment assumptions. FAIL returns to Engineer and stops the chain.

**Step 2: Reviewer Gate**

After Debug PASS, Reviewer inspects exact-SHA requirements, maintainability, source/privacy closure, HTML trust boundary, accessibility, metadata semantics, no accidental production override, and the complete diff. Reviewer does not infer functional correctness from code appearance; it cites Debug evidence.

Expected handoff: PASS or REVISE at the exact SHA. REVISE returns to Engineer and invalidates prior downstream approvals after a new commit.

## Task 14: Preview rollout rehearsal and production authorization gate

**Objective:** Exercise the Vercel Preview path first and make production an explicit, reversible Ops action rather than a build-side effect.

**Files:**
- No source changes.
- Do not execute this task until Engineer, Debugger, and Reviewer have passed the same immutable SHA and the owner authorizes external Preview actions.

**Step 1: Deploy exact SHA to Vercel Preview only**

From a clean exact-SHA worktree, confirm Vercel project identity, run the production-mode local gate once more, then create a Preview deployment without `--prod`. Capture deployment ID/URL and build logs. A Preview deployment still receives `VERCEL_ENV=preview`, so it must display the complete review graph and remain noindex.

**Step 2: Authenticated Preview readback**

Verify exact generated HTML/XML/assets against local review artifacts, including both Edition and Context classes, feed, sitemap, canonical exclusion of `through`, JS interaction/history/failure/accessibility, responsive overflow, unknown route 404s, and no private receipt/source-body terms. Confirm `aoifuture.com` production alias/deployment is unchanged.

**Step 3: Record the production decision packet**

Include exact candidate SHA/tree, Preview deployment ID/URL, gate approvals, dual-build command results, public route/event/feed/sitemap manifest, excluded review-only manifest, known Node version warning, proposed production command, rollback deployment ID, and owner approval field. Production remains blocked until the owner explicitly approves this packet.

## Task 15: Production cutover and rollback procedure

**Objective:** Publish only after explicit owner approval, verify the live public boundary, and retain an immediate known-good rollback.

**Files:**
- No source changes.
- This is an Ops live gate, not part of Engineer implementation.

**Step 1: Reconfirm immutable authorization**

Verify clean worktree at the approved SHA/tree, all gate records name that SHA, Vercel target/project are unchanged, `VERCEL_ENV=production` exists in the target environment, and the previously known-good production deployment ID is recorded. Abort on any mismatch.

**Step 2: Create production deployment**

Use the repository's established Vercel production command only after explicit approval. Do not change DNS, environment variables, project linkage, scheduler, or unrelated aliases in the same action. Capture deployment ID, logs, and alias result.

**Step 3: Live production readback**

Fetch and browser-test:

- `/news/`, `/news/2026-07-24/`, connected AI Context, archive, feed, sitemap;
- 404 for `/news/2026-07-23/` and `/news/context/agent-authority/`;
- no review-only content/event/source URL in any News HTML/XML;
- `index, follow`, normal RSS title, singular query-free canonicals;
- direct official sources and Context closure;
- previous-Edition behavior appropriate to the one visible Edition (no dead loader; Archive fallback allowed);
- responsive/accessibility and no asset/console/network failures.

Compare live bodies/hashes with the approved local production build where Vercel serialization permits exact comparison.

**Step 4: Roll back on any failed acceptance check**

Immediately restore/promote the recorded prior known-good production deployment using the established Vercel rollback/promote mechanism. Re-read the public alias and critical non-News routes after rollback. Do not attempt an unreviewed hotfix in production; open a new Engineer task with the failing evidence.

**Step 5: Close the live gate**

Record PASS only with deployment ID, exact SHA/tree, alias, all live checks, production-isolation checks, and rollback readiness. Record FAIL/BLOCKED with rollback result and unresolved issue; never call a successful deployment alone a successful release.

## Final acceptance checklist

- [ ] Legacy and `-HHMM` Edition IDs validate; date prefix equality is enforced.
- [ ] Duplicate Edition IDs and canonical route paths fail closed.
- [ ] Catalog ordering is `published_at` descending, then `edition_id` descending.
- [ ] All Editions and Contexts have explicit required status with the four requested assignments.
- [ ] Production mode is exact `VERCEL_ENV=production`; all other values are review/noindex.
- [ ] Complete graph/events validate before filtering; public subgraph validates closure after filtering.
- [ ] Review builds include both statuses; production routes/events/RSS/sitemap contain only public closure.
- [ ] Every Edition URL, event URL, metadata anchor, archive link, Context backlink, importer filename, and verifier expectation uses `edition_id`.
- [ ] Review and production labels, robots, archive wording, and RSS titles are correct.
- [ ] Latest page initially contains one finite Edition and an ordinary previous link only when an older visible Edition exists.
- [ ] One click fetches and appends exactly one same-origin server article; no automatic infinite loading exists.
- [ ] Appended H1 becomes H2; IDs/ARIA references are unique; live announcement and focus work.
- [ ] JS-off navigation, fetch failure fallback, malformed/cross-origin rejection, and terminal Archive behavior work.
- [ ] `?through=` survives reload and Back/Forward; invalid/hidden targets fail closed; canonical excludes query.
- [ ] Dual unit, build, verifier, E2E, privacy/source closure, sitemap, RSS, responsive, and accessibility checks pass.
- [ ] Engineer, Debugger, and Reviewer approve one exact immutable SHA before Ops Preview/live actions.
- [ ] Production requires explicit owner authorization and has a recorded known-good rollback deployment.
