# FoxHub 100-Service Catalog - 2026-04-19

FoxHub Services now has a larger useful-service catalog instead of only the five starter actions.

## What Changed

- Expanded `services` from 5 starter actions to 100 service entries.
- Organized the catalog into 10 categories with 10 services each:
  - Identity
  - Money
  - Market
  - Food
  - Events
  - Work
  - Housing
  - Mobility
  - Business
  - Community
- Added a `Catalog` tab inside Services with search and category filtering.
- Added the same catalog to the merchant side through the `Shops` tab as `Merchant service catalog`.
- Merchant-side catalog includes business-ready services for money, market, food, events, work, mobility, business, and community/support flows.
- Kept the existing core service actions for QR scan, merchant pay, MerchantOS, RideGrid, and FoxTickets.
- Added generic routing for all other service cards so opening a service saves it and routes to the right FoxHub area.
- Limited the Home quick-service preview to the first 12 services so the main home screen stays usable.
- Synced Android and iOS wrapper assets and deployed Firebase Hosting.

## Files

- `src/data.js`
- `src/FoxHubShell.jsx`
- `src/App.jsx`
- `src/repository-local.js`
- `src/styles.css`

## Verification

- Service count check confirmed 100 total services, 10 per category.
- `npm test` passed.
- `npm run build` passed.
- `npm run sync:android` passed.
- `npm run sync:ios` passed.
- `npx firebase-tools deploy --only hosting --project foxhub-superapp` passed.
- Hosted smoke checks confirmed the deployed bundle includes `Service catalog`, `Merchant service catalog`, `OneID Vault`, `Kitchen Pop-Ups`, and `Build My Platform`.

## Recovery Notes

- The catalog is generated from `serviceGroups` in `src/data.js`.
- If Services looks stale in local fallback mode, `src/repository-local.js` now upgrades older saved service arrays when the seed catalog grows.
- If a service needs special behavior, add it to `runService()` in `src/App.jsx`; otherwise it uses generic routing based on `service.surface` or `service.type`.
- The merchant-side view is filtered in `ServicesWorkspace()` in `src/FoxHubShell.jsx`.
