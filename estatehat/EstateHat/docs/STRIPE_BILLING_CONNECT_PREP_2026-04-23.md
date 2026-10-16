## Stripe Billing / Connect Prep

Date: 2026-04-23

### Status

This is an implementation-prep record. The code is wired, but it is not deployed yet.

Blocked items before go-live:

- Firebase project needs Blaze enabled for Cloud Functions usage.
- Stripe secrets and price IDs need to be set in Firebase Functions secrets.
- `functions/` dependencies need to be installed before functions deploy.

### Added

- Firebase Functions scaffold in `functions/`
- Stripe-backed endpoints for:
  - verified membership subscription checkout
  - billing portal session
  - Stripe Connect onboarding link
  - Stripe Connect status refresh
  - one-time platform fee checkout
  - Stripe webhook processing
- Frontend wiring in `My Info > Financial` for:
  - real Verified billing checkout / portal launch
  - Stripe Connect onboarding and refresh
  - one-time platform fee collection
- Firebase Hosting rewrite for `/api/stripe/**`

### Required secrets

Set these before deploy:

```bash
firebase functions:secrets:set STRIPE_SECRET_KEY
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
firebase functions:secrets:set STRIPE_VERIFIED_PROFILE_PRICE_ID
```

### Local install

```bash
cd functions
npm install
```

### Deploy sequence

```bash
npm run build
npx firebase-tools deploy --only functions,hosting --project estatehat
```

### Notes

- Verified membership now expects Stripe Checkout and the Stripe customer portal instead of local-only activation toggles.
- Platform fee checkout is intended for specifically disclosed direct fee collection. Closing-side 1.50% deductions can still remain in the escrow/closing workflow when that is the correct settlement path.
