# OverHead 0.3.14 — 90-day trials and retained account data

Published September 15, 2026 (America/New_York).

- Standard Gold free trials last 90 days. Existing free trials extend from the original start date; canceled or paid subscriptions are not restarted.
- Trial expiration changes billing/license access only. It does not delete profiles, customers, or workspace information.
- Desktop persistence flushes its temporary file before replacement and retains the previous successful store as `.bak`. Unreadable or malformed stores fail visibly without replacement. Legacy migration retains its source until the secure save succeeds.
- Desktop workspace/profile creation now uses one atomic Firestore commit. Website signup cleanup checks the server before deleting an uncommitted Auth identity; uncertain network outcomes preserve the identity.

## Release and deployment

The standard Windows release is `release-trial-0.3.14`. The published installer, portable ZIP, update manifest, and checksums were downloaded and verified. Packaged startup passed with isolated user data. Existing installations receive these desktop fixes after updating to 0.3.14. Cylinder's separate release was not replaced.

The no-card service is deployed as the `trials` Firebase codebase using `firebase.trials.json`. Regenerate its staged source with `node scripts/prepare-trial-service.cjs`, install its dependencies, and deploy that config. The source generator omits payment parameters and the payment endpoint so missing Stripe configuration cannot block trials. Paid Stripe billing remains separately configured through `functions/index.js`; do not deploy duplicate trial exports through the default codebase.

The trial endpoint is publicly invokable at the transport level and requires a verified Firebase identity plus active workspace Administrator permission in application code. The scheduled expiry service allows invocation by its service account. The Google Cloud default compute service account was given Cloud Build Builder and Datastore User for function build/runtime; the prior IAM policy is recorded in the release directory.

## Verification

- Backend, trial concurrency/migration, local storage, and website signup cleanup tests passed.
- Live temporary-account test proved exact 90-day activation, old-trial extension, expiry, and profile/customer retention. Temporary records were removed. Existing profiles were compared before and after and were unchanged.
- The scheduled task was invoked successfully. Two existing workspaces had no free-trial billing records requiring migration.
- Evidence: `live-trial-retention.json`, `existing-trials-verified.json`, `smoke-result.json`, release verification output and Hosting release records in the release directory.

Build observations: lint retained existing warnings; the website export completed despite a pre-existing Next lockfile patch warning. No real user's sign-in credentials or profile contents were printed or changed during verification.
