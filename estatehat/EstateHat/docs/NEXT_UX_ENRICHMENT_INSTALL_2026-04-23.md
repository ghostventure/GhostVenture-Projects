# Next UX Enrichment Install - 2026-04-23

## Summary

EstateHat now has a Next-backed enrichment layer installed in the active shared app source. The work adds operational UX surfaces that make the app feel more connected after sign-in instead of only adding isolated feature pages.

The changes live in the shared source used by both:

- Next routes through `app/home/page.jsx`
- Firebase Hosting/Vite output through `src/main.jsx`

## Installed

- Role-aware Hat Board widgets for buyer, seller, agent, professional, admin, and government-style workflows.
- Action Inbox route for account, verification, legal, payout, billing, listing sync, saved-search, and watchlist next steps.
- Deal Health score based on profile completion, verification, legal readiness, payout readiness, and verified billing.
- Mobile bottom navigation for compact layouts, with quick access to Hat Board, Action Inbox, Browse, Docs, and saved homes.
- Document Vault preview timeline for upload, metadata, signature/review, and audit status.
- Hat Board enrichment panels that surface the Action Inbox and Deal Health score directly on the first signed-in screen.

## Primary Files

- `src/estatehat-platform-alpha.jsx`
- `src/GuiFeatureViews.jsx`

## Verification

Passed:

- `npm run build`
- `npm test`
- `npm run deploy:hosting`

`node --check` is not used for these `.jsx` files because the current Node ESM syntax checker does not load `.jsx` extensions directly in this project. The Next build is the authoritative syntax and bundling check.

## Deployment

Deploy command:

```sh
npm run deploy:hosting
```

Production URL:

- `https://estatehat.web.app`

Deploy result:

- Firebase project: `estatehat`
- Hosting URL: `https://estatehat.web.app`
- Live `/start` route returned HTTP `200`
- Live `/home` route returned HTTP `200`
- Hosted bundle includes `Action Inbox`, `Deal Health`, `Role-Aware Dashboard`, mobile bottom navigation, and `Version And Audit Timeline`
