# FoxHub Black-Collar Service Cats - 2026-04-19

FoxHub now has a matching category/subcategory layer for black-collar services, defined here as heavy, dirty, hazardous, industrial, energy, waste, field, transport, and infrastructure work.

## What Changed

- Added `blackCollarServiceCategories` to `src/data.js`.
- Installed 10 plain-language black-collar categories:
  - Industrial Maintenance
  - Waste And Environmental
  - Energy And Utilities
  - Oil Gas And Field
  - Mining And Materials
  - Demolition And Salvage
  - Heavy Transport
  - Marine Rail Aviation
  - Hazard And Confined Space
  - Infrastructure And Civil
- Added 140 subcategories across those groups.
- Added 40 lightweight support components for site access, safety checks, work orders, manifests, dispatch, permits, service logs, disposal proof, load details, inspection notes, and completion photos.
- Reused the same simple category panel used by blue-collar and white-collar services.
- Added the section to the user Services `Catalog` tab.
- Added the section to the merchant `Shops` view with merchant-facing labels.
- Synced Android and iOS wrapper assets and deployed Firebase Hosting.

## Files

- `src/data.js`
- `src/FoxHubShell.jsx`

## Verification

- Data count check confirmed:
  - 10 black-collar categories
  - 140 black-collar subcategories
  - 40 black-collar support components
- Blue-collar counts still confirmed:
  - 10 categories
  - 147 subcategories
  - 40 support components
- White-collar counts still confirmed:
  - 10 categories
  - 140 subcategories
  - 40 support components
- `npm test` passed.
- `npm run build` passed.
- `npm run sync:android` passed.
- `npm run sync:ios` passed.
- `npx firebase-tools deploy --only hosting --project foxhub-superapp` passed.
- Hosted smoke checks confirmed the deployed bundle includes `Black-collar cats and sub-cats`, `Merchant black-collar cats`, `Industrial Maintenance`, `Waste And Environmental`, `Oil Gas And Field`, `Hazard And Confined Space`, and `Infrastructure And Civil`.

## Recovery Notes

- Black-collar data lives in `blackCollarServiceCategories` in `src/data.js`.
- Blue-collar, white-collar, and black-collar sections all render through `ServiceCategoryPanel` in `src/FoxHubShell.jsx`.
- Subcategory chips currently route through each category's `serviceId`, keeping the GUI simple and behavior tied to existing service flows.
