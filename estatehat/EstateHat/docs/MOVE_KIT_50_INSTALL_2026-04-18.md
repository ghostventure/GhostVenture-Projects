# EstateHat Move Kit 50 Install - 2026-04-18

Installed 50 new EstateHat helper components, features, and UX/UI surfaces as a separate workspace named **Move Kit**.

## Scope

This did not replace or enhance the existing Hat Data or Goodies installs. Move Kit is a new workspace for plain-language buyer, seller, document, closing, and trust helpers.

## Installed Groups

- Closing Path: 10 items
- Forms And Documents: 10 items
- Buyer Help: 10 items
- Seller Help: 10 items
- Trust And Safety: 10 items

## Notable Items

- Closing Confidence Table
- Deal Timeline With Traffic Lights
- Plain-English Document Explainer
- Missing Document Detector
- Offer Strength Meter
- First-Time Buyer Mode
- Seller Readiness Score
- Listing Photo Quality Coach
- Fair Housing Copy Guard
- Wire Fraud Warning Panel

## Files

- `src/EstateHatMoveKit.jsx`
- `src/estatehat-platform-alpha.jsx`

## Integration

- Added Move Kit route: `move-kit`
- Added Move Kit to top navigation with a `50` badge.
- Added Move Kit to command search.
- Added Move Kit to footer product links.
- Updated EstateHat Assistant with Move Kit actions and explanations.
- Updated Help Center, FAQ & Scope, Terms, and Privacy copy so Move Kit is legally scoped as a product helper surface.

## Verification

- `npm test` passed.
- `npm run build` passed.
- `npm run sync:android` passed.
- `npm run sync:ios` passed.
- `npm run deploy:hosting` passed and released to `https://estatehat.web.app`.
- Live smoke confirmed `/signin` returns the EstateHat shell with the deployed app bundle.
- Live smoke confirmed `/move-kit` returns the EstateHat shell with the deployed app bundle.
- Live smoke confirmed the deployed main bundle contains `Move Kit`, `move-kit`, and `EstateHatMoveKit`.
- Live smoke confirmed the deployed Move Kit chunk contains `Closing Confidence Table`, `Fair Housing Copy Guard`, `Move Kit`, and `estatehat-move-kit-v1`.

## Recovery Notes

- Move Kit state is stored locally under `estatehat-move-kit-v1`.
- The item registry is `MOVE_KIT_GROUPS` and `MOVE_KIT_ITEMS` in `src/EstateHatMoveKit.jsx`.
- Existing Hat Data count remains `50`.
- Existing Goodies count remains `94`.
- Move Kit count is `50`.
