# AOIFUTURE News Phase 1 Contract Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Build and prove a deterministic, fail-closed publication boundary for AOIFUTURE News Edition and Active Context v1 manifests without adding UI or production behavior.

**Architecture:** Strict JSON Schemas define the public Edition, Context, and private source-read receipt shapes. A repository-local validator validates individual documents, previous-to-candidate Context transitions, the complete Signal/Context reference graph, and approved receipt coverage; a separate import CLI normalizes source URLs/domains and writes only validated public manifests to a staging directory. Public-safe non-production fixtures exercise the boundary using the readable 2026-07-23 DailyNews roundup as editorial input, never as publication authority.

**Tech Stack:** Node.js ESM, JSON Schema 2020-12, Ajv, Vitest, Astro build.

---

### Task 1: Add strict manifest schemas

**Objective:** Define closed public and private record shapes with exact versions, bounded plain-text fields, HTTPS URLs, and no unknown fields.

**Files:**
- Create: `schemas/aoi-news-edition-v1.schema.json`
- Create: `schemas/aoi-news-context-v1.schema.json`
- Create: `schemas/aoi-news-source-read-v1.schema.json`

**Step 1:** Add schema-focused tests that accept minimal valid records and reject unknown fields, HTML, raw bodies, and malformed versions.

**Step 2:** Run `npx vitest run tests/news-contract.test.mjs`; expect failure because schemas and validator do not exist.

**Step 3:** Add the three schemas with `additionalProperties: false` at every object boundary.

**Step 4:** Re-run the focused test; schema-shape cases should pass while semantic validator cases remain red.

### Task 2: Implement deterministic validation

**Objective:** Enforce invariants that JSON Schema cannot prove across URLs, manifests, revisions, references, and private receipts.

**Files:**
- Create: `scripts/news-contract/validator.mjs`
- Create: `scripts/validate-news-contract.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`

**Step 1:** Add negative tests for credentials, private/loopback hosts, tracking parameters, source-domain mismatch, duplicate/global IDs, stale lineage, unresolved and one-way references, withdrawn current support, invalid revision order, immutable-prefix violations, latest-view/timestamp mismatch, silent overwrite, and missing/rejected receipts.

**Step 2:** Run the focused test and confirm failures identify absent semantic checks.

**Step 3:** Implement pure validation functions and a CLI that loads a complete bundle and returns stable path-sorted errors.

**Step 4:** Run `npx vitest run tests/news-contract.test.mjs`; expect all focused tests to pass.

### Task 3: Add public-safe sample and import boundary

**Objective:** Prove a reviewed bundle can be normalized and staged without publishing private receipt data.

**Files:**
- Create: `fixtures/news-contract/non-production/import-bundle.json`
- Create: `fixtures/news-contract/non-production/README.md`
- Create: `scripts/news-contract/importer.mjs`
- Create: `scripts/import-news-contract.mjs`

**Step 1:** Add tests asserting the fixture is explicitly non-production, has at least two evidence-backed revisions, contains no forbidden private/raw fields, and produces stable output.

**Step 2:** Run the focused test and confirm it fails before fixture/import implementation.

**Step 3:** Implement URL normalization/domain derivation, validate the complete candidate graph and prior transition, then atomically write only Edition and candidate Context JSON to a caller-selected staging directory.

**Step 4:** Run the validator and importer twice against temporary directories and compare outputs byte-for-byte.

### Task 4: Document retention and handoff

**Objective:** Make artifact ownership, deletion, verification, correction, and reachability semantics operationally explicit.

**Files:**
- Create: `docs/news/artifact-retention-ledger.md`
- Create: `docs/news/dailynews-import-handoff.md`

**Step 1:** Record each public/private artifact class, purpose, owner, deletion condition, and deletion/readback verification.

**Step 2:** Document exact manual DailyNews-to-repository commands, source-first/plain-text/same-origin-image gates, source-unavailable and correction behavior, and last-known-valid staging semantics.

**Step 3:** Review documents for accidental local paths, credentials, private notes, internal scores, or copied source text.

### Task 5: Verify and checkpoint

**Objective:** Produce repeatable evidence and a task-owned local commit for the Debug gate.

**Files:**
- Test: `tests/news-contract.test.mjs`
- Test: all paths above

**Step 1:** Run `npm run test:news-contract`; expect PASS.

**Step 2:** Run the validator and importer using the sample bundle; expect PASS and only public files in staging.

**Step 3:** Run `npm run build`; expect exit 0.

**Step 4:** Run privacy-pattern scans, `git diff --check`, and inspect exact changed paths.

**Step 5:** Stage exact task-owned paths only and create a local commit. Do not push, merge, deploy, or publish.
