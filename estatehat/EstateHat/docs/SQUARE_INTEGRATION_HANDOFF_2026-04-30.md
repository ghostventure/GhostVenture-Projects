# Square Integration Handoff

Date: 2026-04-30

## Scope

This handoff documents the current EstateHat Square billing/payment integration state so work can resume later without rebuilding context.

Target use cases:
- `Verified User` recurring billing
- `EstateHat platform fee` one-time checkout

Non-goal at this stage:
- using Square as a substitute for licensed real-estate escrow or custodial trust handling

## Current conclusion

Square is a good fit for:
- recurring `Verified User` billing
- one-time EstateHat platform/service fees

Square should not be assumed to be the compliant escrow layer for regulated transaction funds without legal review.

## Values already identified

These values were provided during setup discovery:

- Sandbox application ID: `sandbox-sq0idb-tNAdYZD8YCYLDyfr5DQSpA`
- Production application ID: `sq0idp-yaCkpE55bR05NjwVJSYXlw`
- Square location ID: `L7FXF1AWHP19X`

Important:
- A Square access token was pasted in chat.
- That token was **not** written into the codebase.
- Treat it as exposed and rotate it before production use.

## Code already implemented

### Frontend

Square client routing was added in:
- [src/backend-api.js](/home/sniper-lion-main/Documents/EstateHat_files/estatehat-clean/src/backend-api.js)
- [src/estatehat-platform-alpha.jsx](/home/sniper-lion-main/Documents/EstateHat_files/estatehat-clean/src/estatehat-platform-alpha.jsx)

Implemented frontend behavior:
- `postSquareAction(...)` helper added
- Verified billing UI now supports `provider = square`
- Verified billing button can:
  - start Square subscription
  - refresh Square subscription status
  - cancel Square subscription
- Platform-fee checkout can route to Square-hosted checkout

### Backend

Square server-side flow was added in:
- [functions/index.js](/home/sniper-lion-main/Documents/EstateHat_files/estatehat-clean/functions/index.js)

Implemented backend behavior:
- `squareApi` Firebase function added
- Square request wrapper added
- Square customer creation added
- Square subscription state sync added
- Square webhook signature verification added
- one-time Square payment-link creation added

Current Square endpoints:
- `POST /api/square/verified-subscription/start`
- `POST /api/square/verified-subscription/refresh`
- `POST /api/square/verified-subscription/cancel`
- `POST /api/square/platform-fee-checkout`
- `POST /api/square/webhook`

## Data model alignment

The Square integration was intentionally mapped into existing EstateHat billing fields instead of creating a second billing model.

Relevant existing model areas:
- `user.verifiedBilling`
- `user.trust`

On subscription sync, backend updates:
- `verifiedBilling.provider = "square"`
- `verifiedBilling.customerId`
- `verifiedBilling.subscriptionId`
- `verifiedBilling.status`
- `verifiedBilling.planId`
- `verifiedBilling.nextChargeAt`
- `trust.verifiedProfileActive`

## What still must be done manually in Square

This is the remaining dashboard work.

### 1. Create the Verified User subscription plan

Need to create a recurring Square subscription plan for:
- Name: `Verified User`
- Amount: currently modeled at `$20/month`

After creation, capture the:
- `plan variation ID`

This value must be stored as:
- `SQUARE_VERIFIED_PROFILE_PLAN_VARIATION_ID`

### 2. Confirm access token

Need a valid Square access token for the target environment.

Store as:
- `SQUARE_ACCESS_TOKEN`

If reusing the previously pasted token:
- rotate if necessary first
- then store the fresh token as a Firebase secret

### 3. Confirm location ID

Already identified:
- `L7FXF1AWHP19X`

Store as:
- `SQUARE_LOCATION_ID`

### 4. Create Square webhook subscription

Need a Square webhook configured to hit the deployed EstateHat Square endpoint.

Required event family:
- subscription lifecycle events

At minimum, subscribe to the Square subscription events needed to reflect:
- created
- updated
- canceled

After webhook creation, capture:
- webhook signature key

Store as:
- `SQUARE_WEBHOOK_SIGNATURE_KEY`

Also store the exact public webhook URL as:
- `SQUARE_WEBHOOK_NOTIFICATION_URL`

This URL is used by the backend for signature verification.

## Firebase secrets required

These secrets are expected by the backend:

- `SQUARE_ACCESS_TOKEN`
- `SQUARE_LOCATION_ID`
- `SQUARE_VERIFIED_PROFILE_PLAN_VARIATION_ID`
- `SQUARE_WEBHOOK_SIGNATURE_KEY`
- `SQUARE_WEBHOOK_NOTIFICATION_URL`

## Deployment status

Code is implemented locally but not yet deployed for Square.

Build verification completed:
- `node --check functions/index.js`
- `node --check src/backend-api.js`
- `npm run build`

All passed on 2026-04-30 after the Square changes.

## Recommended next resume sequence

When resuming this work:

1. Create the Square `Verified User` recurring plan in the Square dashboard.
2. Copy the `plan variation ID`.
3. Rotate and confirm the Square access token if needed.
4. Add Firebase secrets for all Square values.
5. Deploy functions.
6. Configure the Square webhook using the deployed public function URL.
7. Test:
   - start verified subscription
   - refresh verified subscription state
   - cancel verified subscription
   - launch one-time platform fee checkout

## Expected deploy commands

Likely commands when resuming:

```bash
firebase functions:secrets:set SQUARE_ACCESS_TOKEN
firebase functions:secrets:set SQUARE_LOCATION_ID
firebase functions:secrets:set SQUARE_VERIFIED_PROFILE_PLAN_VARIATION_ID
firebase functions:secrets:set SQUARE_WEBHOOK_SIGNATURE_KEY
firebase functions:secrets:set SQUARE_WEBHOOK_NOTIFICATION_URL
npm run deploy:hosting
```

Depending on current project workflow, backend deploy may instead use:

```bash
npm run deploy:backend
```

## Known limitations of the current implementation

- Square subscription start currently happens from the backend without a full custom card-entry flow in EstateHat.
- The current implementation is intended as the first working integration path, not the final polished payment UX.
- A later phase can add:
  - Web Payments SDK
  - card-on-file capture
  - stronger subscription/payment event coverage
  - admin-side payment reconciliation views

## Resume note

When picking this up again, start from:
- [functions/index.js](/home/sniper-lion-main/Documents/EstateHat_files/estatehat-clean/functions/index.js)
- [src/backend-api.js](/home/sniper-lion-main/Documents/EstateHat_files/estatehat-clean/src/backend-api.js)
- [src/estatehat-platform-alpha.jsx](/home/sniper-lion-main/Documents/EstateHat_files/estatehat-clean/src/estatehat-platform-alpha.jsx)

This is the live Square integration checkpoint as of 2026-04-30.
