# ExcelBolt Project Status

Last updated: 2026-04-17

## Current state

ExcelBolt is live as a Firebase-hosted web app.

Live URL:

- `https://excelbolt.web.app`

Firebase project:

- `excelbolt`

## Latest release summary (2026-04-17)

- Added a public landing page for signed-out visitors at `/` and `/landing`.
- Added photo-led incentive messaging for ExcelBolt's 30-day trial, app connectors, report templates, and workbook exports.
- Kept sign-in separate at `/signin`, `/login`, and `/auth` so the landing page leads into the existing account flow instead of replacing it.
- Added logged-in landing-page recovery with an "Open workspace" action.
- Corrected production chunk splitting so React mounts cleanly after deploy.
- Updated the service worker and CSP so landing-page images and hosted fonts can load without blocked worker fetches.

## Previous release summary (2026-04-10)

- Added background plugin API runtime for assistant workflows.
- Added Help -> Assistant UI for running background assistance plugins.
- Added optional ExcelJet knowledge bridge so external encyclopedia context can enrich template assistance silently.
- Deployed latest build to Firebase Hosting production.

## What is now in place

- Vite production builds are working.
- Firebase Hosting serves the built app from `dist/`.
- Security and performance hardening is documented in `docs/SECURITY_PERFORMANCE.md`.
- Service worker and manifest remain active for repeat-load performance.
- Vite manual chunks keep React, Firebase, and other vendor code separated without circular chunk dependencies.
- Background plugin API:
  - `src/background-plugin-api.js`
  - `src/background-plugin-worker.js`
- ExcelJet bridge:
  - `src/exceljet-kb.js`
- Public landing route:
  - `/`
  - `/landing`
- Account access routes:
  - `/signin`
  - `/login`
  - `/auth`

## Verification completed on 2026-04-17

- Build validation:
  - `npm test` passed.
  - `npm run build` passed.
- Production deployment:
  - `firebase deploy --only hosting --project excelbolt` passed.
- Live checks:
  - `https://excelbolt.web.app/` renders the new landing page.
  - `https://excelbolt.web.app/landing` renders the new landing page.
  - `https://excelbolt.web.app/signin` renders the account access screen.

## Important files

- `excelbolt.jsx`
- `src/background-plugin-api.js`
- `src/background-plugin-worker.js`
- `src/exceljet-kb.js`
- `public/sw.js`
- `public/manifest.webmanifest`
- `firebase.json`
- `.firebaserc`
- `docs/HANDOFF_2026-04-17.md`

## Operational note

- If a browser still shows an older shell after deploy, clear site data or unregister the previous service worker once, then reload.

## 2026-06-25 GitHub Upload Note

- Uploaded ExcelBolt to GitHub repository `https://github.com/PlugzTech/AdventureCode-Projects`.
- Repository subfolder: `excelbolt/`.
- Upload commit: `65920a4 Add FoxHub CLTCH EstateHat and ExcelBolt projects`.
- The GitHub copy is source-focused. It intentionally excludes local dependencies, build output, Firebase cache, environment files, local databases, archives, and release artifacts.
- The GitHub repository is currently public, so do not commit credentials, private customer workbook data, local databases, or unpublished operational secrets.
