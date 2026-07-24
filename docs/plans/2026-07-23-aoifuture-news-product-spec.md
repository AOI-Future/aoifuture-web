# AOIFUTURE News — Product, UX, and Technical Specification

- **Status:** Product direction approved; Phase 1 contract preparation
- **Target:** `https://aoifuture.com/news/`
- **Owning repository:** `AOI-Future/aoifuture-web`
- **Planning date:** 2026-07-23
- **Implementation:** Not started by this document

## Source hierarchy

When this document and another artifact disagree, use this order:

1. Shugo's explicit product decisions in the AOIFUTURE News workstream
2. `aoifuture-web/AGENTS.md` for repository and AOI Design System constraints
3. This specification for AOIFUTURE News product meaning and proposed behavior
4. DailyNews workflow specification for private editorial operations
5. Current repository behavior for what is already implemented

Current implementation facts are not product decisions. In particular, the absence of a content collection or `/news/` route today does not rule out adding them.

## Certainty labels

- **LOCKED** — already established by the request, repository contract, or safety boundary
- **DESIGN CHOICE** — recommended and reversible; owner review can change it
- **PLACEHOLDER — REFRESH REQUIRED** — depends on a later exporter spike, implementation, or live evidence

---

## 1. The product in one sentence

AOIFUTURE News is a **source-first dynamic context desk**: a finite daily view of primary information, plus a living account of what changed and what an AI-agent operator needs to understand now.

It is not a newspaper costume for an RSS feed.

The useful part of The Front Page is not its old-paper ornament. It is the way a large set of links becomes a single field that can be scanned, compared, and wandered through. AOIFUTURE should keep that spatial overview while replacing popularity-driven Hacker News logic with provenance, editorial judgment, and visible uncertainty.

### Product thesis — LOCKED

- The page must reward **contact with original sources**, not consumption of generated summaries.
- A reader should understand the day's shape in roughly 30 seconds without opening every item.
- A reader should also find one adjacent, unexpected item that they would not have searched for.
- AOI commentary must be visibly distinct from source facts.
- A finite daily edition is better than an endless engagement feed.
- A Daily Edition is a dated editorial snapshot; an Active Context is a living view with an explicit revision history.
- Public editorial judgments remain traceable, but copied source bodies and private collection data do not become a permanent public archive.

### Position

This sits between three familiar products:

- RSS readers are complete but operational and personal.
- Link aggregators are lively but popularity-driven.
- AI news summaries are convenient but flatten sources into interchangeable prose.

AOIFUTURE News should be selective like an editor's desk, inspectable like a research notebook, and open-ended like wandering through a good magazine shop.

### Two temporal surfaces — LOCKED

AOIFUTURE News has two connected ways to read time:

- **Daily Edition:** what AOIFUTURE selected on a given date. It remains a finite, dated snapshot.
- **Active Context:** the current editorial view of a changing topic, followed by “How we got here”: the Signals and revisions that changed that view.

The site does not make chronology the only navigation model. Readers can move backward by edition, Context, topic, or source. A Context starts with the current view, not with the oldest event. When the view changes, AOIFUTURE records what changed, why it changed, and which public Signals support the revision. Old interpretations are not silently overwritten.

### AI-agent operator lens — LOCKED

An Active Context may organize its current view using these operator questions:

- **Capability:** what became possible?
- **Authority:** which tools, credentials, systems, or data can the agent reach?
- **Control:** where are approval, stop, cancellation, and human handoff boundaries?
- **Evidence:** what readback or artifact proves the claimed result?
- **Cost / Route:** did the model, provider, subscription, API, or local/cloud route change?
- **Operational impact:** is there a version, configuration, or workflow to inspect now?
- **Unresolved:** what remains unknown, unverified, or provider-specific?

These are editorial lenses, not mandatory filler. Empty or generic fields are omitted.

---

## 2. Target readers and jobs

### Primary reader

A practitioner who works with AI, software, security, research, creative systems, or organizational change and wants a compact way to encounter trustworthy new material without surrendering the reading decision to a recommendation model.

### Reader jobs

1. **Orient:** “What changed since yesterday, and where is the real source?”
2. **Triage:** “Which two items deserve ten minutes now?”
3. **Verify:** “Is this an announcement, research result, release, advisory, or commentary?”
4. **Connect:** “Why does this belong beside the other items today?”
5. **Wander:** “Show me one credible item outside my usual lane.”
6. **Return:** “Let me revisit a dated edition without losing the original links.”
7. **Trace:** “Show me why AOIFUTURE's current view changed and which earlier Signals led here.”

Machine readability supports discovery and citation, but it is not a second audience and must not distort the visible page.

---

## 3. Editorial promise

### Reader-facing promise — LOCKED

Every published item answers four questions without making the reader hunt:

1. **Who published it?**
2. **What kind of source is it?**
3. **What changed?**
4. **Why did AOIFUTURE place it here?**

### Source hierarchy — LOCKED

Preferred order:

1. Official announcement, documentation, release notes, standards body, regulator, repository, advisory, or original paper
2. Original reporting with named evidence
3. Analysis that contributes a distinct argument or data set
4. Aggregator or social post only as discovery metadata, never as sole support for a factual item

Hacker News may be one discovery source. It is not the editorial center and its points or comment count do not define importance.

### Facts and AOI context — LOCKED

Each item separates:

- **Source fact:** a concise description grounded in the linked source
- **AOI note:** why the item matters, what to inspect, or what remains uncertain

The AOI note must not impersonate the source. Labels, typography, and data fields keep the two distinct.

### Correction policy — LOCKED

Published editions are append-corrected rather than silently rewritten.

- Minor copy correction: update with `corrected_at`
- Material factual correction: add a visible correction note
- Broken or invalid source: mark withdrawn; retain the item identifier and reason
- Source URL replacement: preserve the original URL in the audit manifest when legally and technically safe

---

## 4. What “AI Slop-free” means here

This is an operating rule, not a visual mood.

### Publication gate — LOCKED

An item is publishable only when:

- the source URL is reachable or its unavailability is explicitly recorded;
- the source type and publisher are known;
- the visible factual line is supported by the source;
- generated prose has been reviewed for unsupported specificity;
- the AOI note adds a concrete reading angle rather than generic importance language;
- duplicate announcements and syndicated copies have been collapsed;
- no private editorial metadata leaks into the public artifact.

### Prohibited public fields — LOCKED

The public feed must never include:

- internal ranking or model scores;
- private notes, email content, draft comments, or unpublished article plans;
- local filesystem or Obsidian paths;
- FreshRSS credentials, item bodies copied beyond permitted excerpts, cookies, tokens, or account identifiers;
- internal labels such as `theme-map`, `calendar_role`, pipeline stages, model prompts, or rejection notes;
- claims inferred only from an LLM summary when the source was not read.

### Copy rules — LOCKED

Avoid:

- “This is a game changer” and equivalent generic inflation;
- a summary that merely restates the headline;
- five cards with identical “why it matters” sentence structure;
- stock AI images, decorative robot brains, or generated portraits of real people;
- fake precision such as confidence percentages without a defined and tested model;
- urgency labels that are really engagement bait.

Prefer:

- concrete verbs and named actors;
- direct uncertainty: `発表段階`, `研究結果`, `独立検証なし`, `修正版あり`;
- short AOI notes with an operator's question;
- primary-source logos or images only when usage rights and accessibility are clear;
- text-led cards as the default.

---

## 5. Product concept: Dynamic Context Desk

- **Name:** AOIFUTURE News
- **Internal concept name:** Dynamic Context Desk

The visual metaphor is a live work surface, not a broadsheet. Items have different weights, but they share a disciplined grid. Cyan is used to reveal structure and interaction, not to turn every headline into neon.

### Routes

- **LOCKED:** `/news/` — latest edition
- **DESIGN CHOICE:** `/news/YYYY-MM-DD/` — dated edition
- **LOCKED:** `/news/context/[slug]/` — current Context and its public revision history
- **DESIGN CHOICE:** `/news/archive/` — browse by edition, Context, topic, or source
- **DESIGN CHOICE:** `/news/feed.xml` — curated RSS or Atom output
- **Deferred unless a real consumer needs it:** `/news/feed.json` — JSON Feed

Canonical URLs should include trailing slash consistently with Astro/Vercel behavior selected during implementation.

### Page anatomy — DESIGN CHOICE

1. **Desk header**
   - `AOIFUTURE / NEWS`
   - edition date and last editorial update
   - short promise: `Primary sources, selected and annotated.`
   - latest/archive control

2. **Lead field**
   - one lead signal or a two-item pair
   - headline, source identity, source type, published time
   - two-line source fact
   - one distinct AOI note
   - direct source action

3. **Today field**
   - dense, responsive card grid
   - 6–12 curated items for a normal edition
   - varied card span based on editorial role, not popularity score

4. **Active Contexts**
   - current views such as Agent Authority, Evaluation and Evidence, Model Routing and Cost, Local/Cloud Execution, Security, and Creative Provenance
   - each card shows current view, last meaningful change, unresolved point, and supporting Signals
   - counts are descriptive, not gamified
   - selecting a Context filters related Signals and updates an accessible result count

5. **Detour**
   - one adjacent item chosen because it broadens the edition
   - explicitly labeled `DETOUR`, not “recommended for you”
   - no personal behavioral profile required

6. **Edition note**
   - 2–4 sentences about the day's pattern
   - written only when there is a real connection; omitted when the edition is simply a useful set of unrelated items

7. **Archive footer**
   - previous/next available edition
   - browse by Context, topic, and source
   - correction policy, feed links, editorial method

### Why the Detour matters

Most feeds optimize relevance until every item looks like the last one. AOIFUTURE can make curiosity an explicit editorial act instead. The Detour is the page's small refusal to become a personalized tunnel.

---

## 6. Information hierarchy

### Card content order — LOCKED

1. Source type + publisher
2. Headline
3. Source fact
4. AOI note
5. Published/observed time and topic labels
6. Direct source action

The source link is the primary action. AOIFUTURE does not hide it behind an internal article page.

### Card roles — DESIGN CHOICE

- `lead` — edition-defining item; maximum 1
- `major` — needs more context or has operational consequence; maximum 3
- `brief` — useful direct link with a short fact line
- `detour` — credible adjacent item; exactly 0 or 1
- `watch` — early or incomplete signal worth tracking, visibly marked as provisional

Role is an editorial layout decision. It is not exposed as an importance score.

### Density

Desktop should show the shape of at least 8 items within the first two viewport heights. Mobile should preserve scanability without shrinking Japanese text below the repository's 14px body minimum.

- Wide screens: 12-column CSS Grid, generally 3–4 visible card columns
- Medium screens: 2 columns
- Small screens: 1 column with compact metadata and no horizontal carousel
- No masonry ordering that changes keyboard or screen-reader sequence

Visual variation comes from grid span, type scale, rules, and controlled blank space. It does not require newspaper ornament or a wall of glass cards.

---

## 7. Interaction design

### Primary actions — LOCKED

- Open source
- Filter by thread
- Move to previous/next edition

### Secondary actions — DESIGN CHOICE

- Expand/collapse AOI note on compact cards
- `寄り道する` jump to Detour

### Explicit non-interactions — LOCKED

- No likes, reactions, comments, follower counts, or visible popularity ranking
- No infinite scroll
- No auto-playing media
- No forced internal detail page before reaching the source
- No behavioral personalization in MVP
- No dark pattern that delays opening the original source

### External-link behavior — DESIGN CHOICE

Use normal links. Do not force new tabs. Add a visible domain and accessible external-source label; let the reader's browser decide tab behavior. Public pages must not embed source-hosted images, scripts, or tracking pixels. If an approved image is used, publish a rights-cleared local copy where the license permits it; otherwise omit it.

---

## 8. Visual direction within AOI Design System v2

The repository is the reference implementation of **蒼硝子 (Liquid Glass)**. `/news/` should belong to AOIFUTURE without turning a reading surface into a special-effect demo.

### Locked design-system constraints

From `AGENTS.md`:

- pure black ground;
- cyan brand structure;
- body text at least 14px in Japanese;
- contrast at least 4.5:1;
- touch targets at least 44px;
- glass for floating controls only, never under broad body text;
- no glass-on-glass;
- reduced transparency and reduced motion must follow OS preferences;
- no emoji; use text or simple glyphs;
- motion uses 200–500ms linear/ease-in-out, never bounce or spring.

### Recommended expression — DESIGN CHOICE

- Use a near-black reading ground and subtle column/rule structure.
- Use Noto Sans JP for summaries and notes; JetBrains Mono for source type, timestamp, and controls.
- Use cyan for focus, selected state, and provenance markers—not for every paragraph.
- Reserve Liquid Glass for the sticky edition/thread control bar or mobile filter capsule.
- Let card bodies remain flat and readable.
- Use a small amount of AOI violet only to mark `AOI NOTE`; do not encode trust by hue alone.
- Avoid global glitch/typewriter animations on news headlines.

### Image policy — LOCKED

Text-first is the default. An image appears only if it does at least one job:

- it is the primary evidence (chart, device, artwork, interface, photograph);
- it makes an unfamiliar research object legible;
- it is an official visual with usable rights and meaningful alt text.

No image is better than a generic image.

---

## 9. States and failure semantics

### Latest edition states — LOCKED

- `ready` — validated edition is available
- `stale` — latest edition is older than the configured freshness threshold; still readable with a visible date
- `empty` — no edition was published for the date; show the most recent edition, never fabricate placeholders
- `invalid` — feed validation failed; retain the last known valid edition
- `partial` — some source reachability checks failed but reviewed items remain publishable; mark affected items individually

### UI state requirements

- Loading: server-rendered content should minimize loading UI; archive filtering may use a short skeleton or text status
- Empty thread: say no items are in this edition and offer “all threads”
- Offline: already-rendered edition remains readable; source links naturally fail outside AOIFUTURE's control
- Broken source: show `source unavailable at last check`, last checked time, and correction/withdrawal state
- JavaScript unavailable: latest edition, source links, and archive navigation still work
- Feed generation failure: production serves last known valid public artifact
- Invalid archive date or unknown edition: return a real `404`, not the latest edition under the requested URL

“Last known valid” is a deployment property, not a runtime fetch fallback: an invalid candidate fails CI/build and the currently deployed edition remains untouched. Vercel must never read the private DailyNews workspace or fetch source pages to render a request.

### Freshness — PLACEHOLDER — REFRESH REQUIRED

Proposed initial thresholds:

- latest edition warning after 36 hours on normal operating days;
- no “breaking” status in MVP;
- source reachability timestamp displayed only in an accessible disclosure on an affected card or on the method page, not as visual noise on every card.

Confirm thresholds after a 2–4 week operating pilot.

---

## 10. Public content contract

Private DailyNews artifacts are not safe public APIs. The website consumes a deliberately small export.

### Edition schema v1 — DESIGN CHOICE

```ts
export interface PublicNewsEditionV1 {
  schema_version: 'aoi.news.edition.v1';
  edition_id: string;              // e.g. 2026-07-23
  edition_date: string;            // YYYY-MM-DD, JST editorial date
  generated_at: string;            // RFC 3339
  published_at: string;            // RFC 3339
  corrected_at?: string;           // RFC 3339
  title: string;
  dek?: string;
  edition_note?: string;
  items: PublicNewsItemV1[];
  topics: PublicNewsTopicV1[];
}
```

### Item schema v1 — DESIGN CHOICE

```ts
export interface PublicNewsItemV1 {
  id: string;                      // stable, opaque, non-secret
  title: string;
  source_url: string;
  source_title: string;
  source_domain: string;
  source_kind:
    | 'official'
    | 'documentation'
    | 'release'
    | 'repository'
    | 'paper'
    | 'advisory'
    | 'regulator'
    | 'original-reporting'
    | 'analysis';
  language: 'ja' | 'en' | 'other';
  published_at?: string;
  observed_at: string;
  context_ids: string[];            // Active Contexts that cite this Signal
  change?: {
    kind: 'new' | 'updated' | 'corrected' | 'superseded' | 'withdrawn';
    previous_signal_ids?: string[];
  };
  source_fact: string;             // supported by source
  aoi_note: string;                // editorial interpretation; may be short but not generic
  caveat?: string;                 // visible, claim-adjacent limitation
  topics: string[];
  role: 'lead' | 'major' | 'brief' | 'detour' | 'watch';
  verification: {
    status: 'verified' | 'source-unavailable' | 'withdrawn';
    checked_at: string;
  };
  image?: {
    url: string;
    alt: string;
    credit: string;
    rights_basis: string;           // license or explicit permission recorded at publication
  };
  corrected_at?: string;
  correction_note?: string;
}
```

### Topic schema v1 — DESIGN CHOICE

```ts
export interface PublicNewsTopicV1 {
  id: string;
  label_ja: string;
  label_en?: string;
  description?: string;
}
```

### Active Context schema v1 — DESIGN CHOICE

```ts
export interface PublicNewsContextV1 {
  schema_version: 'aoi.news.context.v1';
  id: string;
  slug: string;
  title: string;
  current_view: string;
  updated_at: string;
  operator_context?: {
    capability?: string;
    authority?: string;
    control?: string;
    evidence?: string;
    cost_route?: string;
    operational_impact?: string;
    unresolved?: string;
  };
  supporting_signal_ids: string[];
  revisions: PublicNewsContextRevisionV1[];
}

export interface PublicNewsContextRevisionV1 {
  id: string;
  changed_at: string;
  change_reason: string;
  resulting_view: string;
  evidence_signal_ids: string[];
}
```

A Context revision is an editorial record, not a generated hidden state. The public page shows the current view first and the revision trail below it. A revision cannot cite a private candidate or internal model output; every evidence ID must resolve to a published Signal.

### Private source-read receipt — LOCKED

Every published Signal has a private, bounded source-read receipt. The receipt proves the editorial check without publishing or permanently storing the source body.

```ts
export interface PrivateSourceReadReceiptV1 {
  schema_version: 'aoi.news.source-read.v1';
  signal_id: string;
  normalized_source_url: string;
  source_kind: string;
  read_at: string;
  claim_locator: string;      // section, heading, page, release entry, advisory field, or repository path
  reviewed_by: string;        // attributable human/editor identity, not a public reader identifier
  approved_at: string;
  decision: 'approved' | 'rejected';
}
```

The receipt contains no copied source body or hidden model reasoning. `claim_locator` must be specific enough for a later reviewer to reopen the source and find support for `source_fact`. Build/import fails when a public Signal lacks an approved receipt whose `signal_id` and normalized URL match.

### Cross-manifest state-transition contract — LOCKED

JSON Schema validates one document. Publication additionally runs a state-transition validator against the immediately preceding published Context manifest.

- Initial publication has at least one revision, and `current_view` equals that revision's `resulting_view`.
- For every publication, `current_view === revisions[-1].resulting_view` and `updated_at === revisions[-1].changed_at`.
- On update, the previous revision array is an immutable prefix of the candidate array after canonical semantic normalization: no prior revision may be deleted, reordered, renamed, or edited.
- A changed `current_view`, `updated_at`, supporting set, or operator Context that changes editorial meaning requires one newly appended revision with a concrete reason and evidence Signals.
- Republishing an identical manifest is idempotent; a metadata-only change cannot fabricate a new editorial revision.

### Reference namespace and closure — LOCKED

- Signal IDs are globally unique across all published Editions and are never reused. Context IDs are globally unique in a separate namespace.
- `context_ids` resolve only to published Context IDs.
- `supporting_signal_ids`, every revision's `evidence_signal_ids`, and `previous_signal_ids` resolve only to globally published Signal IDs; self-reference is forbidden.
- `previous_signal_ids` must point to an earlier published/observed Signal and express correction, supersession, or lineage—not generic relatedness.
- Bidirectional closure is exact: a Signal lists a Context in `context_ids` if and only if that Signal appears in the Context's current `supporting_signal_ids` or any revision's `evidence_signal_ids`.
- A withdrawn Signal remains resolvable for historical evidence and lineage, with withdrawn status visible. It cannot appear in current `supporting_signal_ids`; it may remain in a historical revision's evidence set.
- Validators load the complete published Edition/Context index needed to prove global uniqueness and closure; validating only the candidate file is insufficient.

### Validation invariants — LOCKED

- `schema_version` must be exact and supported.
- Edition and item IDs are unique.
- Exactly zero or one item has role `lead`.
- Exactly zero or one item has role `detour`.
- Every source URL uses `https:` except an explicitly reviewed exception.
- Source URLs reject embedded credentials and strip known tracking parameters; necessary query parameters are retained.
- Source domains are parsed from URLs by the exporter, not accepted as arbitrary display input.
- Every item has a non-empty source fact and source identity.
- `watch` items require a caveat.
- `withdrawn` items cannot remain `lead` or `major`.
- Image URL, alt, credit, and rights basis are required together; image URLs must be same-origin public assets.
- `title` is AOIFUTURE's display headline and `source_title` is the source's own title; the UI must not present one as the other.
- Every item has an AOI note because the editorial reason for inclusion is part of the reader-facing promise.
- Cross-manifest validation enforces the complete reference namespace and closure contract above, including `supporting_signal_ids` and `previous_signal_ids`.
- Context revisions are ordered by `changed_at`, have stable IDs, state a concrete change reason, and satisfy the previous-manifest immutable-prefix check.
- `current_view` and `updated_at` exactly match the latest revision; neither may be replaced without an appended revision.
- Every public Signal has a matching approved private source-read receipt with a usable claim locator.
- HTML is rejected from public text fields; titles, facts, notes, caveats, labels, credits, rights fields, and Context fields render as plain text in MVP.
- Unknown fields fail validation so private metadata cannot hitchhike into production.

---

## 11. Retention and retrospective access — LOCKED

AOIFUTURE News preserves its own public editorial record. It does not become a mirror of the external web.

### Long-lived public record

Retain for as long as AOIFUTURE News remains an operating publication:

- published Daily Editions;
- the minimal public Signal fields defined in this contract;
- Active Context current views and public revision histories;
- correction, supersession, withdrawal, and source-unavailable states;
- the public editorial method and material policy revisions.

These records explain what AOIFUTURE published and how its interpretation changed. Removing an item from the current front page does not delete its dated public record. Legal, privacy, safety, or rights obligations may still require redaction or removal; such action is recorded when it is safe and lawful to do so.

### Not retained as a public archive

Do not retain or publish merely to support retrospective browsing:

- copied external article bodies or RSS payloads;
- generated intermediate summaries, prompts, or hidden reasoning;
- rejected candidates and private editorial notes;
- internal ranking/model scores, local paths, account identifiers, or credentials;
- reader-level behavioral profiles;
- third-party images without a documented right to host them.

A broken source link does not authorize copying the source body. The minimal Signal record remains and is marked with the latest verified availability state.

### Private operational evidence

Private exporter, validation, rights, and deployment evidence follows a separate bounded retention policy based on operational, legal, and security need. MVP does not invent one universal duration. The Phase 1 contract must name each private artifact class, its purpose, owner, deletion condition, and deletion/readback verification. Keep the shortest period that still supports correction, rollback, and incident review.

### Retrospective navigation

Readers can go backward through:

- **By Edition:** what appeared on a date;
- **By Context:** current view, revisions, and “How we got here”;
- **By Topic or Source:** published Signals sharing a subject or publisher.

Search and filtering operate on AOIFUTURE's minimal public metadata and editorial text, not mirrored source bodies. Historical access must not imply that an old Signal remains current; Context pages distinguish current view, superseded view, correction, and unresolved state.

---

## 12. Editorial-to-web architecture

### Current repository facts

- Astro 6, React 19, Tailwind 4, Vercel adapter
- `output: 'server'`
- no existing `/news/` route
- no existing Astro content collection configuration
- Vercel Analytics and consent-gated GA4 are already present in `src/layouts/Layout.astro`
- AOI Design System v2 tokens and accessibility media queries live in `src/styles/global.css`
- the repository currently declares Design System v2.0.0; a separately mentioned v2.2.0 has not been proven integrated here and must not be assumed during News implementation
- `astro.config.mjs` and the default canonical use the non-`www` host, while the live root currently redirects to `https://www.aoifuture.com/`; the canonical-host mismatch must be resolved before News launch

### Recommended MVP architecture — DESIGN CHOICE

```text
Private DailyNews workspace
  └─ explicit curated selection
      └─ exporter + strict schema validation
          └─ public edition JSON
              └─ narrow Git branch / review
                  └─ aoifuture-web build
                      └─ /news/ + archive + feed
```

The private workspace never becomes a runtime dependency of Vercel. iCloud/Obsidian availability cannot take down the public page.

### Proposed repository map — DESIGN CHOICE

```text
src/
  components/news/
    NewsDeskHeader.astro
    NewsLead.astro
    NewsCard.astro
    NewsThreadFilter.astro
    NewsActiveContext.astro
    NewsContextHistory.astro
    NewsDetour.astro
    NewsArchiveNav.astro
    NewsMethodLink.astro
  content/
    news/
      editions/
        2026-07-23.json
      contexts/
        agent-authority.json
  layouts/
    NewsLayout.astro
  lib/news/
    schema.ts
    load-editions.ts
    feed.ts
  pages/news/
    index.astro
    [date].astro
    archive/index.astro
    context/[slug].astro
    feed.xml.ts
    method.astro
  styles/
    news.css
scripts/
  validate-news-editions.mjs
  validate-news-state-transition.mjs
  import-news-edition.mjs
schemas/
  aoi-news-edition-v1.schema.json
  aoi-news-context-v1.schema.json
  aoi-news-source-read-v1.schema.json
tests/
  news-schema.test.ts
  news-context-history.test.ts
  news-source-read-receipt.test.ts
  news-render.test.ts
  news-feed.test.ts
  news.spec.ts
```

Astro's exact content-layer API should be confirmed against the installed Astro 6 version during implementation. If content collections create unnecessary coupling for generated JSON, `src/data/news/editions/` plus a typed loader is acceptable. The public schema and validation invariants matter more than the folder mechanism. Because this repository uses `output: 'server'`, implementation must also prove how dated manifests become sitemap entries; a dynamic route alone is not evidence that `@astrojs/sitemap` will discover them.

The MVP routes should be explicitly prerendered from reviewed manifests. News must not add a request-time dependency on FreshRSS, Obsidian, iCloud, or external source pages. The existing homepage `Navigator.tsx` also needs one deliberate `NEWS` entry or an equivalent discoverable route; this specification does not authorize a broader homepage redesign.

### Export boundary — PLACEHOLDER — REFRESH REQUIRED

The exporter does not yet exist. The spike must decide:

- which reviewed DailyNews artifact is authoritative for selection;
- whether `source_fact`, `aoi_note`, and caveat are authored in a dedicated publication manifest or reviewed there after extraction from the roundup draft;
- how stable IDs are generated without leaking local paths;
- how copyright-safe image metadata is supplied;
- whether the Git handoff is manual PR, authenticated automation, or a deterministic scheduled check.

Recommendation: start with a manually reviewed edition manifest and a deterministic validator. Do not fetch source pages in the public request path. If a later reachability checker accepts arbitrary URLs, it must reject credentials, non-HTTP(S) schemes, loopback/private/link-local destinations, and unsafe redirects. Automate transport only after ten successful editions.

---

## 13. SEO, feeds, and machine readability

### Required — LOCKED

- Canonical URL per edition
- `<title>` and description tied to the edition, not a generic feed phrase
- `NewsArticle` or `CollectionPage` structured data only where fields honestly match
- visible publisher, editorial date, corrected date, and source citations
- one standards-valid RSS or Atom feed with the direct source and AOIFUTURE edition permalink
- sitemap inclusion for published editions
- `robots.txt` remains permissive according to current site policy

### Structured-data caution

The edition is a curated collection, not the original publisher of each linked event. Do not mark every external item as an AOIFUTURE-authored `NewsArticle`. Prefer a `CollectionPage`/`ItemList` at edition level and represent external sources as cited URLs. The method page explains selection and correction rules.

---

## 14. Measurement without engagement distortion

Custom events are not required for launch. Editorial reliability can be evaluated from edition manifests and correction logs without identifying readers. If owner review approves analytics, use this minimal allowlist:

### Optional events — DESIGN CHOICE

- `news_edition_view`
- `news_source_open` with source kind and topic, not full URL query strings
- `news_topic_filter`
- `news_detour_open`
- `news_archive_open`
- `news_feed_subscribe`

### Success metrics

Do not optimize for raw dwell time or endless scrolling. If optional analytics is enabled, use:

- source-open rate per edition;
- percentage of editions with at least one Detour open;
- breadth of source kinds opened;
- return visits to a new edition;
- feed subscriptions;
- correction rate and withdrawn-item rate;
- freshness reliability.

A high source-open rate is not “leakage.” Sending the reader to the source is the product succeeding.

### Privacy — LOCKED

- GA4 custom events must not fire before analytics consent. The existing Vercel Analytics component is not described here as consent-gated and must be reviewed separately before News-specific instrumentation is added.
- No reader profile is needed for ranking.
- Do not send article titles or sensitive query strings when a compact topic/source-kind event is enough.
- Do not put stable reader IDs, source URLs, source titles, referrers, or free-text fields in event payloads.
- Event definitions, retention, consent behavior, and verification must be documented before rollout; otherwise ship without News-specific events.

---

## 15. Accessibility and performance acceptance

### Accessibility — LOCKED

- Logical source order matches visual order.
- Every filter is keyboard operable and has an accessible name.
- A skip link and named page landmarks let keyboard and screen-reader users bypass repeated controls.
- Selected topic is not communicated by color alone.
- Focus ring remains visible against black and glass surfaces.
- Japanese body text is at least 14px with adequate line height.
- Touch targets are at least 44px.
- Image alt describes evidence; decorative graphics use empty alt.
- Reduced motion and reduced transparency follow OS preferences.
- The core page remains useful without JavaScript.
- Dates use machine-readable `<time datetime>` and visible JST context.
- Source-title language changes use `lang`; truncation must not hide claim-changing words or caveats.
- Collapsible AOI notes use native disclosure semantics or an equivalent tested name/state relationship.

### Performance — DESIGN CHOICE

Initial targets for the latest edition on a mid-range mobile connection:

- text and source links render server-side;
- JavaScript is limited to filtering, optional disclosure enhancement, and existing site analytics/transition behavior;
- no card-level React hydration by default;
- image dimensions are fixed to avoid layout shift;
- latest edition HTML remains useful if image loading is disabled;
- Lighthouse targets are used as diagnostics, not as the only acceptance proof.

Concrete byte and Core Web Vitals budgets require implementation measurement.

---

## 16. MVP scope

### In MVP

- Latest and dated edition routes
- At least one Active Context backed by published Signals
- Context history showing the current view first and “How we got here” below it
- 6–12 curated source-first items per normal edition
- Lead/major/brief/detour/watch roles
- Topic filtering
- Visible source kind, publisher, date, source fact, AOI note, and caveat
- Direct source links
- Archive navigation
- retrospective navigation by edition, Context, topic, and source
- Public feed
- Method and correction page
- Strict public schema, validator, and last-known-valid behavior
- Responsive, keyboard-accessible layout
- Optional privacy-reviewed analytics; not a launch blocker

### Explicitly out of scope

- User accounts, saved articles, or personal reading history
- Comments, reactions, voting, or community moderation
- Personalized ranking
- Full-text mirroring or scraping of source articles
- AI-generated audio or automatic podcast
- Real-time breaking-news ticker
- Dedicated `Latest Delta` surface until Phase 1 defines stable Signal identity and deterministic change derivation
- Paid placements or native advertising
- Multilingual full-page translation
- Native mobile app
- Automatic public publishing directly from an LLM or FreshRSS
- Rebuilding the AOIFUTURE homepage navigation beyond the link needed to reach `/news/`

---

## 17. Alternatives considered

### A. Copy The Front Page's newspaper layout

**Rejected.** It gives immediate density, but the ornament would dominate AOIFUTURE's identity and imply an editorial institution that the product is not trying to imitate. The reusable principle is the whole-page overview, not the broadsheet costume.

### B. Publish the existing DailyNews roundup as a blog

**Rejected as the primary interaction.** The roundup is useful prose, but it collapses several sources into a linear article. It does not let the reader scan, compare, or take a direct detour. The roundup can link to the edition or be derived from it later.

### C. Expose FreshRSS or current internal JSON directly

**Rejected.** Internal artifacts contain workflow-specific fields, unstable schemas, and potentially private or copyrighted material. Public publication needs an allowlisted schema and an explicit editorial state transition.

### D. Build a live server-side aggregator

**Deferred.** Live aggregation adds availability, abuse, caching, SSRF, and source-rights complexity before the editorial product is proven. A validated static edition keeps the first release legible and reversible.

### E. Use popularity or model scores to size cards

**Rejected.** It recreates the incentives the product is meant to escape and makes unexplained model output part of visible editorial authority. Card role must be an explicit editorial choice.

---

## 18. Delivery phases and gates

### Phase 0 — Product approval

Deliverables:

- this specification;
- owner decisions on route name, edition size, topic set, Detour, and source/AOI separation;
- confirmation of whether editions are Japanese-only at launch.

Gate: Shugo approves or revises the product meaning. No implementation proceeds merely because this document exists.

### Phase 1 — Feed contract spike

Deliverables:

- one redacted, public-safe edition manifest built from a real DailyNews day;
- one public-safe Active Context represented as previous and candidate manifests with at least one valid appended revision backed by published Signal IDs;
- JSON Schemas plus single-manifest, cross-manifest transition, global reference-closure, and source-read receipt validators;
- one approved private source-read receipt per sample Signal, using claim locators without copied source bodies;
- negative tests proving private fields, unknown fields, unsafe HTML, invalid URLs, duplicate/global-ID reuse, unresolved or one-way references, withdrawn current support, prior-revision mutation/reordering/deletion, mismatched `current_view`/`updated_at`, and missing/rejected source-read receipts fail;
- source reachability and correction semantics;
- an artifact retention ledger naming each public/private class, purpose, owner, deletion condition, and verification;
- exact handoff procedure from DailyNews to the repo.

Gate: Engineer → Debug → Reviewer. The sample must contain no local paths or internal scores.

### Phase 2 — Static prototype

Deliverables:

- `/news/` and one dated edition in an isolated worktree;
- `/news/context/[slug]/` and retrospective archive navigation;
- desktop/mobile responsive layout;
- no-JS source-link readback;
- topic filter and Detour interaction;
- focused unit and Playwright tests;
- build output.

Gate: visual review on desktop and mobile plus accessibility smoke.

### Phase 3 — Editorial pilot

Deliverables:

- 10 consecutive or representative editions;
- publication time, correction, editorial effort, and freshness observations;
- aggregate source-open and Detour-open observations only if optional analytics passed the privacy gate;
- editorial effort log without private content;
- decision on automation level.

Gate: prove the desk can be maintained without turning DailyNews into a second full-time publication operation.

### Phase 4 — Launch

Deliverables:

- independent Reviewer PASS;
- SEO/feed/public structured-data readback;
- production preview checks;
- rollback to last-known-valid edition;
- explicit merge/deploy approval.

Production publication is a separate approval boundary.

---

## 19. Acceptance checklist

### Product

- [ ] The page can be understood without knowing DailyNews or FreshRSS.
- [ ] The direct source is the primary action.
- [ ] Facts, AOI notes, and caveats are visually and semantically distinct.
- [ ] The edition is finite and dated.
- [ ] One credible path to serendipity exists without behavioral profiling.
- [ ] Current Context is visible before its chronology, and every revision names its supporting public Signals.
- [ ] Readers can trace a current view backward without exposing copied source bodies or private editorial data.

### Editorial integrity

- [ ] Every item identifies publisher and source kind.
- [ ] Every public Signal has an approved private source-read receipt with a claim locator that a reviewer can reopen.
- [ ] Primary sources are preferred and duplicate syndication is collapsed.
- [ ] `watch` items carry claim-adjacent caveats.
- [ ] Corrections and withdrawals are visible.
- [ ] Superseded Context views remain attributable and are not silently rewritten.
- [ ] Private workflow fields cannot pass schema validation.

### UX and accessibility

- [ ] Visual order and DOM order match.
- [ ] Desktop overview and mobile readability both work.
- [ ] No infinite scroll or horizontal mobile card rail.
- [ ] Filters work by keyboard and without color-only state.
- [ ] Reduced motion/transparency settings are respected.

### Technical

- [ ] DailyNews/iCloud is not a production runtime dependency.
- [ ] Last known valid edition survives exporter failure.
- [ ] Schema tests include negative leakage cases.
- [ ] Cross-manifest tests prove immutable revision prefixes and exact latest-view/timestamp equality.
- [ ] Global reference tests close every Signal/Context edge bidirectionally and apply withdrawn-reference rules.
- [ ] Retention tests reject raw source bodies and unresolved private references from public manifests.
- [ ] The selected RSS/Atom feed and sitemap are valid, including dated editions and Context routes.
- [ ] Build and Playwright checks pass from an isolated worktree.

---

## 20. Owner decisions

### Approved on 2026-07-23 — LOCKED

- AOIFUTURE News includes both finite Daily Editions and dynamic Active Contexts.
- Editorial framing centers on change over time and the context needed by AI-agent operators.
- Readers can move backward by edition, Context, topic, and source; chronology is available but is not the only organizing principle.
- Published Daily Editions, minimal Signals, Context revisions, corrections, and withdrawals form the long-lived public editorial record.
- Copied source bodies, RSS payloads, intermediate generation, rejected candidates, private notes, and reader-level profiles do not become a permanent public archive.
- Old Context interpretations are retained as attributable revisions rather than silently overwritten.

### Decisions still requested

These decisions change product meaning and should be settled before implementation:

1. **Public name:** `AOIFUTURE News` or a more distinctive label such as `AOIFUTURE Signal Desk`?
2. **Launch language:** Japanese only, bilingual metadata, or separate Japanese/English editions?
3. **Edition rhythm:** one fixed daily edition, rolling updates with a daily close, or weekday-only?
4. **Normal size:** recommended 6–12 items; should the upper bound be stricter?
5. **Detour:** keep the explicit adjacent item, or let the full grid carry serendipity without a named module?
6. **AOI note visibility:** always visible, or collapsed on compact cards?
7. **Publication authority:** which exact reviewed DailyNews artifact becomes the source for the public edition manifest?
8. **Canonical host:** should public News URLs use `www.aoifuture.com` to match the current live host, or should the site redirect and canonical configuration be normalized to non-`www`?
9. **AI crawler policy:** should News be added to `public/llms.txt`, and under what citation/reuse statement?

## 21. Recommended defaults

If implementation had to start without another design meeting, use these defaults:

- public name: **AOIFUTURE News**; use `Dynamic Context Desk` only as the internal design concept;
- route: `/news/`;
- language: Japanese UI and annotation, original source titles retained;
- rhythm: one daily edition with material corrections during the day;
- size: 8 items typical, 12 maximum, no minimum padding;
- one optional Detour;
- AOI note visible on lead/major cards and collapsible on brief cards;
- manual reviewed manifest for the first ten editions;
- no automatic publish from FreshRSS, LLM output, or Obsidian.

That is enough to build a useful first edition without pretending the whole publishing machine is already solved.
