# AOIFUTURE News Phase 2 Static Prototype Implementation Plan

> **For Hermes:** Execute with the subagent-driven-development workflow and the gate order Engineer → Debug → Reviewer. No Ops/deploy gate is authorized in this phase.

**Goal:** Build a local, prerendered AOIFUTURE News prototype that renders the validated public Edition and Active Context manifests as a finite, source-first reading surface with retrospective navigation.

**Architecture:** The Phase 1 importer stages only public Edition and Context JSON into repository-owned content paths. Astro server mode remains unchanged, while every News route explicitly prerenders. Server-side loaders read only staged public manifests and validate the expected public shape; Vercel never reads DailyNews, Obsidian, iCloud, receipts, previous Contexts, or import wrappers. Astro components and an isolated feature stylesheet produce the reading surface without a React island. JavaScript may enhance filtering, but all Signals, Context history, and source links remain readable when JavaScript is disabled.

**Tech stack:** Astro 6, TypeScript, plain Astro components, isolated CSS, Vitest, Playwright, existing Phase 1 Node validator/importer.

**Candidate base:** `bde95bdbc36da04fac4f54e7d2693b94857e4858`

**Prototype boundary:** The 2026-07-23 data is explicitly non-production sample content. Do not push, merge, deploy, publish, or change production services.

---

## Task 1: Stage and load public-only News content

**Files:**
- Create: `src/content/news/editions/2026-07-23.json`
- Create: `src/content/news/contexts/agent-authority.json`
- Create: `src/lib/news/types.ts`
- Create: `src/lib/news/load-news.ts`
- Create/modify: focused loader tests under `tests/`

**Steps:**
1. Add failing tests for deterministic loading, date/slug lookup, stable ordering, unresolved Context/Signal references, private-key rejection, and no access to the private import wrapper.
2. Run the Phase 1 importer into a temporary directory, verify it writes exactly one Edition and one Context, and copy only those validated public bytes into `src/content/news/`.
3. Implement a read-only loader with no network, iCloud, DailyNews, receipt, or runtime importer dependency.
4. Verify missing date/slug returns no data and never falls back to the latest item silently.

## Task 2: Build the Edition reading surface

**Files:**
- Create: `src/layouts/NewsLayout.astro`
- Create: `src/components/news/NewsDeskHeader.astro`
- Create: `src/components/news/NewsEdition.astro`
- Create: `src/components/news/NewsSignalCard.astro`
- Create: `src/components/news/NewsDetour.astro` only if the data contains a Detour; do not fabricate one
- Create: `src/styles/news.css`
- Create: `src/pages/news/index.astro`
- Create: `src/pages/news/[date].astro`

**Steps:**
1. Write failing render/browser assertions for `/news/` and `/news/2026-07-23/`.
2. Explicitly set `export const prerender = true`; enumerate dated paths with `getStaticPaths`.
3. Render a finite Edition with one lead, remaining Signals, edition note, publisher/source kind, source fact, AOI note, caveat, observed/published time, and direct source CTA.
4. Show a prominent `NON-PRODUCTION SAMPLE` label from the data. Do not hide it in metadata.
5. Keep the reading surface flat black and text-led. Use cyan for focus, source structure, and selected controls. Use Liquid Glass only for floating controls if any. Do not use newspaper ornament, generic imagery, glitch, typewriter, glass body cards, ranking scores, infinite scroll, or a masonry order that differs from DOM order.
6. Use Noto Sans JP for Japanese body and JetBrains Mono for source kind, timestamps, and controls. Preserve 14px Japanese body minimum, 12px chrome minimum, 44px targets, 4.5:1 contrast, reduced-motion/transparency behavior, and no horizontal overflow.
7. The source link is the primary CTA. Source fact, AOI note, and Caveat must have explicit text labels and separate semantics.

## Task 3: Build Active Context and retrospective navigation

**Files:**
- Create: `src/components/news/NewsActiveContext.astro`
- Create: `src/components/news/NewsContextHistory.astro`
- Create: `src/components/news/NewsArchiveNav.astro`
- Create: `src/pages/news/context/[slug].astro`
- Create: `src/pages/news/archive/index.astro`

**Steps:**
1. Write failing assertions for current view before chronology, `How we got here`, revision reasons, revision evidence links, operator Context fields, and archive links.
2. Prerender Context and archive routes from the staged public index.
3. Render current view first, then revisions oldest-to-newest without rewriting or hiding prior interpretations.
4. Make revision evidence IDs link back to the dated Edition anchor for the corresponding Signal.
5. Provide retrospective entry points by Edition, Context, topic, and source using the sample data actually present. Do not claim full-site search or a complete historical archive.
6. A withdrawn or unavailable Signal remains labeled historical evidence; do not present it as current support.

## Task 4: Integrate navigation and progressive enhancement

**Files:**
- Modify: `src/components/Navigator.tsx`
- Modify/create: News scripts only if enhancement is justified
- Modify/create: focused tests

**Steps:**
1. Add a clear `NEWS` entry that navigates to `/news/`; keep existing overlay deep links intact.
2. If topic filtering is included, start with every Signal visible in the HTML and make the control an optional enhancement. Announce result count through an accessible live region. Do not require JavaScript for reading or source navigation.
3. Add skip link, `main`, `nav`, named sections, heading hierarchy, focus-visible states, and native disclosure semantics where used.
4. Do not add custom analytics, density controls, Latest Delta, recommendation, voting, comments, or reader profiles in Phase 2.

## Task 5: Verify the local artifact

**Files:**
- Create: `tests/news-ui.test.*` for loader/content invariants
- Create: `tests/news.spec.ts` for browser behavior
- Modify: `package.json` scripts only as needed
- Create: `docs/news/phase-2-verification.md`

**Required evidence:**
1. Phase 1 contract tests and fixture validation still pass.
2. Focused News loader/render tests pass.
3. `npm run build` passes and build output contains `/news/index.html`, `/news/2026-07-23/index.html`, `/news/context/agent-authority/index.html`, and `/news/archive/index.html` plus sitemap entries.
4. Start the built/local site on a verified project-specific port; confirm the title/heading fingerprint before browser assertions.
5. Playwright checks desktop and mobile viewports, JavaScript-disabled source/readback, keyboard access, visible focus, no horizontal overflow (`scrollWidth <= clientWidth`), direct source URLs, missing date/slug 404 behavior, and current-view-before-history order.
6. Capture desktop and mobile screenshots for review. Screenshots are evidence only and are not committed unless explicitly needed.
7. Run console/page-error checks and verify no private fixture keys or local paths appear in generated HTML.
8. Inspect exact changed paths, `git diff --check`, focused/broad test results, and a clean post-commit worktree.

## Acceptance gate

- Engineer creates one immutable local candidate commit.
- Debug independently runs functional, no-JS, responsive overflow, negative route, privacy, and build-output checks against that exact commit.
- Reviewer separately evaluates product meaning, visual hierarchy, AI-Slop resistance, accessibility, source-first behavior, scope, and evidence.
- A Reviewer PASS authorizes only the next planning checkpoint. It does not authorize push, merge, Preview, production deploy, analytics changes, or public publication.
