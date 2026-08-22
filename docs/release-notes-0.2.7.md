# OverHead 0.2.7

## Included improvements

- Corrected shared sign-in handling so a remembered Firebase `Administrator` role does not fail desktop-role validation.
- Hardened the Windows installer for machine-wide upgrades while preserving app data.
- Added embedded Stripe Checkout, duplicate-checkout protection, central entitlements, automatic per-user licenses, full subscription receipt PDFs, cancellation with unused-time refunds, and a billing activity view.
- Added a one-time, card-free, 30-day Gold-equivalent trial with exact expiry enforcement and automatic license suspension.
- Added billing, free-trial, cancellation/refund, and workspace-license policy drafts with acknowledgement gates.
- Improved account profiles with readiness status, workspace/license context, safer owner controls, and shared Firebase-profile synchronization when the owner is signed in.

## Live deployment boundary

The desktop installer contains the user interface and secure request paths. Live checkout, trial activation, cancellation, refunds, billing activity, and scheduled trial expiry require the deployed Firebase Functions plus the Stripe configuration in `stripe-embedded-checkout-setup.md`.

## Verification completed

- Electron main, preload, and backend syntax checks
- Firebase Function syntax check
- Production Vite build
- Windows NSIS x64 installer build
- SHA-256 checksum generation
- Packaged-ASAR content check for new profile and billing behavior

## Remaining external prerequisites

- Firebase Blaze billing and authenticated project deployment. Spark cannot enable the Functions build APIs or host the Windows `.exe` update artifact.
- Stripe test secret, webhook secret, publishable key, and three Price IDs
- Stripe webhook endpoint registration
- Production code-signing certificate before public distribution
