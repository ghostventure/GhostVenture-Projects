# Invest Page Release

Date: 2026-05-05

## Summary

EstateHat now has a dedicated public investor page at `/invest` on the Next.js public route surface.

The page is intended to give a brief but detailed overview for investor, finance, and strategic partner conversations without turning the public site into a full investor-relations portal.

## What Changed

- Added a standalone Next route at `/invest`.
- Added `InvestView` to the shared public page registry.
- Added `/invest` to the compatibility redirect map used by `/public?page=...`.
- Added `Invest` to public footer company navigation so it is reachable from the landing and sign-in public shells.
- Added investor-facing content covering:
  - company/entity snapshot
  - platform model
  - current fee model
  - operating signals
  - financial goals and operating aims
  - investor welcome and capital-stewardship positioning
  - milestone and use-of-funds framing
  - diligence map, risk posture, and investor FAQ sections
  - investor contact information
  - no-solicitation / no-investment-advice disclaimer
- Added investor action components for:
  - investor packet access
  - data room request
  - investor updates sign-up by email
  - intro-call request
  - Square invoice link placeholder pending live link handoff
- Added investor-download assets in `public/investor/`:
  - `estatehat-investor-brochure.pdf`
  - `estatehat-business-plan.pdf`
  - `estatehat-financial-goals-model.pdf`
- Added HTML source files used to render those PDFs so future edits stay repository-native.

## Files

- `app/invest/page.jsx`
- `app/public/page.jsx`
- `public/investor/estatehat-investor-brochure.html`
- `public/investor/estatehat-investor-brochure.pdf`
- `public/investor/estatehat-business-plan.html`
- `public/investor/estatehat-business-plan.pdf`
- `public/investor/estatehat-financial-goals-model.html`
- `public/investor/estatehat-financial-goals-model.pdf`
- `src/PublicBoilerplatePage.jsx`
- `src/EstateHatPublicFooter.jsx`
- `src/estatehat-platform-alpha.jsx`

## Verification

- `npm run build`: passed
- Generated route confirmed in Next build output:
  - `/invest`
- PDF generation passed with Chromium headless for all three investor assets.
- Public investor page now includes shared footer navigation back into the public site.
- Android wrapper refresh passed via `npm run sync:android`.
- Windows desktop shell refresh passed via `npm run build:windows`.

## Deploy

- Hosting deploy command: `npm run deploy:hosting`
- Target site: `https://estatehat.web.app/invest`
- Deployment result: successful on 2026-05-05
- Live fetch check: `curl -L --silent https://estatehat.web.app/invest`
- Android sync command: `npm run sync:android`
- Windows desktop refresh command: `npm run build:windows`

## Known Deploy Warnings

Firebase Hosting still reported the existing unresolved function-endpoint warnings during release finalization:

- `apiHealth`
- `apiSessionBootstrap`
- `apiListingOps`
- `stripeApi`

These warnings did not block the Hosting release of the static Next build for `/invest`.

## Notes

This page is an informational company overview, not a securities offering page. Any financing or investment discussion should continue offline through `investors@estatehat.com` and appropriate advisors.
