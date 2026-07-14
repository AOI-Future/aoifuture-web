# Contact & Consultation OS intake operations

## Purpose and endpoints

The shared intake contract accepts contact requests from AOI Future and the related first-party sites:

- `POST /api/contact-intake` — canonical shared endpoint.
- `POST /api/consultation-intake` — compatible URL alias using the same handler and contract.
- `/consulting/intake` — preserved detailed two-step, six-question Work Consultation UX.
- `/contact` — simple AOI Future general contact form when the native intake feature is enabled.

The API validates exact origin, strictly parsed JSON media type, a streaming 16 KiB body limit, schema, honeypot, minimum dwell, optional Turnstile, idempotency and layered low-volume rate limits before creating a page in the configured Notion data source. It does not use an LLM, fetch submitted URLs, automatically accept work, send confirmation email, or copy free text to notifications.

## Shared request contract (`2026-07-14`)

Required fields are `schemaVersion`, `idempotencyKey`, `source`, `inquiryType`, `situation`, `email`, `consent`, and `antiSpam`. Optional fields are `desiredTakeaway`, `displayName`, `organization`, `articleUrl`, and `stage`.

`stage` is required only when `source=aoifuture.com/consulting/intake` and `inquiryType=Work Consultation`; it remains optional for every other source/type combination. The `Idempotency-Key` header is optional for same-origin forms, but when supplied it must equal the body value.

Allowed Source options:

- `aoifuture.com/consulting/intake`
- `aoifuture.com/contact`
- `nozaki.com`
- `wfhradio.tokyo`
- `dispatch.aoifuture.com`
- `direct`
- `manual`

Allowed Inquiry Type options:

- `Work Consultation`
- `Writing / Contribution`
- `Interview / Speaking`
- `Music / Creative`
- `Article Question / Correction`
- `AOI Future / NICTIA`
- `General / Other`

Default CORS origins are both apex and `www` variants of `aoifuture.com`, `nozaki.com`, and `wfhradio.tokyo`, plus `dispatch.aoifuture.com`. Override them with an exact comma-separated `CONSULTATION_ALLOWED_ORIGINS`; wildcard origins are not supported.

## Required Notion schema

Configure `NOTION_CONSULTATION_DATA_SOURCE_ID`; never hardcode the data source ID or token. The integration must have access only to this data source.

Exact properties used by the writer are: `Name`, `Status`, `Priority`, `Owner`, `Next Action`, `Next Action Due`, `Stage`, `Email`, `Display Name`, `Organization`, `Situation`, `Desired Takeaway`, `Article URL`, `Receipt ID`, `Idempotency Key`, `Payload Fingerprint`, `Source`, `Inquiry Type`, `Received At`, `Last Contact`, `Retention Review At`, `Consent Version`, `Notification Status`, and `Security Flags`. `Payload Fingerprint` must be a `rich_text` property.

The live data source also contains operational properties `Discord Thread`, `Last Instruction`, and `Decision`. The intake writer intentionally leaves those unset for the watcher/human triage workflow. Normal defaults are Status `New`, Priority `P2`, Owner `Shugo`, and Notification Status `Pending`. Deterministically suspicious input is quarantined as Status `Triaging`, Priority `P3`, with allowlisted `Security Flags`; it is not automatically deleted or classified by an LLM. `Pending` is retained so the existing Discord watcher can alert for human review.

Stage options are `Deciding where to start`, `Trial not adopted`, `Workflow review`, `Moving to operation`, `Aligning team decisions`, and `Unclear / Other`. Stage is omitted from generic Notion rows when absent from the request.

Notion remains the low-volume MVP control plane. An exact `Idempotency Key` lookup plus the server-side semantic `Payload Fingerprint` distinguishes a safe retry from a changed request (`409 idempotency_conflict`; a legacy row with no fingerprint also conflicts). After creation, the writer re-queries the key, chooses the deterministic earliest page as canonical, and best-effort trashes the page it just created if it lost a race. Notion still provides no atomic uniqueness constraint, so this reduces rather than eliminates every possible high-concurrency race. `Email` + `Received At` (3/day) and global `Received At` (30/hour) queries provide basic rate controls.

## Abuse and AI-generated harassment controls

The request body is untrusted data even when it resembles system instructions, tool commands, URLs, Markdown, or a conversation transcript. Intake text must never be concatenated into an agent's system/developer prompt. Any future reply-drafting workflow must wrap it as quoted data, disable tools while interpreting it, and require a separate human-approved action for Notion changes or external email. Prompt-injection-like text is not automatically classified as malicious: deterministic transport controls limit abuse, while a human decides intent.

Quarantine signals are intentionally narrow: fast submission, four or more HTTP(S) links, a run of at least 20 repeated non-space characters, or Unicode format/bidirectional controls. In balanced mode, one weak signal is recorded without quarantine; two signals or a manual-review signal move the row to `Triaging`. Until Turnstile is mandatory, fast submission retains the legacy hard reject so a staged deployment does not weaken protection. Fluent prose, unusual opinions, and prompt-injection-like sentences alone are not abuse signals.

Before Turnstile, a process-local L1 gate uses only the Vercel-overwritten, syntactically valid client IP and allows 20 requests/minute per warm instance/IP. Untrusted forwarding headers outside Vercel are ignored. Only after Turnstile succeeds does a second process-local gate apply global 20/minute, IP 5/10 minutes, email 3/day, and idempotency-key 3/10 minutes. IP and email identifiers are SHA-256 digests held only in ephemeral process memory and are never logged. This protects a warm instance and avoids letting invalid challenge tokens poison a victim email/global bucket, but it is not a distributed guarantee.

The production target is defense in depth:

1. Vercel platform DDoS protection and route-level firewall/rate rules when the account plan permits.
2. Cloudflare Turnstile in managed mode on all three public forms, with the token hostname bound to the exact request Origin/source, action `contact_intake`, and Siteverify idempotency validation. Required mode fails closed if either key is absent. Clients discard/reset a consumed token after failure, editing, or success so retries never pair a new idempotency key with an old token.
3. An atomic distributed limiter (for example Upstash Redis) before Notion, keyed by HMAC-digested IP/email plus global 30/hour and daily breakers. Namespaces must separate Preview and Production. At 60 accepted requests/day it emits a PII-free soft warning; over 100/day it fails closed with `503 intake_temporarily_paused`.
4. The existing Notion email/global queries remain only as a compatibility fallback when Redis is not configured. Balanced Production skips them, so rejected/rate-accounting requests do not consume Notion API quota.

Do not run load or DoS tests against production. Verify thresholds against unit tests or Preview, then use at most one synthetic production canary and remove its Notion record.

## Logging and notifications

Structured logs contain only the receipt prefix, Source, Inquiry Type, optional Stage, outcome/status, and latency bucket. They must not contain name, email, organization, article URL, situation/free text, IP, user agent, tokens, or Notion response bodies.

The existing model-free watcher consumes records with Notification Status `Pending`. Discord alerts contain operational metadata and a Notion link only—not contact details or submitted free text. The watcher owns later status transitions and the `Discord Thread`, `Last Instruction`, and `Decision` fields.

## Enablement checklist

1. Create a separate preview data source with the exact schema and grant the preview integration access.
2. Set preview origins and credentials; keep `CONSULTATION_NATIVE_FORM_ENABLED=false` in production.
3. Configure one managed Turnstile widget for the canonical hostnames, set both keys, and test hostname plus action `contact_intake`. Set `CONSULTATION_REQUIRE_TURNSTILE=true` only after all three clients have the public key; this mode fails closed.
4. Configure the distributed limiter URL, token, and a random 32+ byte HMAC secret. Verify it in Preview, then set `CONSULTATION_REQUIRE_DISTRIBUTED_LIMIT=true`; limiter failure must not fall through to Notion.
5. Submit synthetic, non-PII examples through both API paths. Verify Source, Inquiry Type, optional Stage/Article URL, due date, retention review, and Notification Status `Pending`.
6. Retry the same request/idempotency key and verify the same receipt with no additional durable page. Change a normalized business field while retaining the key and verify `409 idempotency_conflict`; also verify a mismatched header/body key returns `409`.
7. Exercise an allowed cross-origin preflight, bad origin, honeypot, quarantine signal, local/distributed rate limit, and provider outage. An outage must show no success and retain browser values.
8. Review Vercel logs for the PII-free field allowlist above. Confirm the watcher alerts and updates notification status without copying PII/free text.
9. Obtain explicit approval, enable the production flags, deploy, run one synthetic canary, then delete it.

## Daily operation, retention, and incidents

- Review `New` items each business day; update Last Contact, status, next action, Last Instruction, and Decision manually as appropriate.
- For unaccepted/inactive inquiries, review and delete at `Retention Review At` (90 days from last contact). If contact continues, update Last Contact and the review date.
- For accepted work, transfer only necessary facts to the client record and delete the original intake 30–90 days after contract start.
- Deletion/access requests sent to `legal@aoifuture.com` are located by receipt ID or verified email and completed in Notion without copying the inquiry text.
- For an incident, set `CONSULTATION_NATIVE_FORM_ENABLED=false` and redeploy, rotate the Notion token if needed, preserve only minimal receipt/time/status evidence, and notify affected people or authorities when legally required.

The primary rollback is the feature flag; it does not delete existing Notion records. Keep `PUBLIC_CONSULTATION_FALLBACK_URL` valid and remove unused secrets only after confirming the fallback works.
