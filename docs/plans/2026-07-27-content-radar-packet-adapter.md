# Content Radar Packet Adapter Plan

**Goal:** Make a real local-only Content Radar selected-candidate packet consumable by the existing AOIFUTURE News private gate and review-only candidate CLI.

**No public authority:** This work must not write `src/content/news`, RSS, deployment configuration, scheduled public jobs, or public content. The adapter is local-only; it never fetches URLs, reads raw source bodies, or publishes.

## Task 1 — Normalize source kind at Content Radar export

- Map known primary-source domains deterministically: `arxiv.org` → `paper`; `github.com` → `repository`; recognized vendor documentation/release hosts only if explicitly mapped.
- Keep unknown domains as `unknown`; do not infer from a title.
- Add export/validator tests proving arXiv emits `paper` and unknown remains unknown.

## Task 2 — Adapt a Content Radar packet into AOIFUTURE private review input

- Add `scripts/news-bridge/adapt-content-radar-packet.mjs` plus a strict schema and tests.
- Input is one exact immutable Content Radar packet path plus explicit edition framing supplied by a local config file.
- Validate the original packet integrity and allowlist; reject `unknown` source kind, duplicate canonical URLs, malformed times, unsupported source kind, raw/private extra fields, or a non-local output path.
- Emit deterministic AOIFUTURE private review input with opaque candidate IDs derived from normalized source URL + source packet integrity hash. Preserve source URL, source kind, observed/published time, language and empty context IDs only; do not pass source body, score, provenance locator, original summary, source titles, reviewer identity, decision reasons or paths.
- The output is private review input only. Existing source-read receipts and editorial decisions remain mandatory.

## Task 3 — Actual-source dry run

- Run the adapter against the existing 2026-07-25 private packet with two source-read candidates.
- Produce receipts and editorial decisions outside repos, then generate one `review-only` candidate artifact under the approved private review workspace.
- Independently validate the artifact and inspect review build. Do not promote or publish.
