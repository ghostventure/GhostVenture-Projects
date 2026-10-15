# FoxHub White-Collar Service Cats - 2026-04-19

FoxHub now has a matching category/subcategory layer for white-collar and professional services on both the user and merchant sides.

## What Changed

- Added `whiteCollarServiceCategories` to `src/data.js`.
- Installed 10 plain-language professional service categories:
  - Business Admin
  - Finance And Accounting
  - Legal And Compliance
  - Marketing And Growth
  - Creative And Content
  - Tech And Digital
  - Sales And Customer
  - HR And Talent
  - Real Estate Professional
  - Education And Consulting
- Added 140 subcategories across those groups.
- Added 40 lightweight support components for intake, document checklists, approvals, reporting, campaign briefs, creative briefs, access checklists, lead pipeline, hiring, property files, and training outcomes.
- Reused the same simple category panel as the blue-collar section.
- Added the section to the user Services `Catalog` tab.
- Added the section to the merchant `Shops` view with merchant-facing labels.
- Synced Android and iOS wrapper assets and deployed Firebase Hosting.

## Files

- `src/data.js`
- `src/FoxHubShell.jsx`

## Verification

- Data count check confirmed:
  - 10 white-collar categories
  - 140 white-collar subcategories
  - 40 white-collar support components
- Blue-collar counts still confirmed:
  - 10 categories
  - 147 subcategories
  - 40 support components
- `npm test` passed.
- `npm run build` passed.
- `npm run sync:android` passed.
- `npm run sync:ios` passed.
- `npx firebase-tools deploy --only hosting --project foxhub-superapp` passed.
- Hosted smoke checks confirmed the deployed bundle includes `White-collar cats and sub-cats`, `Merchant white-collar cats`, `Business Admin`, `Finance And Accounting`, `Legal And Compliance`, `Tech And Digital`, and `HR And Talent`.

## Recovery Notes

- White-collar data lives in `whiteCollarServiceCategories` in `src/data.js`.
- Both blue-collar and white-collar sections render through `ServiceCategoryPanel` in `src/FoxHubShell.jsx`.
- Subcategory chips currently route through each category's `serviceId`, keeping the GUI simple and behavior tied to existing service flows.
