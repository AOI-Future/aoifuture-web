# Contact & Consultation OS intake operations

## Purpose and endpoints

The shared intake contract accepts contact requests from AOI Future and the related first-party sites:

- `POST /api/contact-intake` — canonical shared endpoint.
- `POST /api/consultation-intake` — compatible URL alias using the same handler and contract.
- `/consulting/intake` — preserved detailed two-step, six-question Work Consultation UX.
- `/contact` — simple AOI Future general contact form when the native intake feature is enabled.

The API validates exact origin, JSON/body size, schema, honeypot, minimum dwell, optional Turnstile, idempotency and low-volume rate limits before creating a page in the configured Notion data source. It does not use an LLM, fetch submitted URLs, automatically accept work, send confirmation email, or copy free text to notifications.

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

The live data source also contains operational properties `Discord Thread`, `Last Instruction`, and `Decision`. The intake writer intentionally leaves those unset for the watcher/human triage workflow. Defaults written on creation are Status `New`, Priority `P2`, Owner `Shugo`, and Notification Status `Pending`. `Pending` is required so the existing Discord watcher can claim and alert on a new record.

Stage options are `Deciding where to start`, `Trial not adopted`, `Workflow review`, `Moving to operation`, `Aligning team decisions`, and `Unclear / Other`. Stage is omitted from generic Notion rows when absent from the request.

Notion remains the low-volume MVP control plane. An exact `Idempotency Key` lookup plus the server-side semantic `Payload Fingerprint` distinguishes a safe retry from a changed request (`409 idempotency_conflict`; a legacy row with no fingerprint also conflicts). After creation, the writer re-queries the key, chooses the deterministic earliest page as canonical, and best-effort trashes the page it just created if it lost a race. Notion still provides no atomic uniqueness constraint, so this reduces rather than eliminates every possible high-concurrency race. `Email` + `Received At` (3/day) and global `Received At` (30/hour) queries provide basic rate controls.

## Logging and notifications

Structured logs contain only the receipt prefix, Source, Inquiry Type, optional Stage, outcome/status, and latency bucket. They must not contain name, email, organization, article URL, situation/free text, IP, user agent, tokens, or Notion response bodies.

The existing model-free watcher consumes records with Notification Status `Pending`. Discord alerts contain operational metadata and a Notion link only—not contact details or submitted free text. The watcher owns later status transitions and the `Discord Thread`, `Last Instruction`, and `Decision` fields.

## Enablement checklist

1. Create a separate preview data source with the exact schema and grant the preview integration access.
2. Set preview origins and credentials; keep `CONSULTATION_NATIVE_FORM_ENABLED=false` in production.
3. If Turnstile is used, set both keys and test hostname validation. Set `CONSULTATION_REQUIRE_TURNSTILE=true` only after both exist; this mode fails closed.
4. Submit synthetic, non-PII examples through both API paths. Verify Source, Inquiry Type, optional Stage/Article URL, due date, retention review, and Notification Status `Pending`.
5. Retry the same request/idempotency key and verify the same receipt with no additional durable page. Change a normalized business field while retaining the key and verify `409 idempotency_conflict`; also verify a mismatched header/body key returns `409`.
6. Exercise an allowed cross-origin preflight, bad origin, honeypot, short dwell, rate limit, and Notion outage. An outage must show no success and retain browser values.
7. Review Vercel logs for the PII-free field allowlist above. Confirm the watcher alerts and updates notification status without copying PII/free text.
8. Obtain explicit approval, enable the production flag, deploy, run one synthetic canary, then delete it.

## Daily operation, retention, and incidents

- Review `New` items each business day; update Last Contact, status, next action, Last Instruction, and Decision manually as appropriate.
- For unaccepted/inactive inquiries, review and delete at `Retention Review At` (90 days from last contact). If contact continues, update Last Contact and the review date.
- For accepted work, transfer only necessary facts to the client record and delete the original intake 30–90 days after contract start.
- Deletion/access requests sent to `legal@aoifuture.com` are located by receipt ID or verified email and completed in Notion without copying the inquiry text.
- For an incident, set `CONSULTATION_NATIVE_FORM_ENABLED=false` and redeploy, rotate the Notion token if needed, preserve only minimal receipt/time/status evidence, and notify affected people or authorities when legally required.

The primary rollback is the feature flag; it does not delete existing Notion records. Keep `PUBLIC_CONSULTATION_FALLBACK_URL` valid and remove unused secrets only after confirming the fallback works.
