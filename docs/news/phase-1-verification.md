# AOIFUTURE News Phase 1 verification evidence

This is concise Engineer self-test evidence for the local Phase 1 contract commit. It is not independent Debug or Reviewer approval and does not authorize publication.

## Commands and results

- `npm run test:news-contract` — exit 0; Vitest reported 1 test file passed and 42 tests passed. Coverage includes strict schemas, leakage cases, malformed-document fail-closed behavior, URL rules, reference closure, source-read receipts, Context transitions, and deterministic import output.
- `npm run validate:news-contract` — exit 0; the non-production fixture returned `{ "ok": true, "errors": [] }`.
- `node scripts/import-news-contract.mjs --input fixtures/news-contract/non-production/import-bundle.json --output <temporary-directory>` — exit 0 in two independent temporary directories. Both runs wrote only `contexts/agent-authority.json` and `editions/2026-07-23.json`; corresponding files were byte-identical.
- `npm run build` — exit 0; Astro completed the server build, prerendered existing static routes, and created the sitemap. The adapter emitted a non-fatal warning that local Node 26 is mapped to Node 24 for Vercel functions.
- `git diff --check` — exit 0.
- Fixture scans for forbidden body/private/credential/path/internal-network terms, HTML tags, and credentialed URLs — no matches.

## Deterministic artifact evidence

- `contexts/agent-authority.json`: SHA-256 `244a6c63a28cc5f4d12d1f59a2648665bde60cf3041a5423fbb1dbaa3cd8ea86`
- `editions/2026-07-23.json`: SHA-256 `db5cd2104eaf4c1ab549b0c882360dd01841ecc4ca2d7fa727c0c9aae2cef555`

The temporary staging directories were deleted after comparison. No production content, network crawler, UI, deployment, or external publication path was exercised.