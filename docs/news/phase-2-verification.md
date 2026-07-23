# AOIFUTURE News Phase 2 Verification

## Candidate scope

- Branch: `feature/aoifuture-news-static-prototype`
- Base: `bde95bdbc36da04fac4f54e7d2693b94857e4858`
- Plan: `5316956`
- Data status: explicitly non-production sample
- External actions: no push, merge, Preview, deploy, publication, source fetch, or production mutation

## Implemented artifact

The prototype stages only the validated public Edition and Active Context manifests. It prerenders:

- `/news/`
- `/news/2026-07-23/`
- `/news/context/agent-authority/`
- `/news/archive/`

The page remains readable without JavaScript. Direct primary-source links are the main actions. Source fact, AOI note, and Caveat are separate labeled regions. The Active Context presents the current view before the public revision history.

## Canonical verification

Executed after the final implementation edits:

```text
npm run test:news
PASS — 64/64 tests

npm run validate:news-contract
PASS — { "ok": true, "errors": [] }

npm run build
PASS — all four News routes prerendered; sitemap generated

npm run test:news:e2e
PASS — 10/10 browser tests
```

Browser coverage includes the finite Edition, direct source links, current-view-before-history ordering, evidence links, bounded archive, JavaScript-disabled reading, four-route mobile/desktop overflow checks, skip-link and keyboard focus, unknown date/Context 404 responses, Navigator NEWS route, and preservation of existing hash-overlay behavior.

`git diff --check` passed. Generated News HTML contained no private wrapper keys, source-read receipts, previous Contexts, local paths, raw bodies, credentials, internal scores, prompts, or hidden reasoning. Sitemap readback included the News routes.

## Navigator failure diagnosis

The initial browser run found no `/#nictia` dialog. Investigation showed a local Vite development hydration failure affecting all React islands, not a News navigation regression. Astro referenced the React renderer at runtime, so Vite had not pre-optimized `react-dom/client` for the dev path. The production bundle was unaffected.

The candidate adds `react-dom/client` to `vite.optimizeDeps.include` and gives News a dedicated Playwright configuration on a project-specific port with `/news/` as the readiness URL. After that change, the complete browser suite passed, including the existing hash overlay and Escape close behavior.

## Visual readback

Desktop and 390px mobile views were inspected from the local candidate.

- The reading surface is flat black and text-led.
- Cyan is limited to structure, labels, focus, and direct-source navigation.
- No body-level glass, newspaper ornament, generic imagery, glitch/typewriter treatment, ranking score, infinite scroll, Latest Delta, recommendation, voting, comments, reader profile, density control, or custom analytics appears.
- Japanese headings and body wrap without clipping or horizontal overflow.
- Source fact, AOI note, and Caveat remain visually separate on desktop and mobile.
- The non-production state is prominent.

The two-item sample naturally leaves more vertical space than a normal 6–12 item Edition. This is acceptable for the contract prototype and is not treated as proof of final production density.

## Remaining boundaries

- The canonical `www` versus non-`www` host decision remains open; the prototype follows the repository's current non-`www` configuration.
- News uses a dedicated prototype layout with `noindex, nofollow`. Production metadata, feed policy, and analytics are later launch decisions.
- The `vite.optimizeDeps` change is site-wide development infrastructure. Debug and Reviewer must inspect it separately from the News UI.
- This evidence authorizes only independent Debug and Reviewer gates. It does not authorize rollout.
