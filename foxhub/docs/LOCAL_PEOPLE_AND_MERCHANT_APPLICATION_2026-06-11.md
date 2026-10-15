# Local People and Merchant Application - 2026-06-11

## Summary

Installed a member-facing `People local to you` feature based on the ZIP code saved on the member profile, plus a simple in-app `Apply to become a merchant` workflow.

## What Changed

- Added `zipCode` and `postalCode` to member profile normalization, defaults, local persistence, and Firebase profile persistence.
- Added ZIP capture to member signup surfaces, onboarding profile fields, and the profile editor.
- Seeded nearby members with ZIP data so the Home workspace can show local matches immediately.
- Replaced the old unfiltered `People nearby & matches` card with `People local to you`.
- Local people are matched by exact ZIP first, with city fallback only when a ZIP is present but has no current seeded match.
- If the member has no ZIP, the card prompts them to open profile settings and add one.
- Added a simple merchant application form in Services for business name, business type, category, ZIP, city, website, and description.
- Submitting the merchant application creates a merchant onboarding queue item, risk signal, notification, profile merchant status, and audit event for FoxHub Management review.
- When staff advances the merchant onboarding item to active, the member profile becomes an approved merchant account.
- Approved merchants see a `Merchant dashboard` instead of the application prompt.
- The merchant dashboard includes seller status, inventory, orders, payout cadence, storefront settings, fulfillment mode, returns policy, and save actions.
- Release smoke now checks for the local people and merchant application bundle markers.

## Operational Notes

- ZIP is not required for signup readiness, so paid-traffic signup friction stays low.
- Merchant approval still respects the existing 90-day account-age gate.
- Staff can review submitted applications from the existing merchant onboarding and risk controls.
- Approved seller controls are intentionally lightweight in this pass; payment capture, tax filing, and bank onboarding still require production provider wiring before real commerce.

## Verification

- `node --check src/rules.js src/repository-local.js src/repository-firebase.js src/useFoxHubStore.js`
- `npm run build`
- `npm run release:check`
- Full release check and Hosting deploy are recorded in the handoff after this release is published.
