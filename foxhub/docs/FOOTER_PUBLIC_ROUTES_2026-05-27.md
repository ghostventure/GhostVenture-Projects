# FoxHub Footer Public Routes - 2026-05-27

## Summary

Installed public footer destinations so footer boilerplate items are no longer visual-only tags.

## Implementation

- Added route helpers in `src/footerBoilerplates.js`.
- Footer items now link to `/footer/{section}/{page}`.
- Added a public `FooterInfoPage` in `src/App.jsx`.
- Splash and authenticated footers share the same footer source.
- Added responsive styling for footer detail pages.

Example route:

- `/footer/legal/privacy-policy`

## Verification

Covered by:

- `npm run smoke:public`: pass
- `npm run release:check`: pass
- `npm run deploy:hosting`: pass
- live `/footer/legal/privacy-policy`: HTTP 200
- live bundle contains `Privacy Policy`, `Boilerplate page`, `footer-info-page`, and `foundation-readiness-checklist`

The smoke script verifies:

- footer section count
- Organizer count
- footer route lookup
- splash footer bundle text
- footer detail styles
