# Sign-In And Home Page Split - 2026-04-19

## Summary

Separated EstateHat public landing, account access, and the main app shell.

Before this pass, `/`, `/landing`, and `/signin` all loaded the same `index.html` SPA shell and React decided which screen to show. That made sign-in, public landing, and the signed-in app compete inside one entry.

Now:

- `/` loads a small redirect page to `/start.html`.
- `/start.html` loads the public landing page for incoming users.
- `/home.html` loads the signed-in app shell.
- `/signin.html` loads the sign-in/create-account screen through its own React entry.

## Files Changed

- `index.html`
  - Replaced with a small redirect to `/start.html`.
- `start.html`
  - New public landing HTML entry.
- `home.html`
  - Main signed-in app HTML entry.
- `signin.html`
  - New account-access HTML entry.
- `src/start.jsx`
  - New landing-only React entry.
  - Routes sign-in and account creation to `/signin.html`.
  - Routes signed-in users to `/home.html`.
- `src/main.jsx`
  - Owns the home/app shell only.
  - Sends signed-out users to sign-in or start page options instead of rendering landing.
- `src/signin.jsx`
  - New sign-in-only React entry.
  - Sends authenticated users back to `/home.html`.
- `vite.config.js`
  - Added multi-page build inputs for `index.html`, `start.html`, `home.html`, and `signin.html`.
- `firebase.json`
  - Keeps `/start`, `/landing`, and `/welcome` pointed at `/start.html`.
  - Keeps `/signin`, `/login`, and `/auth` pointed at `/signin.html`.
  - Keeps `/home` pointed at `/home.html`.
  - Rewrites unknown routes to `/start.html`.
  - Applies no-store cache headers to HTML entries.
- `public/sw.js`
  - Caches `/start.html`, `/home.html`, and `/signin.html`.
  - Falls back to `/start.html` for offline navigation.

## Verification

- `npm test`: pass
- `npm run build`: pass
- `npm run deploy:hosting`: pass

Live smoke:

- `https://estatehat.web.app/` serves the redirect page to `/start.html`.
- `https://estatehat.web.app/start.html` loads `assets/start-DnHcn0-y.js`.
- `https://estatehat.web.app/home.html` loads `assets/home-BOgexhMn.js`.
- `https://estatehat.web.app/signin.html` loads `assets/signin-DK-XeVal.js`.
