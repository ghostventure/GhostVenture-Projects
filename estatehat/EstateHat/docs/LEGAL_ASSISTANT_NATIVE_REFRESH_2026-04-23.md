## Legal / Assistant / Native Refresh

Date: 2026-04-23

### Scope

This release aligned the legal/help/assistant surfaces with the updated EstateHat fee model and refreshed the native wrapper management paths.

### Included changes

- Updated legal and help language so the `1.50%` EstateHat platform fee is described consistently as:
  - buyer-paid by default on top of sale price
  - seller-pay only when the seller explicitly elects to absorb it
- Updated assistant disclosure copy and added a direct assistant topic for:
  - who pays the EstateHat fee
  - where to find the relevant disclosures
- Updated transaction/payment guidance language to match the same fee model.
- Refreshed native wrapper management paths:
  - Android Capacitor sync
  - iOS Capacitor sync
  - Windows desktop build path

### Verification

- `npm run sync:android` passed
- `npm run sync:ios` passed
- `npm run build:windows` passed
- `npm run build` passed
- `npm run deploy:hosting` passed

### Production

- `https://estatehat.web.app`
