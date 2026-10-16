# Backend Deploy Recovery

Date: 2026-05-02

## Purpose

Capture the actual backend deployment recovery path for EstateHat so future retries do not repeat the same diagnosis work.

Project:

- Firebase project: `estatehat`
- Repo: EstateHat
- Deploy command: `npm run deploy:backend`

## Summary

Backend deployment progressed through several blocked stages in sequence.

The original blocker was not code. It was Firebase/Google Cloud project readiness:

- Blaze plan not fully active
- required Google APIs not enabled
- required Functions secrets not populated

Once those were addressed, deployment moved deeper into normal Functions analysis and secret validation.

## What Was Confirmed

- repo is targeting Firebase project `estatehat`
- Blaze activation is now effectively working
- Cloud Build and Artifact Registry are no longer blocked by plan restrictions
- Functions source analysis works after installing local dependencies in `functions/`
- Stripe secrets were partially or fully populated during recovery

## Deploy Timeline

### 1. Initial backend deploy blocker

Command:

- `npm run deploy:backend`

Observed blocker:

- Firebase refused to enable:
  - `cloudbuild.googleapis.com`
  - `artifactregistry.googleapis.com`
- error stated project must be on Blaze

Meaning:

- backend deploy impossible until Blaze upgrade completed on project `estatehat`

### 2. Blaze confirmation and retry

After Blaze was enabled in console, deploy progressed further.

New behavior:

- required APIs began enabling instead of failing immediately

Meaning:

- Blaze blocker was resolved

### 3. Functions dependency blocker

New deploy error:

- Firebase CLI reported it could not find `firebase-functions` in source code

Root cause:

- `functions/package.json` existed, but `functions/node_modules` had not been installed locally

Recovery action:

- ran `npm install` inside `functions/`

Result:

- Functions analysis progressed normally afterward

### 4. Secret Manager API blocker

New deploy error:

- Secret Manager API was not enabled

Recovery action:

- enabled `secretmanager.googleapis.com` for project `estatehat`

Result:

- deploy progressed to secret-value validation

### 5. Missing Stripe secrets

Sequential missing-secret errors appeared for:

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_VERIFIED_PROFILE_PRICE_ID`

Recovery actions:

- created/rotated Stripe live secret key and set `STRIPE_SECRET_KEY`
- created Stripe webhook destination at:
  - `https://estatehat.web.app/api/stripe/webhook`
- selected event:
  - `checkout.session.completed`
- revealed webhook signing secret and set `STRIPE_WEBHOOK_SECRET`
- located Verified User Badge monthly Stripe price and set `STRIPE_VERIFIED_PROFILE_PRICE_ID`

Important mapping:

- Stripe secret key: `sk_live_...` -> `STRIPE_SECRET_KEY`
- Stripe webhook signing secret: `whsec_...` -> `STRIPE_WEBHOOK_SECRET`
- Stripe price ID: `price_...` -> `STRIPE_VERIFIED_PROFILE_PRICE_ID`

### 6. Current blocker

Latest deploy error:

- `SQUARE_ACCESS_TOKEN` secret is missing

Required command:

```bash
firebase functions:secrets:set SQUARE_ACCESS_TOKEN --project estatehat
```

Meaning:

- Stripe-side configuration is no longer the active blocker
- Square backend secret is now the next required value

## Current State

What is resolved:

- Blaze plan availability
- Cloud Build API enablement
- Artifact Registry API enablement
- Secret Manager API enablement
- Functions local dependency install
- Stripe secret configuration path

What still blocks backend deploy:

- missing Firebase Functions secret:
  - `SQUARE_ACCESS_TOKEN`

What is not yet a deploy blocker, but should be fixed soon:

- Functions runtime is still pinned to Node `20`, which is deprecated
- `firebase-functions` package is outdated and should be upgraded carefully

## Known Warnings

Observed during deploy:

- Node.js `20` runtime deprecated on 2026-04-30 and scheduled for decommission on 2026-10-30
- `firebase-functions` package version is outdated

These warnings did not block deploy yet, but they should be scheduled for follow-up before the next hard deadline.

## Next Recovery Step

Set the Square secret:

```bash
firebase functions:secrets:set SQUARE_ACCESS_TOKEN --project estatehat
```

Then retry:

```bash
npm run deploy:backend
```

## Operational Notes

- do not paste live secrets into chat
- rotate any live secret that was accidentally exposed during setup
- use Firebase Functions secrets for backend credentials, not source files
- Stripe webhook destination currently configured during recovery:
  - `https://estatehat.web.app/api/stripe/webhook`

## Related Docs

- `docs/FEATURED_PLACEMENTS_SECURITY_SMOKE_2026-05-02.md`
- `docs/LISTING_SUBMISSIONS_MATRIX_THEMES_2026-05-01.md`
- `docs/BACKEND_API_ENRICHMENT_2026-04-28.md`
