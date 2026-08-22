# Stripe server readiness

OverHead is intentionally test-only until a server-side checkout and webhook handler is deployed.

- Do not store Stripe secret keys, restricted keys, or webhook signing secrets in Electron, local app data, or the website bundle.
- The server will create Checkout Sessions and verify Stripe webhook signatures before changing a subscription or entitlement.
- Stripe event processing must be idempotent and retain the Stripe event ID so a retried event cannot grant access twice.
- Test mode comes first. A test Checkout completion and signed webhook must be recorded before live mode is considered.
- Live mode requires a public HTTPS webhook endpoint, server-managed secrets, and a successful end-to-end payment verification.
