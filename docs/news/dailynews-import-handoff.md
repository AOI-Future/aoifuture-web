# DailyNews to AOIFUTURE News manual handoff

Phase 1 is a report-only/manual import boundary. It does not publish, deploy, fetch source pages at request time, or make the DailyNews workspace a runtime dependency. The readable DailyNews roundup is candidate input, not publication authority.

## Roles and approval boundary

1. The editor selects Signals and writes public-safe `source_fact`, `aoi_note`, and any claim-adjacent `caveat`.
2. A human/editor reopens each direct source and creates one private `aoi.news.source-read.v1` receipt with a specific claim locator. The receipt contains no copied body or hidden reasoning.
3. The web maintainer assembles the candidate bundle with the complete published Edition/Context indexes needed to prove global uniqueness and bidirectional closure.
4. Validation and import produce a staging directory only. Independent Debug and Reviewer gates occur before any merge, deploy, or publication.

## Bundle shape

The private handoff object has exactly these keys:

- `edition`: one candidate `aoi.news.edition.v1` manifest;
- `contexts`: candidate current Context manifests;
- `context_transitions`: exactly one `{ context_id, kind }` declaration per candidate Context, where `kind` is `initial` or `update`;
- `previous_contexts`: the immediately preceding manifest for each updated Context;
- `receipts`: private approved source-read receipts covering every Signal in the validation graph;
- `published_editions`: the complete prior Edition index required for global Signal uniqueness and lineage;
- `published_contexts`: the complete current published Context index before the candidate transition, required for global uniqueness, canonical prior-state proof, and reference closure.

All seven keys are required, including empty complete indexes. An `update` declaration requires exactly one matching immediately preceding Context, and that manifest must exactly match the same ID in `published_contexts`. An `initial` declaration requires no prior or published match and starts with exactly one revision. This explicit state prevents missing or replaced prior history from being interpreted as a first publication. The wrapper is private and short-lived. Only the Edition and candidate Contexts can leave it through the importer.

## Editorial preparation checklist

- Prefer the direct official source, documentation, release, repository, paper, advisory, regulator, or original report.
- Write plain text only. Do not copy article/RSS bodies, HTML, prompts, private notes, local paths, account IDs, credentials, scores, or rejection metadata.
- Keep source fact, AOI note, and caveat distinct. A `watch` or `source-unavailable` Signal must have a caveat.
- Treat `title` as AOIFUTURE's display headline and `source_title` as the source's title.
- Use only HTTPS source URLs without embedded credentials, fragments, or known tracking parameters. The importer strips known tracking parameters and derives `source_domain`; the validator rejects a candidate that is still unnormalized or points to a literal/internal private host.
- Use no source-hosted image. If an image is approved, host a rights-cleared copy at an `https://aoifuture.com/` public asset URL and provide alt, credit, and rights basis together.
- Assign globally unique Signal IDs. Do not reuse an ID in a later Edition.
- Close every Context edge in both directions: a Signal's `context_ids` must exactly match Contexts whose current support or revision evidence cites it.
- Do not place withdrawn Signals in current `supporting_signal_ids`; historical revisions may retain them.
- Preserve the previous revision array byte-semantically after canonical normalization. Append one revision for a meaningful current-view, timestamp, support-set, or operator-context change.
- Declare every candidate Context as `initial` or `update`; never relabel an update as initial or omit its immediately preceding canonical manifest.
- Set `current_view` and `updated_at` exactly to the latest revision's `resulting_view` and `changed_at`.

## Exact local commands

From the repository root:

```sh
npm run test:news-contract
npm run validate:news-contract
STAGE_DIR="$(mktemp -d "${TMPDIR:-/tmp}/aoi-news-stage.XXXXXX")"
node scripts/import-news-contract.mjs \
  --input fixtures/news-contract/non-production/import-bundle.json \
  --output "$STAGE_DIR"
find "$STAGE_DIR" -type f -print | sort
```

Expected sample output paths are only:

```text
$STAGE_DIR/contexts/agent-authority.json
$STAGE_DIR/editions/2026-07-23.json
```

There must be no receipt, previous Context, source body, validation wrapper, or private metadata in staging. The sample is explicitly non-production and must not be copied into a production content directory.

For a real reviewed candidate, replace the `--input` path with the task-owned private bundle and keep `--output` outside public content. Review exact staged files, then copy only approved public JSON to the future canonical content paths. Stage exact paths; never use `git add .` or `git add -A`.

## Failure and last-known-valid behavior

- Validation failure exits nonzero and writes no staging files. The deployed Edition remains untouched.
- Import is local and atomic per output file after whole-bundle validation. It is not a production mutation.
- Unknown fields fail closed rather than being silently dropped.
- Missing/rejected/mismatched receipts fail import.
- Missing, stale, self, duplicate, or one-way references fail import.
- A source reachability crawler is out of scope. The editor supplies the latest check as `verification.status` and `checked_at`; the public record may use `source-unavailable` with a visible caveat.
- An unavailable source does not authorize body copying. Preserve the minimal Signal record and availability state.
- A material factual correction requires `change.kind: corrected`, `corrected_at`, and a visible `correction_note`. Supersession and withdrawal preserve stable IDs and valid lineage.
- A broken/withdrawn Signal cannot remain `lead` or `major`; a withdrawn Signal cannot remain current Context support.

## Repository verification before handoff

```sh
npm run test:news-contract
npm run validate:news-contract
npm run build
git diff --check
git status --short
git diff -- schemas scripts tests fixtures docs/news package.json
```

A passing Engineer self-test is evidence for the next Debug gate, not independent approval and not publication authorization.
