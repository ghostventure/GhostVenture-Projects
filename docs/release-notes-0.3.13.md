# OverHead Desktop 0.3.13

## Release scope

This release completes a backend reliability and desktop UX sweep for the OverHead owner workspace. It keeps the local-first desktop model while making cloud reads, synchronization, billing state, exports, and recovery behavior safer to operate.

## Backend changes

- Added default Firebase request deadlines and preserved caller cancellation.
- Made Firestore list operations follow every page token and reject repeated tokens.
- Kept Firestore document identity derived from the path instead of a stored field.
- Prevented overlapping customer syncs and discarded results when the session or local store changes.
- Validated restore files before replacing local data, including collection types and required account collections.
- Removed raw encrypted stores from support bundles; optional store diagnostics contain metadata and collection counts only.
- Required verified email and an active administrator workspace for billing operations.
- Added transactional checkout reservations and one-time trial claims.
- Added Stripe idempotency keys, checkout expiry, supported-event filtering, parent metadata support, event replay protection, and actual subscription-status handling.
- Added transactional billing/license updates and cancellation/refund retry checkpoints.
- Rechecked billing state before trial expiration and license reconciliation.
- Updated dependencies and confirmed no production audit vulnerabilities.

## Desktop UX changes

- Escape closes the command center and operations drawer.
- The command-bar search affordance now clearly opens commands instead of accepting text that was not searched.
- Operation notices announce through an accessible live region.
- Backend and billing failures use alert semantics.
- Billing controls disable while another billing operation is running, preventing duplicate saves, checkouts, receipts, or refreshes.
- Secure checkout remains disabled until the billing policy is acknowledged.
- Busy button labels explain the operation currently in progress.

## Verification

The following checks passed on Windows:

```text
node -c functions/index.js
node scripts/backend-sweep.test.cjs
npm run lint
npm run build
npm audit --omit=dev
node scripts/smoke-backend-sweep.cjs
```

The regression suite passed 17 tests. The packaged application opened its sign-in window with an isolated profile, confirmed one window, and completed the startup smoke test. The unpacked Windows package is in `release-backend-sweep-ux-0.3.13/win-unpacked`.

## Deployment boundary

This release is committed locally as `6142700`. No Git remote is configured in this checkout, so a GitHub push requires the repository remote URL to be added first.

The Firebase project is configured as `overhead-office`. The site deployment should publish the built `website-deploy` directory with `firebase.overhead.json`, then verify the public home page and download routes. Cloud Functions and live Stripe payment acceptance remain separate release gates because they require the production Firebase/Stripe environment and test-mode transaction validation.

## Remaining work

- Add and verify the GitHub remote, then push the scoped release commit.
- Publish the site and verify the live routes.
- Run a Stripe test-mode cancellation/refund cycle before enabling production cancellation/refunds.
- Complete trusted Windows code signing for installer distribution.
- Add resumable license reconciliation for workspaces larger than 450 profiles.
