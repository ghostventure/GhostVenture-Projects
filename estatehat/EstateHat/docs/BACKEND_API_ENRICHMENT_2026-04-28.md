# EstateHat Backend API Enrichment

Date: 2026-04-28

## Scope

EstateHat's backend boundary was enriched so the app has a clear same-origin API surface and a safer client fallback path before full Functions activation.

## What changed

- Added `src/backend-api.js`.
- Moved Stripe action requests in `src/estatehat-platform-alpha.jsx` onto the shared backend client.
- Added backend utility functions in `functions/index.js`:
  - `apiHealth`
  - `apiSessionBootstrap`
- Added Hosting rewrites in `firebase.json`:
  - `/api/health` -> `apiHealth`
  - `/api/session/bootstrap` -> `apiSessionBootstrap`
  - `/api/stripe/**` -> `stripeApi`
- Updated the function request parser so direct function URLs and Hosting rewrites both resolve correctly.
- Added explicit backend deploy commands in `package.json`:
  - `npm run deploy:functions`
  - `npm run deploy:backend`

## Runtime behavior

The shared backend client now attempts:

1. Same-origin Hosting routes such as `/api/stripe/...`
2. Direct Cloud Functions URLs if the same-origin route returns an endpoint-style failure

That means the frontend no longer assumes the Hosting rewrite is always live before it can attempt Stripe actions.

## Verification

- `node --check src/backend-api.js`
- `node --check functions/index.js`
- `npm run build`

All passed on 2026-04-28.

## Deploy result

Attempted full backend deploy:

- `npx firebase-tools deploy --only functions,hosting --project estatehat`

Result:

- Failed because Firebase requires the `estatehat` project to be on the Blaze plan before enabling:
  - `cloudfunctions.googleapis.com`
  - `cloudbuild.googleapis.com`
  - `artifactregistry.googleapis.com`

Hosting-safe deploy completed:

- `npm run deploy:hosting`
- Live site: `https://estatehat.web.app`

Hosting currently warns that these function endpoints are not yet resolvable:

- `apiHealth`
- `apiSessionBootstrap`
- `stripeApi`

## Current backend status

- Frontend backend bridge: live
- Hosting rewrites: live in config
- Function code: staged in repo
- Function endpoints: not active until Firebase project billing is upgraded to Blaze
