# Listing Submissions + Matrix Themes

Date: 2026-05-01

## Summary

This rollout shipped two product-facing changes to the authenticated EstateHat shell:

- Seller listing submission now persists into Firestore as a real `listingSubmissions` review-queue record instead of only changing local UI state.
- Two new Matrix-style themes are now installed:
  - `Matrix G`: black background with green text
  - `Matrix B`: black background with blue text
- Header theme controls were then compacted into a single dropdown selector instead of multiple dedicated theme buttons.
- The persisted `userDatabase` record was enriched with additional CRM/operations fields for intent, ownership, market, budget, timeline, and last-contact tracking.

## Listing Submission Change

Files updated:

- `src/backend.js`
- `src/estatehat-platform-alpha.jsx`
- `firestore.rules`
- `tests/compliance-mechanics.test.mjs`

Behavior:

- `List Property` now calls `submitListingForReview(...)` on final submit.
- Each submission is written to the `listingSubmissions` collection with:
  - `schemaVersion: 1`
  - `status: "pending_review"`
  - `reviewStatus: "queued"`
  - seller identity fields
  - listing details
  - jurisdiction fields
  - photo/document metadata
  - seller fee lines
- Seller and corporate-seller accounts can create `listingSubmissions`.
- Published `listings` remain admin-controlled.
- The success screen now shows the generated submission ID.

Notes:

- This is a real persistence step, not a full review/approval pipeline.
- Media files are still represented as metadata from the current upload widgets; this change does not yet add Firebase Storage-backed asset persistence.

## Matrix Themes

Files updated:

- `app/layout.jsx`
- `src/estatehat-platform-alpha.jsx`

Behavior:

- Theme selection is now stored in `localStorage` under `estatehat-theme`.
- The legacy `estatehat-dark` key is still written for compatibility.
- The document root now loads the saved theme before app render to reduce theme flash.
- Theme modes now include:
  - `light`
  - `dark`
  - `matrix-green`
  - `matrix-blue`
- Header theme selection now uses a single compact dropdown with:
  - `Light`
  - `Dark`
  - `Matrix Green`
  - `Matrix Blue`

## Verification

Verified locally:

- `npm run build`

Known local tooling issue:

- `npm test` did not complete on this machine because the local Node 22 test runner is missing internal module `internal/deps/brace-expansion`.

## Deploy Target

- Firebase Hosting project: `estatehat`
- Deploy command: `npm run deploy:hosting`

## Deploy Result

Hosting deploy completed successfully on 2026-05-01.

- Hosting URL: `https://estatehat.web.app`
- Firebase Console: `https://console.firebase.google.com/project/estatehat/overview`

CLI warnings observed during Hosting finalization:

- `apiHealth` rewrite target did not resolve to a valid deployed function endpoint
- `apiSessionBootstrap` rewrite target did not resolve to a valid deployed function endpoint
- `stripeApi` rewrite target did not resolve to a valid deployed function endpoint

These warnings match the current known limitation: Hosting is live, but those function-backed rewrites are not yet fully active in the Firebase project.

## Follow-up UI Adjustment

After the initial Matrix-theme install, the header controls were simplified:

- removed separate dedicated Matrix theme buttons
- replaced them with one compact dropdown selector in the header
- preserved the same persisted theme modes and preload behavior

Follow-up verification:

- `npm run build`

Follow-up deploy:

- `npm run deploy:hosting`

## User Database Enrichment

Files updated:

- `src/backend.js`
- `firestore.rules`
- `src/estatehat-platform-alpha.jsx`

Behavior:

- The persisted `userDatabase` shape now includes:
  - `transactionIntent`
  - `stageOwner`
  - `targetMarket`
  - `budgetBand`
  - `timelineBand`
  - `lastContactAt`
- These fields now pass through backend sanitization and Firestore rules validation.
- The My Info `User & Customer Database` panel now exposes editable controls for the new fields.
- Customer-record highlights now surface intent and last-contact status.
- Database depth scoring now gives partial credit for richer operational context, not just tags and notes.

Verification:

- `npm run build`

## Backend Enrichment

Files updated:

- `functions/index.js`
- `src/backend-api.js`
- `firebase.json`
- `tests/compliance-mechanics.test.mjs`

Behavior:

- Added authenticated listing-operations backend surface at `/api/listings/*`.
- Added functions-side mechanics for:
  - listing submission lookup
  - privileged review queue lookup
  - privileged review decisions
  - approval-to-published-listing transformation
- Session bootstrap now returns richer operational snapshots, including listing-submission counts and recent platform-fee activity.
- Hosting rewrites now include `/api/listings/** -> apiListingOps`.

Smoke test:

- `node --check functions/index.js`
- `node --check src/backend-api.js`
- `npm run build`

Backend deploy attempt:

- attempted `npm run deploy:backend`
- local smoke/build steps passed
- Firebase Functions publish failed because project `estatehat` is not yet on the Blaze plan
- blocking APIs:
  - `cloudbuild.googleapis.com`
  - `artifactregistry.googleapis.com`

Firebase error returned:

- `Your project estatehat must be on the Blaze (pay-as-you-go) plan to complete this command.`

Hosting fallback:

- `npm run deploy:hosting` completed successfully

Latest Hosting finalization warnings:

- `apiHealth` rewrite target did not resolve to a valid deployed function endpoint
- `apiSessionBootstrap` rewrite target did not resolve to a valid deployed function endpoint
- `apiListingOps` rewrite target did not resolve to a valid deployed function endpoint
- `stripeApi` rewrite target did not resolve to a valid deployed function endpoint

Result:

- web release is live at `https://estatehat.web.app`
- new backend functions are staged in repo but not live until the Firebase project is upgraded to Blaze and Functions are deployed

## Featured Placements Follow-up

Additional product work was installed after the initial rollout:

- paid featured placements for listing sellers
- paid featured service spotlights for service providers
- featured-placement browse sorting and service-market surfacing
- enriched placement UX/status messaging in Browse and Match Services

Deployment state for that follow-up:

- frontend/UI portions are live on Hosting
- backend checkout/webhook/security mechanics are staged in repo
- latest backend deploy attempt on 2026-05-02 failed because Firebase Functions cannot be published until project `estatehat` is upgraded to the Blaze plan

Security note:

- a 2026-05-02 security smoke test found unnecessary payment/session metadata in the readable `featuredPlacements` collection shape
- that payload was hardened server-side in repo
- the hardening is not live yet because it requires the blocked Functions deploy

Detailed record:

- `docs/FEATURED_PLACEMENTS_SECURITY_SMOKE_2026-05-02.md`
