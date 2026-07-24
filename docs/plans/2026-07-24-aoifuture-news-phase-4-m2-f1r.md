# AOIFUTURE News Phase 4 — M2 Metadata and Rolling Edition RSS Plan

> Execute Engineer → Debug → Writer → Reviewer. Produce a local immutable candidate only. No push, merge, Preview, deploy, scheduler creation, DNS/robots production switch, feed publication, or production mutation is authorized.

**Base:** `0d5f7ec47c4d9277fece0b457da428356afcbcce`

## Owner decision

- Metadata: **M2 editorial digest / collection**
- Feed: **F1R Rolling Edition RSS**
- Source check intent: approximately every two hours
- Publication: only after a meaningful reviewed public change; never because the clock advanced
- Web identity: one canonical dated Edition per day
- RSS identity: one GUID per meaningful Edition revision
- Review: revisit cadence and granularity using aggregate reader response and observed operating cost

## Task 1 — Public rolling-feed event contract

Add a strict public schema for append-only Edition revision events. Keep it separate from private receipts and collection state.

Required public fields should include:

- schema version;
- stable event ID / GUID;
- Edition ID and date;
- monotonic revision number;
- event kind (`edition-published`, `signals-added`, `signal-corrected`, `signal-source-unavailable`, `signal-withdrawn`, `edition-note-updated` or a smaller justified set);
- public title and short public summary;
- event publication timestamp;
- canonical Edition URL;
- changed public Signal IDs when applicable.

Rules:

- additional fields fail closed;
- no raw source body, copied RSS text, receipt, local path, private score, prompt, hidden reasoning, reviewer identity, unpublished URL, or reader identifier;
- event IDs are derived as `aoi-news-<edition_id>-rNNN`; arbitrary IDs are invalid;
- revision numbers are unique and monotonic per Edition;
- revision 1 uses the Edition publication instant; later event timestamps are strictly ordered;
- changed Signal IDs resolve to the referenced public Edition state;
- event URL is HTTPS, no-www `aoifuture.com`, trailing slash, and points to the matching dated Edition;
- an update is append-only; prior published events may not be rewritten or deleted.

Use only the existing two validated non-production sample Signals for fixtures. Do not invent a source, fact, claim, or URL.

## Task 2 — Meaningful-change proposal classifier

Implement a deterministic model-free classifier that compares two validated public Edition snapshots and produces a proposal, not an automatically published event.

Meaningful proposal classes:

- Signal added;
- public Source fact or Caveat correction;
- public correction note/change-kind change;
- verification status moving to source-unavailable, reported distinctly from withdrawal;
- verification status and change semantics moving to withdrawn;
- Edition note meaningfully changed.

Non-event changes:

- only `generated_at` or check timestamp advanced;
- item order changed without public content change;
- internal-only/private state;
- clock reached the two-hour check cadence with no reviewed public change.

The classifier must fail closed on invalid snapshots. A proposal requires an explicit reviewed public event artifact before RSS output. Do not schedule it in this phase.

## Task 3 — RSS output

Generate `/news/feed.xml` as RSS 2.0 with Atom self-link or a standards-equivalent implementation.

- Channel represents AOIFUTURE News Rolling Edition RSS.
- Current non-production fixture remains unmistakably labeled as sample.
- Each item uses the revision event GUID, stable across rebuilds.
- Item link points to the one dated Edition URL. It may include aggregate-only RSS campaign parameters if the canonical remains clean and no reader identifier is added.
- Item description uses only reviewed AOIFUTURE public event text and changed public Signal titles; it must not substitute for or copy source articles.
- Publication date is the event timestamp, not build/check time.
- Feed order is newest event first and deterministic.
- A rebuild with no new event produces byte-stable semantic content apart from justified XML serializer formatting.
- Add feed discovery link to News HTML.
- No Active Context events in F1R v1.

## Task 4 — M2 metadata

Add M2 metadata without representing Signal cards as AOIFUTURE-authored NewsArticle objects.

- Daily Edition: `CollectionPage` with `ItemList`/`ListItem` entries referencing exact Signal anchors.
- News index/archive: CollectionPage/WebPage metadata as appropriate.
- Active Context: WebPage metadata with modified time and public supporting references; not NewsArticle.
- Add title/description/canonical/Open Graph/Twitter summary metadata using public allowlisted fields only.
- Add feed discovery.
- Keep the current sample `noindex, nofollow` and visible non-production labeling. Production robots switching remains a later launch gate.
- Keep canonical host `https://aoifuture.com`, no `www`.
- Do not add a generic or fabricated social image.

## Task 5 — User-response review policy

After Debug PASS, Writer documents:

- check cadence versus publish cadence;
- meaningful revision rules and manual review point;
- what aggregate, non-identifying signals may inform future review (RSS-referral pageviews, feed endpoint demand if available, Edition completion/click behavior already available through approved analytics);
- no per-reader tracking, hidden IDs, or email collection;
- review M2/F1R after an initial observation period or enough real revisions, without promising a fixed outcome;
- rollback/disable behavior if feed noise, correction burden, or reader confusion is high.

## Required tests

- schema/semantic positive and negative tests;
- clock-only/no-change produces no proposal/event;
- changed public Signal produces one proposal;
- invalid/private snapshots fail closed;
- append-only/revision monotonicity and prior-event immutability;
- GUID stability and deterministic feed ordering;
- feed content allowlist/private-term scan;
- correct content type and valid XML;
- M2 JSON-LD types and exact anchor URLs;
- no Signal represented as NewsArticle;
- canonical/no-www/trailing-slash/feed-discovery checks;
- current sample remains noindex/non-production;
- existing News tests, contract validation, build, E2E, privacy and self-host font checks;
- clean worktree and no listeners/residue.

## Gate outputs

- Engineer: schema, fixtures, classifier, feed, metadata, tests, local immutable commit.
- Debug: independent exact-SHA negative/positive verification and generated-output/browser readback.
- Writer: concise Japanese operating/review policy using verified evidence only.
- Reviewer: exact-tip code/content/privacy/semantics review and PASS/REVISE.
