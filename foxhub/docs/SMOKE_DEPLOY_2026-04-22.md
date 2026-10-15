# FoxHub Smoke Test And Deploy - 2026-04-22

## Summary

FoxHub was smoke-tested locally, rebuilt, and deployed to Firebase Hosting for project `foxhub-superapp`.

Live site:

- `https://foxhub-superapp.web.app/`
- `https://foxhub-superapp.web.app/landing`
- `https://foxhub-superapp.web.app/signin`

## Verified

- `npm test` passed.
- `npm run build` passed for the Next.js app and API route compilation.
- `npm run vite:build` passed for the static Firebase Hosting bundle.
- `node --check` passed for the new API route server files.
- Local Next dev route smoke returned `200` for `/`, `/landing`, `/signin`, and `/api/health`.
- Firebase Hosting deploy completed successfully with `npm run deploy:hosting`.
- Live Hosting route smoke returned `200` for `/`, `/landing`, and `/signin`.
- The deployed bundle contains the new landing copy: `A place for your people to stay close.`

## Deploy Command

```sh
npm run deploy:hosting
```

This command runs the Vite production build and deploys the resulting `dist` directory to Firebase Hosting.

## Hosting Note

The web app now has a Next.js foundation for local web/backend work, but `firebase.json` still serves the static Vite bundle from `dist`. That means Firebase Hosting currently deploys the client app shell and its browser-side Firebase behavior.

The Next.js API routes are build-verified and smoke-tested locally. They are not live on Firebase Hosting until the project is moved to a Next-capable hosting path or connected to a Firebase/Cloud Functions adapter.

## Current Access

- Local dev server: `http://127.0.0.1:3000`
- Production Hosting: `https://foxhub-superapp.web.app`
