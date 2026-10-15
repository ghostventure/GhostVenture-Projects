# FoxHub Blue-Collar Service Cats - 2026-04-19

FoxHub now has a simple category/subcategory layer for blue-collar services on both the user and merchant sides.

## What Changed

- Added `blueCollarServiceCategories` to `src/data.js`.
- Installed 10 plain-language service categories:
  - Fix My Home
  - Build Or Remodel
  - Yard And Outside
  - Clean And Turn Over
  - Move Or Haul
  - Auto And Equipment
  - Food And Events
  - Business And Facilities
  - Safety And Damage Help
  - Local Task Help
- Added 147 subcategories across those groups.
- Added 40 lightweight support components across the categories:
  - quote and scope fields
  - proof photos and evidence
  - arrival windows and scheduling
  - payment, payout, warranty, compliance, and trust notes
- Added a simple `BlueCollarCategoryPanel` in `src/FoxHubShell.jsx`.
- Added the panel to the user Services `Catalog` tab.
- Added the same panel to the merchant `Shops` view with merchant-facing labels.
- Kept the GUI simple: category chips, selected category summary, subcategory chips, and a short component strip.
- Synced Android and iOS wrapper assets and deployed Firebase Hosting.

## Files

- `src/data.js`
- `src/FoxHubShell.jsx`
- `src/styles.css`

## Verification

- Data count check confirmed:
  - 10 categories
  - 147 subcategories
  - 40 support components
- `npm test` passed.
- `npm run build` passed.
- `npm run sync:android` passed.
- `npm run sync:ios` passed.
- `npx firebase-tools deploy --only hosting --project foxhub-superapp` passed.
- Hosted smoke checks confirmed the deployed bundle includes `Blue-collar cats and sub-cats`, `Merchant cats and sub-cats`, `Fix My Home`, `Auto And Equipment`, `Business And Facilities`, and `Safety And Damage Help`.

## Recovery Notes

- Category data lives in `blueCollarServiceCategories` in `src/data.js`.
- The user and merchant panels both use `BlueCollarCategoryPanel` in `src/FoxHubShell.jsx`.
- Subcategory chips currently route through each category's `serviceId`, keeping behavior simple and tied to existing service flows.
- If deeper behavior is needed later, add category-specific or subcategory-specific handling in `runService()` in `src/App.jsx`.
