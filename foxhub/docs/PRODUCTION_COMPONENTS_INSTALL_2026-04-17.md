# FoxHub Production Components Install (2026-04-17)

## Request

Square in the next relevant FoxHub platform components and make sure they are functional.

## Result

Completed as an additive production-readiness layer.

- Added `@capacitor/push-notifications` to the root app for native iOS/Android push wiring.
- Added a Services room tab named `Production`.
- Added a 12-component production registry covering backend authority, push, storage, identity, RBAC, payments, search, mini-app sandboxing, maps/local commerce, moderation, analytics, and smoke tests.
- Added `Activate` and `Run` controls for every production component.
- Each run now creates a concrete operational record, not only a visual status.
- Production component state is preserved in local mode and included in Firebase user-state persistence.
- Firestore rules now allow the new production-readiness arrays with bounded list sizes.
- Functions now expose backend entry points for production operations and push delivery requests.

## Components Added

- Server-owned backend
- Native push delivery
- Media and document storage
- Phone and identity hardening
- Custom claims and RBAC
- Payment webhook controls
- Backend search indexing
- Mini-app sandbox SDK
- Maps and local commerce
- Moderation pipeline
- Analytics warehouse export
- Regression smoke pack

## Functional Behavior

Each production component supports:

- `Activate`
  - marks the component active
  - creates a production event
  - queues a reliability mutation
  - sets a production feature flag in the analytics hub
- `Run`
  - creates a component-specific output record
  - writes an audit event
  - writes a notification event
  - updates the component run count and last-run timestamp

Output record families:

- `serverJobs`
- `pushDeliveries`
- `storageObjects`
- `authHardeningChecks`
- `rbacAssignments`
- `paymentWebhookEvents`
- `searchIndexJobs`
- `miniAppSandboxSessions`
- `geoIndexRecords`
- `moderationPipelineCases`
- `analyticsExports`
- `smokeTestRuns`

## Backend Functions

Added:

- `productionOpsWebhook`
  - accepts trusted production operation events
  - writes global `productionOpsEvents`
  - optionally mirrors events to `users/{uid}/productionOpsEvents`
- `pushDeliveryRequest`
  - accepts push delivery requests
  - writes `pushDeliveryRequests`
  - sends through Firebase Admin Messaging when an FCM token is supplied

Both endpoints support `FOXHUB_OPS_WEBHOOK_SECRET`. If the secret is configured, callers must send either:

- `Authorization: Bearer <secret>`
- `x-foxhub-ops-secret: <secret>`

## Files Changed

- `package.json`
- `package-lock.json`
- `src/useFoxHubStore.js`
- `src/App.jsx`
- `src/FoxHubShell.jsx`
- `src/styles.css`
- `src/repository-firebase.js`
- `firestore.rules`
- `functions/index.js`

## Verification

- `node --check functions/index.js` passed.
- `npm run build` passed.
- `npm test` passed.
- `npm audit fix` applied the non-breaking security updates available after the push package install.

## Remaining Audit Note

`npm audit --audit-level=moderate` still reports the Vite/esbuild development-server advisory. The available npm fix requires `npm audit fix --force`, which would jump Vite to a breaking major version, so it was not applied in this pass.
