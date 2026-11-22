# Future Stripe billing setup

**Current status (2026-11-22): paid checkout, the Stripe portal, and paid cancellation/refunds are not enabled.** Firebase has a no-Stripe `billingApi` compatibility endpoint from the `trial` codebase; it serves trials and entitlement reads, and returns 503 for paid actions. It cannot process Stripe payments or webhooks. The full Stripe implementation in `functions/index.js` is not deployed. The public account page is read-only.

This document is a setup checklist for a later test-mode billing rollout. Do not follow it with live Stripe values or present a payment flow as available until the full test checklist passes.

## Service boundary

The paid billing server source is in `functions/`, deployed as the Firebase `default` codebase. Stripe secret keys and webhook secrets must never be packaged into OverHead or included in the website bundle.

The no-card trial service is isolated in `functions-trial/` and exports `overheadTrialApi` for Mac Suite and `billingApi` for the currently published Windows app. Neither uses Stripe credentials. Deploy them independently with:

```sh
firebase deploy --config firebase.overhead.json --only functions:trial:overheadTrialApi,functions:trial:billingApi --project overhead-office --non-interactive
```

The same codebase exports `checkWorkspaceDuplicate` for pre-signup duplicate detection. It compares a submitted business name with existing workspace profiles using exact and similar-name matching, with owner-name similarity considered only alongside a partial business-name match. It returns only `possibleDuplicate: true/false`, not matched workspace names, emails, or IDs. The endpoint is limited to 12 requests per IP address per 15 minutes. A possible match prompts users to reuse/sign in to the existing account or confirm creation of a separate workspace; if the endpoint is unavailable, signup stops before creating an account. This is an advisory duplicate-workspace/trial guard, not a billing action. Paid checkout and cancellation remain disabled.

## Configure Stripe test mode

1. Confirm `overhead-office` is on the Firebase Blaze plan.
2. In Stripe test mode, create recurring monthly Prices for Silver, Gold, and Black.
3. Install dependencies from `functions/`:

   ```sh
   cd functions
   npm install
   ```

4. Set the Stripe **test-mode** API secret through Firebase CLI. Enter the real test-mode value when prompted; never put it in source control, chat, the desktop app, or a website `.env` file.

   ```sh
   firebase functions:secrets:set STRIPE_SECRET_KEY --project overhead-office
   ```

5. Create an ignored local `functions/.env.overhead-office` file for non-secret test configuration:

   ```text
   STRIPE_PUBLISHABLE_KEY=pk_test_replace_me
   STRIPE_PRICE_SILVER=price_replace_me
   STRIPE_PRICE_GOLD=price_replace_me
   STRIPE_PRICE_BLACK=price_replace_me
   BILLING_RETURN_URL=https://overhead-office.web.app/account/
   ```

   Replace each placeholder with the correct Stripe test-mode value. Do not commit the file.

6. **Plan the Functions codebase migration before deploying paid billing.** The current `billingApi` name belongs to the no-Stripe `trial` codebase. The Stripe implementation in `functions/index.js` uses the same function name. Do not deploy it over the existing endpoint without a planned replacement and continuity procedure. The current compatibility endpoint does not process webhooks.

7. After the full Stripe implementation owns its endpoint, add that endpoint's `/webhook` path in Stripe test mode. Subscribe to `checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, and `customer.subscription.deleted`. Store its signing secret in Firebase Secret Manager:

   ```sh
   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET --project overhead-office
   ```

8. Deploy only the migrated paid API and expiration scheduler from the intended codebase. Avoid deploying the entire default codebase: it contains older exports that are not represented by current source.

## Required checks before enabling paid billing

Use Stripe test mode and a dedicated test workspace. Confirm:

1. No-card trial start creates no Stripe customer, Checkout Session, or charge; a second trial request is refused.
2. Trial status and a license for each active member are recorded, then suspended at expiry.
3. Embedded test checkout completes and a valid signed webhook activates the correct tier.
4. Duplicate checkout is blocked.
5. Cancellation and any unused-time refund occur once, with matching billing activity and suspended licenses.
6. Replayed webhooks do not duplicate entitlement or refund changes.
7. Browser account and Mac entitlement views resolve the same workspace state.

Do not change test keys or Prices to live values until every check passes and final customer billing terms are ready.

## Current client behavior

- The website `/account/` panel reads the entitlement but does not start trials or paid billing actions.
- Mac Suite 0.1.4 uses `overheadTrialApi` for its no-card trial and entitlement refresh. It does not offer paid checkout or paid cancellation.
- Windows Suite 0.3.27 calls the no-Stripe `billingApi` compatibility endpoint. Trial and entitlement actions are supported; checkout and paid cancellation return 503 without starting a payment or changing billing.
- A local plan label or manually entered payment reference is not proof of an active paid entitlement.

The trial endpoints allow browser requests only from `https://overhead-office.web.app` and `https://overhead-office.firebaseapp.com`. The duplicate-check endpoint uses the same browser origin allow-list; native Mac requests omit the Origin header and are limited by IP rate control. Keep the browser CORS allow-list narrow. Before publishing any account UI that starts charges, first migrate the paid API, deploy it, and complete every test above.
