# Profile Photo Upload - 2026-06-12

## Summary

Members can now add a profile photo from the profile editor and publish it with their public OneID card.

## Installed

- Added a `Profile photo` uploader to the member profile editor.
- Reused the shared image upload pipeline for JPG, JPEG, PNG, GIF, and SVG vector images.
- Kept raster optimization, GIF preservation, and SVG sanitization in the shared upload helper.
- Added drag/drop and click upload behavior to the profile photo control.
- Added remove/replace controls so members can clear or change the saved photo.
- Added live preview rendering in the profile editor.
- Added public profile modal rendering for saved profile photos.
- Added profile photo fields to the default profile contract and normalized profile drafts.
- Added local and Firebase repository persistence for `profilePhoto`, `profilePhotoUrl`, `profilePhotoName`, and `profilePhotoType`.
- Added accepted `data:image` URL validation before profile photos persist.
- Added release-smoke markers for the profile photo control and CSS.
- Added a local persistence regression assertion proving the photo survives save, sign-out, and sign-in.

## Management deploy guard

The previous Management backend work added Next API routes for WebAuthn, but Firebase deployment of those APIs is still blocked until the Firebase project is upgraded to Blaze. To avoid publishing a static bundle that locks staff out before those routes are live, the Management gate now keeps the backend verification path when available and falls back to the existing local Windows Hello gate only when the backend route is unavailable on static Hosting.

Backend verification still fails closed when the backend route exists and rejects the challenge or verify request.

## Verification

- `node --check src/rules.js`
- `node --check src/repository-local.js`
- `node --check src/repository-firebase.js`
- `node --check scripts/release-smoke.mjs`
- `npm run release:check`

`npm run release:check` includes:

- `npm test`
- `npm run smoke:public`
- `npm run build`

## Deployment

Firebase Hosting static deploy should be used for this change until the project can deploy Next API Functions on Blaze.
