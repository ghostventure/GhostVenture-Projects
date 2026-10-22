# Stripe server readiness

## Current status ? 2026-10-22

Paid billing is not deployed in Firebase project `overhead-office`. Live Functions are `cylinderApi`, `expireTrials`, and `trialApi`; `billingApi` is absent. The website billing view is read-only, and Desktop/Cylinder read shared entitlement and license state. The live no-card 90-day Gold trial is provided by `trialApi`, not Stripe.

The checklist below describes future deployment requirements, not current production behavior. See `shared-identity-and-entitlements.md` for verified paths.

- Do not store Stripe secret keys, restricted keys, or webhook signing secrets in Electron, local app data, or the website bundle.
- Once implemented and deployed, the server must create Checkout Sessions and verify Stripe webhook signatures before changing a subscription or entitlement.
- Stripe event processing must be idempotent and retain the Stripe event ID so a retried event cannot grant access twice.
- Test mode comes first. A test Checkout completion and signed webhook must be recorded before live mode is considered.
- Live mode requires a public HTTPS webhook endpoint, server-managed secrets, and a successful end-to-end payment verification.
