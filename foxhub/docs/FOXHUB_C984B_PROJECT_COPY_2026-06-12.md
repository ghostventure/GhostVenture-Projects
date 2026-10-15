# FoxHub Project Copy to foxhub-c984b - 2026-06-12

## Summary

Copied the current FoxHub static Hosting site to Firebase project `foxhub-c984b` under the `blacklionmediastudio@gmail.com` Firebase account.

## Target

- Firebase project ID: `foxhub-c984b`
- Firebase project display name: `FoxHub`
- Hosting URL: `https://foxhub-c984b.web.app`
- Firebase account used for deploy: `blacklionmediastudio@gmail.com`
- Hosting site ID: `foxhub-c984b`

## Installed

- Created a Firebase Web App named `FoxHub` in project `foxhub-c984b`.
- Built the Vite Hosting bundle with `foxhub-c984b` Firebase config.
- Deployed the Hosting bundle to `https://foxhub-c984b.web.app`.
- Updated `index.html` so canonical, Open Graph URL, and social image URL are driven by `VITE_FOXHUB_PUBLIC_URL`.
- Updated `scripts/release-smoke.mjs` so public smoke checks the configured public URL instead of hardcoding `foxhub-superapp.web.app`.

## Verification

- Target-specific public smoke passed with:
  - `VITE_FIREBASE_PROJECT_ID=foxhub-c984b`
  - `VITE_FIREBASE_AUTH_DOMAIN=foxhub-c984b.firebaseapp.com`
  - `VITE_FOXHUB_PUBLIC_URL=https://foxhub-c984b.web.app`
- Firebase Hosting deploy passed.
- Live smoke passed on:
  - `/`
  - `/signin`
  - `/management`
  - `/feedback`
- Live bundle markers confirmed:
  - `foxhub-c984b`
  - `foxhub-c984b.firebaseapp.com`
  - `1:751583414529:web:7f24267d610870ace83300`
- Live metadata markers confirmed:
  - `https://foxhub-c984b.web.app/`
  - `https://foxhub-c984b.web.app/foxhub-social-preview.png`
- Firestore default database is active:
  - `projects/foxhub-c984b/databases/(default)`
  - edition `STANDARD`
  - type `FIRESTORE_NATIVE`
- Firestore rules deployed successfully from `firestore.rules`.

## Live Evidence

- Latest verified Hosting `Last-Modified`: `Fri, 12 Jun 2026 13:32:14 GMT`
- Live URL: `https://foxhub-c984b.web.app`

## Notes

- The repo `.env.local` remains pointed at `foxhub-superapp` so the original project can still be built and deployed normally.
- The copied Hosting site is static Hosting. Next API Functions are not deployed to `foxhub-c984b` in this pass.
- Firebase Auth provider setup, Firestore seed data, Storage rules/data, custom domains, and provider setup should be reviewed separately inside the `foxhub-c984b` Firebase project if this copy is becoming the primary production project.
