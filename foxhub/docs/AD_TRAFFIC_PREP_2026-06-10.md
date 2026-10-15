# FoxHub Ad Traffic Prep - 2026-06-10

## Summary

Prepared the FoxHub public web entry for near-term advertising traffic.

## Changes

- Updated the static Vite HTML metadata that paid/social crawlers read before React loads.
- Added canonical URL metadata for `https://foxhub-superapp.web.app/`.
- Added Open Graph title, description, URL, site name, type, and preview image metadata.
- Added Twitter large-card title, description, and preview image metadata.
- Updated the Next metadata contract to match the hosted public positioning.
- Added release-smoke assertions so future public builds fail if canonical/social-preview tags are removed.
- Tightened the first-screen landing copy for social visitors.
- Changed the primary public CTA to `Request early access`.
- Added an early-access flow note explaining invite priority vs Management review.
- Added a four-step landing section that explains account creation, invite/request path, approval, and sign-up help.
- Changed the proof and value grids to four equal desktop columns so the current four-card content reads intentionally.
- Added a self-hosted FoxHub social preview image at `/foxhub-social-preview.png`.

## Public Ad URL

Use the direct Firebase Hosting URL until the preferred custom domain is connected:

```text
https://foxhub-superapp.web.app/?utm_source=facebook&utm_medium=paid-social&utm_campaign=founding-members
```

Suggested variants:

```text
https://foxhub-superapp.web.app/?utm_source=instagram&utm_medium=paid-social&utm_campaign=private-circles
https://foxhub-superapp.web.app/?utm_source=local&utm_medium=flyer&utm_campaign=trusted-local-help
https://foxhub-superapp.web.app/?utm_source=tiktok&utm_medium=paid-social&utm_campaign=early-access
```

## Current Entry Flow

- `/` remains the public landing page for ad clicks.
- Landing "Join FoxHub" opens `/signin` in sign-up mode.
- `/signin` remains the consolidated member sign-in/sign-up route.
- `/feedback` remains the public sign-up help route for visitors who get stuck.
- `/management` remains separate for staff/founder/admin access and should not be used in ads.

## Guardrails

- Market FoxHub as an early-access community/trust app, not as a finished bank, payment processor, or full public marketplace.
- Keep claims tied to current public behavior: private circles, local help, trusted recommendations, events/plans, member-first access, and sign-up review.
- Use UTM parameters on every paid link so the landing campaign note and local campaign capture can identify traffic source.
- Keep `support@foxhub.app` monitored while ads are active because `/feedback` prepares support emails there.

## Verification

Completed before deploy:

- `npm run release:check` (pass)
  - `npm test` (pass)
  - `npm run smoke:public` (pass)
  - `npm run build` (pass)

Smoke coverage now checks:

- canonical public URL metadata
- Open Graph public title
- Open Graph public description
- Twitter large-card metadata
- existing UTM/campaign, footer, auth, profile, theme, and public-signup markers

Completed after deploy:

- `npm run deploy:hosting` (pass)
- live `/` HTTP 200
- live campaign URL HTTP 200
- live `/signin` HTTP 200
- live `/feedback` HTTP 200
- live `/management` HTTP 200
- live HTML contains canonical, Open Graph, and Twitter preview metadata
- live `Last-Modified`: `Wed, 10 Jun 2026 01:46:11 GMT`

Second polish pass before broader social traffic:

- `npm run release:check` (pass)
- local desktop screenshot rendered the public campaign URL with the revised hero, campaign source note, early-access flow note, CTA set, and preview imagery
- local mobile screenshot rendered the same campaign URL without visible text overlap or broken CTA layout
- `npm run deploy:hosting` (pass)
- live `/foxhub-social-preview.png` HTTP 200 with `content-type: image/png`
- live campaign URL desktop and mobile screenshots rendered after deploy
- final live `Last-Modified`: `Wed, 10 Jun 2026 01:53:20 GMT`

## Files Changed

- `index.html`
- `app/layout.jsx`
- `scripts/release-smoke.mjs`
- `src/App.jsx`
- `src/styles.css`
- `public/foxhub-social-preview.svg`
- `public/foxhub-social-preview.png`
- `docs/AD_TRAFFIC_PREP_2026-06-10.md`
- `docs/DOCS_INDEX.md`
- `docs/PROJECT_STATUS.md`
- `docs/CURRENT_HANDOFF_2026-05-31.md`
