# EstateHat Next-Only Route Consolidation - 2026-04-25

## Summary

EstateHat web now runs from one Next.js route surface. The older split between static HTML landing/sign-in/home entries and Next routes was removed to avoid user confusion and reduce drift between public UX paths.

## Canonical routes

- `/` landing
- `/signin` sign in and registration
- `/home` authenticated application shell
- `/about`
- `/help`
- `/faq`
- `/press`
- `/terms`
- `/privacy`
- `/accessibility`
- `/dmca`

## Compatibility routes retained

- `/start` redirects to `/`
- `/login` and `/auth` resolve to `/signin`
- `/public?page=...` redirects to the matching public page

## Removed legacy files

- `home.html`
- `index.html`
- `signin.html`
- `start.html`
- `src/main.jsx`
- `src/signin.jsx`
- `src/start.jsx`
- `vite.config.js`
- old `dist/*.html` web entry artifacts

## Build and deployment changes

- `next.config.js` now exports static output via `output: "export"`
- Firebase Hosting now serves from `out/`
- Capacitor `webDir` now points to `out`
- Electron production load path now points to `out/index.html`
- Electron desktop dev now points to Next dev on `http://127.0.0.1:3000`
- Deploy guard now validates the Next app shape instead of the removed Vite shape

## Verification

- `npm run build` passed on 2026-04-25
- `npx firebase-tools deploy --only hosting --project estatehat` passed on 2026-04-25
- Live site: `https://estatehat.web.app`

## Post-sign-in 404 hotfix

After the route consolidation deploy, sign-in could land on a 404 when the browser performed a direct request to `/home`. Using the back button and then opening the app again worked because the second path stayed inside client navigation.

The hotfix changed:

- `app/signin/page.jsx`
  - replaced hard `window.location.replace("/home")` usage with Next `router.replace("/home")`
- `firebase.json`
  - enabled `"cleanUrls": true` so exported routes such as `/home` resolve cleanly in Hosting

Hotfix verification:

- `npm run build` passed on 2026-04-25 after the redirect fix
- `npx firebase-tools deploy --only hosting --project estatehat` passed on 2026-04-25 after the redirect fix

## Deployment note

Firebase Hosting reported:

- `Unable to find a valid endpoint for function "stripeApi", but still including it in the config`

This happened during a hosting-only deploy. Web Hosting released successfully, but Stripe rewrite health should be verified separately with a functions deploy if Stripe checkout traffic is expected.
