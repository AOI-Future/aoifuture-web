# Consultation intake operations

## Purpose and architecture

`/consulting/intake` sends a bounded six-question JSON request to `/api/consultation-intake`. The API validates origin, body size, schema, honeypot, minimum dwell and optional Turnstile before querying and creating a page in the configured Notion data source. No LLM, URL fetch, attachment, automatic acceptance decision, confirmation email, or free-text notification is used.

Notion is the MVP control plane: an exact `Idempotency Key` query prevents ordinary retry duplicates; `Email` + `Received At` (3/day) and global `Received At` (30/hour) queries provide low-volume rate controls. This is intentionally not a high-concurrency admission system.

## Required Notion schema

Configure `NOTION_CONSULTATION_DATA_SOURCE_ID`; never hardcode it or the token. The integration must have access only to the consultation data source. Property names are exact: `Name`, `Status`, `Priority`, `Owner`, `Next Action`, `Next Action Due`, `Stage`, `Email`, `Display Name`, `Organization`, `Situation`, `Desired Takeaway`, `Receipt ID`, `Idempotency Key`, `Source`, `Received At`, `Last Contact`, `Retention Review At`, `Consent Version`, `Notification Status`, `Security Flags`.

Stage options: `Deciding where to start`, `Trial not adopted`, `Workflow review`, `Moving to operation`, `Aligning team decisions`, `Unclear / Other`. Defaults are Status `New`, Priority `P2`, Owner `Shugo`.

## Enablement checklist

1. Create a separate preview data source with the exact schema and grant the preview integration access.
2. Set preview origins and credentials; keep `CONSULTATION_NATIVE_FORM_ENABLED=false` in production.
3. If Turnstile is used, set both keys and test hostname validation. Set `CONSULTATION_REQUIRE_TURNSTILE=true` only after both exist; this mode fails closed.
4. Submit synthetic, non-PII text. Verify every property, the two-business-day due date, 90-day retention review, and Notion owner notification.
5. Retry the same request/idempotency key and verify the same receipt with no additional page.
6. Exercise a bad origin, honeypot, short dwell, rate limit and Notion outage. An outage must show no success and retain browser values.
7. Review Vercel logs: only receipt prefix, stage, result/status and latency bucket may appear.
8. Obtain explicit approval, enable the production flag, deploy, run one synthetic canary, then delete it.

## Daily operation and retention

- Notion automation/filtered views are the owner notification mechanism. No consultation free text is sent to Discord.
- Review `New` items each business day; update `Last Contact`, status and next action manually.
- For unaccepted/inactive inquiries, delete at the `Retention Review At` review (90 days from last contact). If contact continues, update Last Contact and the review date.
- For accepted work, transfer only necessary facts to the client record and delete the original intake 30–90 days after contract start.
- Deletion/access requests sent to `legal@aoifuture.com` are located by receipt ID or verified email and completed in Notion. Record completion without copying the consultation text.

## Incident response

1. Set `CONSULTATION_NATIVE_FORM_ENABLED=false` and redeploy; `/consulting` returns to the fallback URL and the API returns `503 intake_disabled`.
2. Revoke/rotate the Notion token if exposure is suspected and review integration access plus Notion page history.
3. Preserve only minimal receipt/time/status evidence needed for investigation; do not paste request bodies into tickets or chat.
4. Notify affected people and authorities when legally required.

## Rollback

Keep `PUBLIC_CONSULTATION_FALLBACK_URL` valid. Disabling the flag is the primary rollback and does not delete existing Notion records. For code rollback, revert the intake commit after disabling; remove unused secrets only after confirming the fallback works.
