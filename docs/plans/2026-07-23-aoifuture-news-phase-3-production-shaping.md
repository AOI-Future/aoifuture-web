# AOIFUTURE News Phase 3 Production-Shaping Plan

> Execute in the gate order Engineer → Debug → Writer → Reviewer. This phase produces local evidence and a decision brief only. No push, merge, Preview, deploy, indexable production route, feed publication, or production mutation is authorized.

**Base candidate:** `b8e77f182acc3a9f48ca1110dc161a6868590c4f`

## Fixed owner decisions

- News web fonts are self-hosted. No Google Fonts or other runtime font-host request is allowed.
- Canonical host is `https://aoifuture.com` without `www`.
- Detour is not governed by a speculative rigid threshold. Evaluate multiple production-shaped compositions and judge the whole Edition. If a separate Detour block does not improve the reading balance, preserve all information in ordinary Edition content instead of hiding or dropping it.

## Task 1 — Self-host News fonts

1. Inventory exactly which News weights/styles are rendered: Noto Sans JP 400/500/700 and JetBrains Mono 500/600.
2. Choose a licensed, reproducible local delivery method after measuring repository/build size and generated font requests. Prefer WOFF2, `font-display: swap`, and the smallest practical subset strategy that still renders Japanese correctly. Include required license notices.
3. Remove NewsLayout Google Fonts stylesheet and preconnects.
4. Keep this change scoped to News; do not silently refactor unrelated site layouts that still use their own font policy.
5. Add tests/readback proving generated News HTML has no `fonts.googleapis.com`, `fonts.gstatic.com`, or other external font URL and that browser font requests are same-origin only.
6. Verify fallback behavior and no layout overflow before/after the font change.

## Task 2 — Confirm no-www canonical

1. Keep Astro `site` and every News canonical at `https://aoifuture.com`.
2. Add a generated-output/browser assertion that all four News routes have exactly one canonical, use HTTPS, contain no `www`, and preserve trailing slashes.
3. Do not add redirects or mutate DNS/Vercel in this phase.

## Task 3 — Production-shaped density evidence

Create a deterministic local-only visual harness. It may duplicate the two already validated public sample Signal cards for layout simulation, but must label the output as layout evidence, never as additional reporting or publishable content. Do not invent sources, facts, URLs, or claims.

Generate and inspect:

- 6 Signal cards at 1440px and 390px
- 9 Signal cards at 1440px and 390px
- 12 Signal cards at 1440px and 390px

For each composition record:

- page height and viewport multiples;
- horizontal overflow and exact offender if any;
- first and final direct-source action positions;
- heading/navigation readability;
- repeated visual rhythm and fatigue points;
- whether the Edition note and footer remain findable;
- whether 6–12 items can remain a single finite Edition without pagination or collapse.

Store screenshots as temporary artifacts outside Git. Commit only the reproducible harness, measurements, hashes/paths, and concise evidence report.

## Task 4 — Detour composition samples

Using the same local-only harness and neutral layout-only copy, compare at least:

1. no Detour;
2. one compact Detour inserted after the third Signal;
3. one full-width Detour inserted after the fourth or fifth Signal;
4. if useful, one deliberately overused Detour sample to expose the failure mode.

Render desktop and 390px mobile views. Do not add Detour to the production schema or live News routes in this phase.

Evaluate the whole Edition rather than a single block:

- Does the Detour create orientation or merely interrupt source reading?
- Is its information genuinely distinct from Source fact, AOI note, Caveat, Edition note, and Active Context?
- Does it preserve finite scanability at 6, 9, and 12 Signals?
- Does it remain clear without JavaScript and at mobile width?
- If not, recommend placing the full information in ordinary Edition content rather than omitting it.

## Task 5 — Production metadata/feed decision brief

After Debug evidence, Writer produces a concise Japanese decision brief with clear pickable options and one recommended default. It must separate metadata mode from feed granularity.

Metadata options must cover:

- minimal webpage metadata;
- editorial digest/collection metadata;
- full news-publisher metadata and its operational obligations.

Feed options must cover:

- one RSS item per Edition;
- one item per Signal;
- combined Edition + Active Context activity feed;
- no feed yet.

For each option state reader experience, search/discovery impact, correction behavior, privacy/copyright exposure, operational cost, and what must be implemented. Do not implement or publish the selected metadata/feed policy before owner choice.

## Required checks

- `npm run test:news`
- `npm run validate:news-contract`
- `npm run build`
- `npm run test:news:e2e`
- focused same-origin font/canonical tests
- density and Detour harness at 1440px and 390px
- generated HTML privacy scan
- exact changed-path and secret/license review
- clean worktree, no test residue, no listener process

## Gate boundary

Engineer may commit a local immutable candidate. Debug is read-only. Writer may add only the decision/evidence document after Debug PASS. Reviewer inspects code, screenshots, measurements, Japanese decision clarity, and recommendation quality. No Ops action is authorized in Phase 3.
