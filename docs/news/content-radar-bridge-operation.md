# Content Radar → AOIFUTURE News bridge operation

Status: review-only bridge contract. This document does not authorize a schedule, promotion, deployment, publication, or feed update.

## Two clocks, two authorities

Collection and publication are deliberately separate.

1. **Collection/proposal clock — every two hours.** Content Radar may collect and propose local candidates on its own schedule. Its packet is advisory, local-only input; it has no authority to alter `src/content/news`, the generated site, RSS, or a deployment.
2. **Publication clock — human-reviewed, unscheduled.** A publication decision happens only after a human has reviewed an explicit `review-only` candidate and a later, separately approved promotion task has created a public Edition/event. A collection run, candidate preparation run, or timer never constitutes promotion.

Private packet, source-read receipt, and editorial-decision inputs remain outside the repository's tracked public content and outside generated public artifacts. Do not copy gate-specific fields, source bodies, paths, reviewer identity, approvals, or reasons into a review candidate, Edition, Context, RSS item, HTML, sitemap, build log, or commit message; only the review candidate's explicit public-field allowlist may cross the boundary.

## Review candidate inspection

The bridge accepts explicit local paths and writes one deterministic, inspectable file only to the specified local output directory:

```sh
REVIEW_DIR="$(mktemp -d "${TMPDIR:-/tmp}/aoi-news-review.XXXXXX")"
node scripts/news-bridge/prepare-review-candidate.mjs \
  --packet /approved/private/packet.json \
  --receipts /approved/private/receipts.json \
  --decisions /approved/private/decisions.json \
  --output-dir "$REVIEW_DIR"
node -e "const f=process.argv[1]; const c=require('node:fs').readFileSync(f, 'utf8'); console.log(c)" "$REVIEW_DIR/review-candidate.json"
```

The output must retain `publication_status: "review-only"` at both wrapper and Edition levels. Inspect it in that local directory; do not place it beneath `src/content/news` or copy it into a production manifest. The bridge has no promotion command and never writes public content.

For the checked-in contract fixture, run:

```sh
npm run test:news-bridge
```

This performs an equivalent temporary-output inspection and proves that preparation creates only `review-candidate.json`, retains review-only status, and has no promotion side effect.

## Promotion boundary

Promotion is a future, separately reviewed operation. It must:

- begin from the explicitly inspected review candidate, not from a raw collection packet;
- apply the existing public catalog/revision validation and public-field allowlist;
- use a distinct human approval for the public Edition/event change;
- stage and review only the intended public content files; and
- run review and production build verification before any deployment decision.

Neither a successful bridge test nor a successfully generated review candidate is publication approval.

## Correction, unavailable source, withdrawal, and rollback

- **Correction:** retain the stable Signal identity and record a public `corrected` change with `corrected_at` and a visible `correction_note`. Do not use private decision history or source text as the public explanation.
- **Source unavailable:** the last validated public Signal may remain only with its public availability state and a visible caveat. Unavailability does not authorize copying source text or treating a collection result as confirmation.
- **Withdrawal:** move through the public withdrawal/revision contract. A withdrawn Signal cannot remain a `lead` or `major` item and cannot remain current Context support.
- **Rollback:** stop the publication path and restore the last known valid reviewed public catalog/build. Rollback is a public-content/deployment operation, not a bridge rerun; keep private input artifacts local and do not commit them as rollback evidence.

## Privacy verifier and build gates

`npm run verify:news-build:review` and `npm run verify:news-build:production` fail if either tracked `src/content/news` or generated `dist/client/news` contains private receipt or decision fields, local paths, raw-source-text fields, or Content Radar bridge artifacts. The verifier is intentionally narrow to the public News surface, so unrelated application terms do not create false privacy failures.

Required Engineer checks for bridge work:

```sh
npm run test:news-bridge
npm run test:news
npm run build
npm run verify:news-build:review
VERCEL_ENV=production npm run verify:news-build:production
git diff --check
```

These checks are evidence for the independent Debug gate only. They do not schedule collection, promote a candidate, publish a feed, deploy, or change current public content.
