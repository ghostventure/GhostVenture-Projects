# Universal Bill Pay Install - 2026-04-23

## Summary

FoxHub now includes a universal utility bill-pay surface inside the existing Pay workspace.

The install adds biller-ready wallet UX for utility services without changing the current payment architecture. It remains a simulated client-side product surface until real biller, ACH, card, and compliance providers are connected.

## Installed

- Added `Utility Bill Pay` to the Money service catalog.
- Added a `Bill Pay` utility card beside Money, MerchantOps, Scan, Cards, and Saved.
- Added seeded billers for electric, water, internet, and mobile service accounts.
- Added seeded scheduled bill-pay ledger entries.
- Added a `Universal Bill Pay` connector in the wallet/tooling connector catalog.
- Added a Pay-tab bill-pay panel with:
  - biller readiness count
  - account masks
  - due amounts
  - due dates
  - autopay status
  - account-confirmation status
  - receipt status
- Wired `Pay next bill` through the existing wallet event and moderation path as a `utility` wallet action.

## Files Changed

- `src/data.js`
- `src/repository-local.js`
- `src/repository-firebase.js`
- `src/repository-locked.js`
- `src/App.jsx`
- `src/FoxHubShell.jsx`
- `src/transaction-moderation.js`
- `src/styles.css`

## Behavior

The Pay tab now shows a Universal bill pay section below the standard wallet controls.

The seeded billers are:

- Power Grid - electric
- City Water - water
- Connect Fiber - internet
- Metro Mobile - mobile

The `Bill Pay` utility card opens the same wallet path and records a utility bill payment event. The current event uses the existing local/Firebase wallet event model rather than moving real money.

## Persistence

The bill-pay seed state is included in:

- local browser state hydration
- Firebase-backed state hydration and persistence
- locked native seed state

New persisted fields:

- `utilityBillPayProviders`
- `utilityBillPayPayments`

## Verification

Passed before deploy:

- `node --check src/data.js`
- `npm run vite:build`
- `npm test`

Note: direct `node --check` on `.jsx` files is not supported in this ESM package; the Vite build covered the React/JSX integration.

## Deploy

Firebase Hosting deploy command:

```sh
npm run deploy:hosting
```

Hosting target:

- `https://foxhub-superapp.web.app`
- preferred public URL remains `https://foxhub.com`

Deploy result:

- `npm run deploy:hosting` passed.
- Firebase Hosting project: `foxhub-superapp`
- Live home route smoke returned `200`.
- Built Hosting bundle contains the Universal Bill Pay state and Pay workspace UI strings.

## Production Notes

This is a product-surface install, not a regulated live bill-payment processor.

Before enabling real money movement, FoxHub still needs:

- biller directory/provider integration
- account verification flow
- ACH/card rail integration
- biller payment-status webhooks
- receipt reconciliation
- NACHA/card-network compliance review
- money-transmission and bill-payment regulatory review
- user-facing payment authorization, cancellation, and error states
