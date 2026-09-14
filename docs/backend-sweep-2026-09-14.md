# Backend sweep — September 14, 2026

## Implemented

- Firebase REST requests now have a 20-second default deadline and retain caller cancellation.
- Customer/support listings follow all Firestore page tokens. Repeated tokens fail visibly; document identity cannot be replaced by a stored `id` field.
- Customer synchronization rejects overlapping runs and stops applying fetched results when the session or local store changes.
- Restore validation rejects malformed collection types, null records, and missing account collections before replacing the current store. Older stores may omit newer optional collections.
- Support bundles no longer contain the raw database, password hashes, verification records, or provider token caches. Optional store diagnostics contain only schema, timestamps, collection counts, sync status, and toggles. Existing customer/task/audit exports still contain operational information and must be handled privately.
- Billing requires a verified email and a valid administrator workspace.
- Checkout reservations and one-time trial claims use Firestore transactions. Existing subscriptions cannot start another paid plan through checkout. Checkout uses an idempotency key and explicit expiry; definitive request errors release the reservation, while ambiguous network errors retain it until expiry.
- Webhook handling limits entitlement changes to supported subscription events; refund events cannot replace subscription identity. Invoice parent metadata is supported. Subscription updates retain actual Stripe status instead of treating every update as paid.
- Webhook receipts, billing changes, and member licenses commit together. Duplicate or older events cannot repeat license side effects; canceled subscriptions cannot be reactivated by late events for the same subscription. Processing failures return a retryable server error, distinct from invalid signatures.
- Trial expiration rechecks current billing in a transaction. License reconciliation reads current billing rather than applying potentially stale arguments.
- Compatible dependency updates resolve the production advisories found in adm-zip, js-yaml, and nodemailer.

## Verification and delivery

Run `node --test scripts/backend-sweep.test.cjs scripts/stripe-connector.test.cjs` for network, session, export, restore, webhook, and concurrent billing regression checks. Cloud tests simulate Firestore transactions and Stripe responses; they are not live payment acceptance tests.

The desktop build is packaged separately in `release-backend-sweep-final-0.3.13/win-unpacked`. The isolated packaged-code startup check is `node scripts/smoke-backend-sweep.cjs`. This sweep does not update the installed app, public download feed, or deployed billing Functions.

## Follow-up boundaries

- Cloud deployment, test-mode payment acceptance, and trusted Windows signing remain external release gates. Do not infer production billing readiness from local tests.
- Cancellation/refund recovery now checkpoints the refund amount and source payment intent before Stripe side effects, allowing a later retry after an ambiguous refund failure. A live test-mode cancellation/refund run is still required before enabling the production path.
- License updates now reject workspaces above 450 profiles rather than silently partially updating them. Larger organizations need a resumable reconciliation job.
- Event timestamp ordering reduces late-delivery regressions; a full Stripe reconciliation process is still needed for ambiguous equal-timestamp events and operator changes outside this application.
- Restore shape validation is not a complete per-record schema migration. Cloud conflict detection for simultaneous customer edits and automatic shared-token refresh remain further work.

## References

- [Firestore paginated document listing](https://firebase.google.com/docs/firestore/reference/rest/v1/projects.databases.documents/listDocuments)
- [Stripe webhook delivery, retries, and event ordering](https://docs.stripe.com/webhooks?lang=node)
