# Featured Placements Security Smoke

Date: 2026-05-02

## Scope

Focused security smoke test for the paid featured-placement flow installed in EstateHat.

Primary surfaces reviewed:

- `functions/index.js`
- `firestore.rules`
- `storage.rules`
- featured-placement UI reads in `src/estatehat-platform-alpha.jsx`

## What Was Checked

- whether the featured-placement collection allowed unsafe client writes
- whether readable featured-placement records included unnecessary payment/session metadata
- whether storage paths remained user-scoped
- whether the frontend depended on sensitive fields that should not be exposed

## Finding

The featured-placement flow was close, but not strong enough on privacy hygiene.

`featuredPlacements` is intentionally readable by signed-in users so the marketplace UI can render promoted inventory:

- `firestore.rules` allows `read` for signed-in users
- client create/update/delete remains blocked

The issue was that the backend writer was also storing unnecessary sensitive-ish metadata in that readable collection:

- `checkoutSessionId`
- `paymentIntentId`
- `customerId`
- `ownerEmail`

Those fields are not required by the UI and should not have been present in a broadly readable promotion feed.

## Fix Applied

Server-side payload shaping was tightened in `functions/index.js`.

Removed from `featuredPlacements` writes:

- `checkoutSessionId`
- `paymentIntentId`
- `customerId`
- `ownerEmail`

Retained for legitimate UI/display behavior:

- placement title/subtitle
- owner display name
- owner account type
- placement status
- market / property metadata
- active window (`startsAt`, `endsAt`)
- pricing totals and currency

## Verification

Verified locally:

- `node --check functions/index.js`
- `npm run build`

## Deploy Status

This hardening is not live yet.

Attempted deploy path:

- `npm run deploy:backend`

Result:

- guarded build passed
- Firebase deploy failed before Functions publish
- blocker: project `estatehat` is not on the Blaze plan required to enable:
  - `cloudbuild.googleapis.com`
  - `artifactregistry.googleapis.com`

Current production state:

- featured-placement frontend/UI improvements are live on Hosting
- this server-side privacy hardening remains staged in repo only until Functions deployment is available

## Recommendation

Current patch is the right immediate fix.

If a stricter future posture is desired, split promo-display documents from promo-payment/internal operations records so the public-ish read model never shares storage shape with backend commerce events.
