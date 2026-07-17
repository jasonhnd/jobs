# Newsletter production smoke test

This runbook is the release gate for the shared footer newsletter card and the
production Resend audience integration.

## Current status

Do not execute this test from a pull-request Preview. The UI and API contract
are covered there with intercepted, reserved `.invalid` addresses. The real
audience-write smoke must run after the change reaches production, using an
owner-approved controlled inbox. Keep issue #172 open until the evidence below
is recorded.

## Preconditions

- `RESEND_API_KEY`, `RESEND_AUDIENCE_ID_JA`, `PUBLIC_TURNSTILE_SITE_KEY`, and
  `TURNSTILE_SECRET_KEY` are configured for the production deployment.
- The tester can inspect the configured Japanese audience in Resend.
- The tester has an inbox or disposable alias controlled by the project owner.
  Never use a visitor, customer, or unrelated personal address.

## Procedure

1. Open a production occupation page on `https://mirai-shigoto.com` and locate
   the `月次レポート` card in the footer.
2. With browser developer tools recording the Network panel, submit the
   controlled address once. Do not paste the address into an issue, log,
   screenshot, analytics tool, or shell history.
3. Confirm exactly one `POST /api/subscribe` request returns HTTP 200 with
   `{ "ok": true }`. A repeat test may additionally return
   `alreadySubscribed: true` and is still an idempotent success.
4. In Resend, confirm the contact appears in the Japanese audience. Verify the
   occupation context matches the page and the attribution value is
   `header_t1`.
5. In GA4 DebugView (or the captured browser event), confirm one
   `email_submit_header` event contains only `language`, `success`, and
   `error_reason`. Confirm the address is absent.
6. Remove or unsubscribe the controlled contact immediately after verification
   unless the owner explicitly wants it retained for the next real campaign.

## Evidence to record on issue #172

- Production deployment SHA and test time (JST).
- Page path and HTTP status, without the address.
- Resend audience-write result and whether occupation/source fields matched.
- GA4 event field names and explicit confirmation that no email was present.
- Cleanup result.

If any step fails, record only the stable error code and deployment SHA, leave
the issue open, and retry after the production configuration is corrected.
