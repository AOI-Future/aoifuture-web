# Content Radar → AOIFUTURE News Bridge Implementation Plan

> **For Hermes:** Execute task-by-task with Engineer → Debug → Reviewer gates. No task may publish, schedule, post, or deploy until an explicit later Ops release task.

**Goal:** Turn Content Radar’s local, advisory candidate packet into a review-only AOIFUTURE News candidate through private source-read and editorial gates, without placing private artifacts in the public site repository.

**Architecture:** Content Radar emits a local-only packet. A local bridge command consumes that packet plus private source-read receipts and editorial decisions from paths outside the repository. It validates one-to-one source identity, status, and approval, then emits only an allowlisted review candidate. A separate promotion command may write a public Edition/event only from a reviewed candidate; this phase implements review-candidate preparation and validation, not public promotion or deployment.

**Trust boundaries:**
- Private inputs: packet, receipts, editorial decisions; never committed, rendered, RSS-emitted, or logged in full.
- Review candidate: public-safe allowlisted fields, `review-only` only, no publishing authority.
- Public manifest/event: separately reviewed future artifact, not created by a timer or source collection run.

**Acceptance constraints:**
- Reject unknown/private fields, URL mismatch, rejected/missing receipts, source-unavailable status, duplicate signal/source identity, and unsupported source kinds.
- Never fetch source URLs, connect to Content Radar, use iCloud, call FreshRSS, or run public actions at build/request time.
- Do not store source bodies, scores, prompts, reviewer identities, claim locators, private paths, credentials, or decision reasons in public-safe output.
- Preserve the current public editions, RSS, metadata, and deployment unchanged.

---

### Task 1: Define private-gate schema and deterministic validator

**Files:**
- Create: `schemas/aoi-news-source-read-receipt-v1.schema.json`
- Create: `schemas/aoi-news-editorial-decision-v1.schema.json`
- Create: `scripts/news-bridge/private-gate-validator.mjs`
- Test: `tests/news-bridge-private-gates.test.mjs`

**Requirements:** Receipts must be local-only and require opaque signal candidate ID, normalized source URL, source kind, checked time, bounded claim locator, reviewer identity, approval time, and `approved` decision. Editorial decisions must be local-only and require the same candidate identity, approved inclusion decision, approved public fields, role/topic selection, and approval time. Reject empty/unknown fields and ensure URL canonical equality.

**Verification:** focused tests must fail for missing/rejected/mismatched receipt and decision data, unsupported kind, malformed times, duplicates, unknown fields, and private-field leakage attempts.

### Task 2: Prepare a review-only candidate from private inputs

**Files:**
- Create: `scripts/news-bridge/prepare-review-candidate.mjs`
- Create: `schemas/aoi-news-review-candidate-v1.schema.json`
- Create: `fixtures/news-bridge/private/` test-only fixture inputs
- Create: `fixtures/news-bridge/review/` expected public-safe candidate fixture
- Test: `tests/news-bridge-prepare.test.mjs`

**Requirements:** Accept explicit local file paths. Validate private packet + receipt + decision via Task 1. Produce a deterministic review candidate only under an explicit output directory, with `publication_status: review-only`; retain public Signal allowlist only. Strip every private gate field. Re-run with unchanged inputs must be byte-stable. Failure must leave no partial output.

**Verification:** test no private strings/keys occur in output; reject source URL mismatch, one receipt reused for two candidates, raw/source body, public status, arbitrary external URL, and unknown fields. Run the existing public catalog validator against the resulting review candidate in review mode.

### Task 3: Add review gate and operational contract documentation

**Files:**
- Create: `docs/news/content-radar-bridge-operation.md`
- Modify: `scripts/verify-news-build.mjs`
- Modify: `package.json` if a narrow test/script entry is needed
- Test: `tests/news-bridge-operation-contract.test.mjs`

**Requirements:** Document the two clocks: two-hour collection/proposal versus human-reviewed publication. Add a verifier that fails if private inputs, receipt fields, private file paths, raw source text, or internal terms appear in tracked public content/output. Verify review candidate can be inspected without production promotion. Document correction/source-unavailable/withdrawal handoff and rollback boundary.

**Verification:** full News tests, bridge tests, production and review build verifiers. Confirm no current public source file, feed XML, or deployment artifact changes in this phase.

### Task 4: Pilot an actual local-only candidate, then review

**Files:** no tracked public content change unless a later separate approval exists.

**Requirements:** On the execution host, produce one packet from current selected Content Radar data, collect source-read receipts and editorial decisions, and generate a review-only candidate. If there are no eligible candidates or source validation fails, record a no-op/failure receipt and do not pad or publish.

**Verification:** source identities and timestamps match, private inputs remain outside the repo, review-only build succeeds, and an independent editorial reviewer approves the candidate before any separate promotion/publication task.
