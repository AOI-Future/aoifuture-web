# Content Radar → AOIFUTURE News bridge operation

Status: review-only bridge contract. This document does not authorize a schedule, promotion, deployment, publication, or feed update.

## Two clocks, two authorities

Collection and publication are deliberately separate.

1. **Collection/proposal clock — every two hours.** Content Radar may collect and propose local candidates on its own schedule. Its packet is advisory, local-only input; it has no authority to alter `src/content/news`, the generated site, RSS, or a deployment.
2. **Publication clock — human-reviewed, unscheduled.** A publication decision happens only after a human has reviewed an explicit `review-only` candidate and a later, separately approved promotion task has created a public Edition/event. A collection run, candidate preparation run, or timer never constitutes promotion.

Private packet, source-read receipt, and editorial-decision inputs remain outside the repository's tracked public content and outside generated public artifacts. Do not copy gate-specific fields, source bodies, paths, reviewer identity, approvals, or reasons into a review candidate, Edition, Context, RSS item, HTML, sitemap, build log, or commit message; only the review candidate's explicit public-field allowlist may cross the boundary.

## Review candidate inspection

### Content Radar packet adaptation

An immutable Content Radar v1 private candidate packet can become the private
input to the existing review-candidate gate only through the local adapter. It
accepts the exact packet path, a separately supplied local framing config
validated by `schemas/aoi-news-content-radar-adapter-config-v1.schema.json`,
and one non-public output path:

```sh
node scripts/news-bridge/adapt-content-radar-packet.mjs \
  --packet /approved/private/content-radar-packet.json \
  --config /approved/private/aoi-news-edition-framing.json \
  --output "$REVIEW_DIR/private-candidate-packet.json"
```

The config supplies only the edition framing and one explicit candidate
language. The adapter verifies the upstream schema/version and canonical
SHA-256 integrity, canonicalizes credential-free HTTPS source URLs, and applies
the upstream v1 exact host-kind mapping to the URL host: `arxiv.org` is
`paper`, `github.com` is `repository`, and every other host (including
subdomains and lookalikes) is `unknown`. It rejects a declared host-kind
mismatch and rejects `unknown` downstream, as well as duplicate canonical
sources; it assigns opaque IDs from the canonical source URL plus upstream
integrity hash and writes the allowlisted AOIFUTURE private packet atomically.
It emits no source title, headline, summary, provenance locator, raw body,
score, prompt, reviewer, decision, or upstream integrity data. `context_ids`
is always empty.

This has intentional narrower review-input rules, not a claim of full upstream
schema equivalence or producer authentication: the adapter requires one through
1000 items (where upstream v1 may validate an empty packet), accepts HTTPS only
(where upstream accepts HTTP(S)), and rejects upstream-valid `unknown` kinds
because review input needs an actionable mapped source. It also does not
duplicate upstream's stored-URL canonical-equality or text-normalization and
private-text checks, because those fields do not cross the AOIFUTURE boundary.
Exact URL-host-to-kind semantics are mirrored specifically; other upstream
validation differences are deliberate and documented here. The SHA-256 field
proves canonical content consistency only; a locally recomputed hash does not
prove that Content Radar produced the packet.
It refuses every output lexically or physically/canonically beneath this
repository, including `public`, `src/pages`, `src/content/news`, and `dist`, so
the output must be in a separate local private workspace. It does not create an
output file when validation fails. It neither creates receipts/decisions nor
promotes, publishes, deploys, fetches, or schedules anything.
Like the later review-candidate writer, its path-based guard requires trusted,
locally controlled output ancestors and retains the documented residual
ancestor-symlink TOCTOU risk; that limitation is not publication authorization.

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

The output must retain `publication_status: "review-only"` at both wrapper and Edition levels. Inspect it in that local directory; do not place it beneath `src/content/news`, `dist/client`, their traversal paths, or symlink aliases, or copy it into a production manifest. The bridge path guard rejects those public roots before directory creation and again immediately before the candidate write, but it is path-based rather than fd-relative/no-follow containment. This operation therefore requires a **trusted, locally controlled output directory and ancestors**: no hostile local actor may swap an ancestor for a symlink between the final guard and the write/rename. That residual ancestor-symlink TOCTOU risk is not a publication authorization. The bridge has no promotion command and never intentionally writes public content.

For the checked-in contract fixture, run:

```sh
npm run test:news-bridge
```

This performs an equivalent temporary-output inspection and proves that preparation creates only `review-candidate.json`, retains review-only status, and has no promotion side effect.

## Promotion boundary

Promotion is a distinct local contract, not a deploy, publish, feed, or scheduling command. It accepts exactly one explicit `aoi.news.review-candidate.v1` file and one separate `aoi.news.public-promotion-approval.v1` file; raw Content Radar packets, receipts, and editorial decisions are not CLI inputs. The approval binds both `edition_id` and the deterministic SHA-256 hash of the canonical review-candidate JSON, and may target only `public`.

```sh
node scripts/news-promotion/promote-reviewed-candidate.mjs \
  --candidate /approved/review/review-candidate.json \
  --approval /approved/review/public-promotion-approval.json \
  --catalog-dir src/content/news
```

Before it writes, the promotion contract verifies the review-only status at both candidate levels, rejects private fields and local paths, validates the complete existing public Edition/Context catalog and Edition-event history, and rejects Edition, route, Signal, event-ID, and event-revision conflicts. It allowlists only the reviewed public Edition fields and derives the revision-1 `edition-published` event. Invalid input writes no tracked output. An exact pre-existing Edition/event pair is a no-write idempotent result; any differing duplicate is rejected. The only possible content writes are `src/content/news/editions/<edition_id>.json` and `src/content/news/events/<edition_id>.json` when that directory is selected explicitly.

Promotion must still stage and review only the intended public content files and run review and production build verification before any deployment decision.

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
VERCEL_ENV=production npm run build
VERCEL_ENV=production npm run verify:news-build:production
git diff --check
```

These checks are evidence for the independent Debug gate only. They do not schedule collection, promote a candidate, publish a feed, deploy, or change current public content.
