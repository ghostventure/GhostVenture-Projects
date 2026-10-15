# FoxHub network UX and Stripe webhook stability — October 15, 2026

Firebase project: `foxhub-c984b`.

## Changes

- **Member connection feedback:** the authenticated shell listens for browser
  `offline` and `online` events. It displays an accessible status notice while
  offline and a short reconnect message for 4.5 seconds after connectivity
  returns. The notice follows the active theme. This is browser connectivity
  feedback; it does not confirm that pending writes have synced successfully.
- **Lazy-chunk recovery:** when `sessionStorage` is blocked, a one-time URL
  marker provides the stale-chunk reload guard. The app shell removes the marker
  after loading to avoid a repeated reload loop.
- **Stripe webhook validation:** both the Firebase Functions webhook and the
  Next API webhook verify the Stripe signature before processing, reject
  malformed event payloads, and use a Firestore transaction to deduplicate
  event IDs. Recorded event metadata is limited to identifiers and status
  fields rather than the full billing payload. Subscription events also create
  a billing event record.

## Source map

- `src/FoxHubShell.jsx`, `src/styles/refresh.css`: connection status behavior
  and theme-aware notice.
- `src/runtimeReliability.js`: lazy-chunk retry and one-time URL fallback when
  `sessionStorage` is unavailable, with marker cleanup after shell load.
- `functions/index.js`: Firebase Functions Stripe webhook.
- `app/api/stripe/webhook/route.js`: Next API Stripe webhook.
- `app/api/_server/foxhub-server.js`: shared Next API signature verification.

## Validation and deployment status

The JavaScript syntax checks and both Vite and Next production builds passed.
`npm test` passed: 34/34 tests. Focused runtime reliability tests passed 4/4.
No live webhook requests were run.

## Deployment status — October 15, 2026

Hosting was deployed to `foxhub-c984b` at `https://foxhub-c984b.web.app`.
The Hosting version ID was not captured.

Post-deploy smoke passed on production at 390px and 1440px for public pages,
sign-in, password recovery, and footer behavior, with no JavaScript errors.
Routes `/`, `/signin`, `/management`, `/feedback`, and `/android/` all returned
HTTP 200. The deployed shell and CSS contain the offline and reconnect behavior.
The authenticated member layout was not exercised. This smoke did not validate
live Stripe webhook behavior.

The Stripe webhook backend code was not deployed: the Cloud Functions API is
disabled in `foxhub-c984b`, and the current account receives HTTP 403 for
Functions and Hosting on `foxhub-superapp`. Enable the API or resolve project
access before deploying backend changes. A valid `STRIPE_WEBHOOK_SECRET` must
also be configured in each webhook runtime. No secret values belong in this
document.

## Follow-up

Before deploying the webhook backend, verify invalid-signature,
malformed-payload, and duplicate-event responses against a safe test setup,
then deploy the intended backend target and run live webhook checks.
