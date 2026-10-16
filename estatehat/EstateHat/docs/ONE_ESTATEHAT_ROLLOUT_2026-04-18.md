# One EstateHat Rollout - 2026-04-18

EstateHat now presents the account system as one shared account across the platform.

## What Changed

- Added `oneEstateHatId` to the persisted Firestore user profile.
- Added `buildOneEstateHatId()` in `src/backend.js`.
- Bumped `USER_PROFILE_SCHEMA_VERSION` from `13` to `14`.
- Updated Firestore rules so `users/{uid}` allows the new `oneEstateHatId` field and requires schema version `14`.
- Updated the public landing page and auth screen with plain "One EstateHat" wording.
- Added One EstateHat visibility in the My Info profile view.
- Updated Terms and Privacy wording so users understand the same account covers listings, search, messages, forms, Hat Data, Goodies, documents, support, and closing steps.

## Files

- `src/backend.js`
- `firestore.rules`
- `src/AuthScreen.jsx`
- `src/MarketingLanding.jsx`
- `src/estatehat-platform-alpha.jsx`
- `tests/compliance-mechanics.test.mjs`

## Recovery Notes

- One EstateHat is generated from the Firebase Auth UID.
- User profiles still live in `users/{uid}`.
- The generated field is `oneEstateHatId`.
- Firestore profile schema is now `14`.
- Deploy hosting and Firestore rules together when this field changes.

## Verification

- `npm test` passed.
- `npm run build` passed.
- `npm run sync:android` passed.
- `npm run sync:ios` passed.
- Build completed with the existing large chunk warning for the authenticated bundle.
- `npx firebase-tools deploy --only hosting,firestore:rules --project estatehat` passed.
- Live smoke confirmed the deployed bundle includes `One EstateHat` and `oneEstateHatId`.
- Live smoke confirmed `/signin` and `/landing` serve the deployed EstateHat shell.
- Firestore rules compiled and released with `oneEstateHatId` and schema version `14`.
