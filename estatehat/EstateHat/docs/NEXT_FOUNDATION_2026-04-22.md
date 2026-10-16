# EstateHat Next Foundation - 2026-04-22

## Summary

EstateHat now has a Next.js app foundation while preserving the existing Vite, Firebase Hosting, Capacitor, and Electron build paths.

This migration adds real Next app routes for the current public/start, sign-in, and authenticated home surfaces. The existing Vite HTML entry points remain in place for static Hosting, Android/iOS sync, and desktop packaging.

## Added

- `next.config.js`
  - baseline Next config with unoptimized image handling
- `app/layout.jsx`
  - shared metadata, viewport, manifest, icon, and dark-mode bootstrap
- `app/page.jsx`
  - redirects `/` to `/start`
- `app/start/page.jsx`
  - Next client route for the EstateHat landing/start page
- `app/signin/page.jsx`
  - Next client route for auth
- `app/home/page.jsx`
  - Next client route for the authenticated EstateHat workspace
- package scripts:
  - `npm run dev` -> `next dev`
  - `npm run build` -> `next build`
  - `npm run start` -> `next start`
  - `npm run vite:dev` -> retained Vite dev server
  - `npm run vite:build` -> retained Vite production build
- dependency:
  - `next`

## Preserved

- Static Firebase Hosting path remains Vite-based:
  - `npm run deploy:hosting`
  - `npm run build:hosting`
- Native wrapper paths remain Vite-based:
  - `npm run sync:android`
  - `npm run sync:ios`
- Desktop packaging remains Vite-based:
  - `npm run dist:win`
  - `npm run pack:win`
- Existing Firebase client, Firestore rules, Storage rules, compliance tests, and core React UI modules were retained.

## Compatibility Change

`src/firebase.js` now reads App Check config from both Vite and Next-compatible environment names:

- `VITE_APP_CHECK_SITE_KEY`
- `NEXT_PUBLIC_APP_CHECK_SITE_KEY`

This avoids a Vite-only `import.meta.env` assumption during Next builds.

## Verified

- `npm run build` passed for Next.
- `npm test` passed.
- `npm run vite:build` passed.
- `npm run start -- --hostname 127.0.0.1 --port 3200` served the production Next build.
- Local Next smoke returned:
  - `/` -> `307` redirect to `/start`
  - `/start` -> `200`
  - `/signin` -> `200`
  - `/home` -> `200`
  - `/manifest.webmanifest` -> `200`
  - `/icons/estatehat-icon.svg` -> `200`

## Current Notes

The default local web workflow is now Next. Production Hosting remains on the existing Vite static bundle until a Next-capable hosting adapter is added for EstateHat.
