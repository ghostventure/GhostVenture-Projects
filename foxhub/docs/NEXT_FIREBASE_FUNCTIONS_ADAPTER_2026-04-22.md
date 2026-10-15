# Next Firebase Functions Adapter - 2026-04-22

## Summary

FoxHub now has a Firebase Functions adapter for running the Next.js app and API routes behind Firebase Hosting.

The adapter packages the production `.next` build into `functions/next-app` and exposes it through a new `nextApp` HTTPS Cloud Function.

## Added

- `scripts/prepare-next-functions.mjs`
  - copies the production `.next` build into `functions/next-app`
  - creates the minimal runtime files needed by the function-hosted Next app
- `functions/index.js`
  - adds `nextApp`, a Firebase Functions v2 HTTPS function that boots the packaged Next app
- `functions/package.json`
  - adds `next`, `react`, and `react-dom` so the function can run the Next server
- `firebase.next.json`
  - opt-in Firebase config that rewrites Hosting traffic to `nextApp`
  - uses `functions/next-app/public` as the Hosting public directory so `/`, `/landing`, `/signin`, and `/api/**` route through the Next function instead of the static Vite shell
- `package.json`
  - adds `build:next:functions`
  - adds `deploy:next`

## Commands

Build the adapter package:

```sh
npm run build:next:functions
```

Deploy the Next-backed Hosting path after Firebase billing is enabled:

```sh
npm run deploy:next
```

## Deployment Status

The adapter builds successfully, but deployment is currently blocked by Firebase project billing.

Firebase rejected the Functions deploy because project `foxhub-superapp` is not on the Blaze pay-as-you-go plan. Cloud Functions deployment needs Cloud Build and Artifact Registry enabled, and Firebase will not enable those APIs on the current plan.

Firebase upgrade URL:

```text
https://console.firebase.google.com/project/foxhub-superapp/usage/details
```

## Safety Note

The default `firebase.json` still keeps the current static Firebase Hosting behavior, rewriting to `/index.html`. This prevents the live site from being accidentally pointed at a Cloud Function that cannot deploy yet.

The Next-backed rewrite lives in `firebase.next.json` and is used only by `npm run deploy:next`.

## Verified

- `node --check functions/index.js` passed.
- `node --check scripts/prepare-next-functions.mjs` passed.
- `npm run build:next:functions` passed.
- `npm test` passed.
- Firebase emulator with `firebase.next.json` returned `200` for `/`, `/landing`, and `/api/health`.
- Emulator logs confirmed Hosting rewrites for `/`, `/landing`, and `/api/health` went to `us-central1-nextApp`.
- `npx firebase-tools deploy --config firebase.next.json --only functions:nextApp,hosting --project foxhub-superapp` reached Firebase deployment and was blocked by Blaze billing, not by local code validation.
