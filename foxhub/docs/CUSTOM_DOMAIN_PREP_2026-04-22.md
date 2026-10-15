# FoxHub Custom Domain Prep - 2026-04-22

## Summary

FoxHub now has a preferred public URL setting for the branded domain:

- `https://foxhub.com` (`FoxHub.com`)

The deployed Firebase Hosting fallback remains:

- `https://foxhub-superapp.web.app`

## Changed

- Added `VITE_FOXHUB_PUBLIC_URL` for the Vite/static Hosting bundle.
- Added `NEXT_PUBLIC_FOXHUB_PUBLIC_URL` for the Next.js shell.
- Updated Firebase email-link server fallback to use the configured public URL instead of a hardcoded Firebase Hosting URL.
- Updated current docs so `FoxHub.com` is treated as the preferred public domain and `.web.app` as the temporary Firebase fallback.

## DNS Required

The browser address bar will continue to show `foxhub-superapp.web.app` until the custom domain is connected in Firebase Hosting and the domain registrar DNS is pointed at Firebase.

After DNS is connected, update `.env` if needed:

```sh
VITE_FOXHUB_PUBLIC_URL=https://foxhub.com
NEXT_PUBLIC_FOXHUB_PUBLIC_URL=https://foxhub.com
```

## Verified

- `npm test` passed.
- `npm run build` passed.
- `npm run vite:build` passed.
- `npm run deploy:hosting` deployed the refreshed static bundle to Firebase Hosting.
- Live checks returned `200` for `/` and `/landing` on the current Firebase Hosting fallback.
