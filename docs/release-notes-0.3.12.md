# OverHead Desktop 0.3.12

- Stripe test setup validates account/client references and rejects secret or live keys. Saved details are explicitly unverified.
- Desktop reads the same protected workspace billing and member-license documents as the website. Inactive, unknown, or expired trial states no longer become active trials during refresh.
- Payments provides manual sync, last successful refresh, shared sign-in status, actionable failures, and busy controls. Shared billing refresh runs every five minutes during a standard staff session.

No Stripe merchant authorization or live charges are enabled by this update. At release preparation, overhead-office had no deployed billing functions or STRIPE_SECRET_KEY secret. Live checkout still requires secure server configuration and end-to-end Stripe test verification.

## Published release

Published September 7, 2026. Artifacts and verification results are in `release-stripe-0.3.12/`. The installer remains unsigned, consistent with the prior release.

Seven connector tests passed, Electron syntax checks and the production build passed, and lint reported four existing warnings. Packaged code reached the sign-in screen using an isolated profile. The deployed installer and ZIP were downloaded and their hashes matched the local artifacts; the update manifest and checksum file also matched. The 0.3.10 download redirects to 0.3.12.

The live website was newer than `website-deploy/`. Deployment preserved the live version's files and configuration and added only desktop artifacts, checksums, and redirects, using `scripts/deploy-desktop-update.cjs`. The live home-page hash remained identical. Do not redeploy the stale local website tree without reconciling the newer live website first.

Live Stripe checkout and authenticated billing sync against a real customer account were not exercised. Shared billing behavior was verified with controlled server responses, including account changes during sync and missing or expired billing records.
