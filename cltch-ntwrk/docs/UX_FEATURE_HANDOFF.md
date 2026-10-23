# Clutch UX feature wave handoff

Date: 2026-10-23

## Release state

The integration branch contains the UX feature work and is locally verified. It is **not deployed to Firebase**. A Functions deployment was attempted against `cltch-ntwrk-social`; Firebase rejected it because the project is not on the Blaze plan. Firestore rules/indexes and Hosting were deliberately not deployed because booking state changes now depend on the deployed Functions endpoints.

The integration also builds against Node.js 20, which the Firebase CLI warned is scheduled for decommission on 2026-10-30. Move the Functions runtime to a supported version and verify it before the next deployment.

## Integrated feature work

- Account deletion request flow with identity recheck and owner-visible status; account export with explicit media and inaccessible-record limits; sensitive-change reauthentication.
- One account can use independent host and performer profiles.
- Timezone-aware weekly performer availability, exact-date exceptions, and DST handling; booking acceptance checks the same policy on the server.
- Public performer review responses and correction requests; performer blocking of hosts; accessible performer comparison.
- Server-controlled booking transitions, transaction receipts for safe retries, audit records, race-safe acceptance, performer check-in, booking amendments, and replacement offers.
- Private per-tab booking note recovery, event-day contact actions, stable message retry, and server-derived unread-message counts.
- Gig search relevance controls and a forward-only host cancellation measure. The latter shows counts and its coverage start date, excludes earlier bookings, and does not create a reputation score.
- Calendar subscription feed implementation is present, but its UI is still gated while the backend is disabled.
- Support request context is partial: users can save bounded context to their account and copy it into email; staff inbox delivery and processing are not connected.

These changes are not all available in production until the Firebase release is completed. Features that depend on missing product or service decisions remain incomplete, including session revocation and new-device alerts, earnings history, notifications/reminders, and cancellation policy calculation. Do not infer cancellation fees or terms; approve the policy contract first.

## Verification

- `npm run smoke:all`: all 62 registered smoke scripts passed on the integration branch.
- `npm run build`: passed.
- `node --check functions/index.js` and `git diff --check`: passed.
- The smoke suite and build validate local source. They do not verify deployed Functions, Firestore rules/indexes, authenticated production behavior, or Hosting.

## Next release steps

1. Enable Firebase Blaze billing for `cltch-ntwrk-social` and review the expected usage/cost controls.
2. Update the Functions runtime from Node.js 20 to a supported runtime and rerun the smoke suite/build.
3. Deploy Functions first; verify the booking action, recurring availability, unread count, calendar, and reliability endpoints.
4. Deploy Firestore rules and indexes; verify authenticated host/performer flows and unread cursor behavior.
5. Deploy Hosting last; verify the public routes and authenticated workflows against the live backend.
6. Keep calendar subscriptions disabled until the Functions endpoint is live. Do not globally clear the backend-disabled setting because it also gates payment functionality.
7. Resolve the cancellation policy and any missing notification, identity, and payment integrations before counting those features as delivered.

## Integration commits

- `94c4826` Update smoke expectations for merged UX features
- `24706bd` Track forward-only host cancellation history
- `f7c85f4` Merge bounded unread-message counts
- `c034a4b` Merge server-side recurring availability checks
- `0442a17` Enforce performer recurring availability on acceptance

The feature audit remains the itemized implementation record in `FEATURE_AUDIT_200.md`.
