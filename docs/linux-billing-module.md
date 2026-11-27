# OverHead Linux billing module

OverHead for Linux opens **Billing & Payments** as a dedicated Electron window from the Plans page. It reuses the app's authenticated billing service and shared workspace entitlement; it does not keep a second login or a second payment database.

## Payment flow

- The owner signs in to OverHead, selects Silver, Gold, or Black, enters the billing address, and accepts the recurring billing and cancellation terms.
- The Linux window asks the existing `billingApi` function to create an embedded Stripe Checkout session. Stripe collects payment details in its hosted checkout frame; no card number or CVC is handled by OverHead.
- The signed Stripe webhook remains the source of truth for paid access, subscription changes, and member license updates. The module refreshes the shared entitlement after checkout.
- Owners can start the one-time no-card trial, review billing activity, create a subscription receipt, or cancel and request a refund for eligible unused time.

Stripe secret keys and webhook signing secrets stay in Firebase Functions. The Linux desktop calls the same server endpoints as the existing desktop billing flow; it does not need a Stripe secret in the package.

## Build on Linux

```sh
npm ci
npm run desktop:linux
npm run dist:linux
```

`dist:linux` creates x64 AppImage and Debian packages in `release/`. Linux auto-updates use the GitHub release feed at `https://github.com/ghostventure/GhostVenture-Projects/releases/download/overhead-linux-latest`. Each release needs a matching `latest-linux.yml` and AppImage asset in that stable release; Debian users can download and install the `.deb` package directly.

The app can be built locally without deploying. Paid checkout and startup plan verification depend on the updated `billingApi` being deployed, Stripe prices and secrets being configured, and a signed webhook being active. Do not treat a local package build as proof that a live payment succeeded.
