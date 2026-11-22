# Production readiness

For observed deployed releases, updater feeds, and Firebase backend status, start with `docs/current-handoff-2026-11-22.md`. The August handoff is historical.

## Current release stage (2026-11-22)

- The website and browser demo are live. The Download page links to Windows Suite 0.3.27, Install Manager 2026-11-01, Mac Suite 0.1.4, and Cylinder 0.3.27.
- Windows downloads are unsigned and the Mac download is unsigned/not notarized. This is disclosed on the website. Apple signing/notarization is a paid, later distribution step and is intentionally deferred; it is not a blocker for the current demo stage.
- The Windows and Cylinder update manifests now point to the official 0.3.27 GitHub release assets and published SHA-512 values. Verify an update from a previous install on each channel before treating this path as fully confirmed. These packages remain unsigned.
- Firebase now exposes `overheadTrialApi` and a no-Stripe `billingApi` compatibility endpoint in the separate `trial` codebase. These support trial and entitlement requests; checkout and paid cancellation return 503. The full Stripe-backed implementation in `functions/` is not deployed, so paid billing remains unavailable.
- The `trial` codebase also exposes `checkWorkspaceDuplicate` for Mac and website signup. It compares business names against existing profiles, returns only a possible-match boolean, and limits requests to 12 per IP per 15 minutes. Signup fails closed if the check is unavailable; a possible match requires explicit separate-workspace confirmation. This is a duplicate workspace/trial guard ahead of paid billing, not a charge or subscription action.
- The Stripe-backed `billingApi` source in `functions/index.js` binds `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`. The deployed `billingApi` currently belongs to the `trial` codebase; plan its replacement/codebase migration before deploying the Stripe implementation. Confirm both Secret Manager versions and test in Stripe test mode before enabling any paid server action. Never put secret values in source control or chat.

The bullets above are an observed status snapshot. Recheck cloud state and package links before each release.

## Stripe test-to-live gate

`overhead-office` must be on Firebase Blaze before this gate can begin. Blaze is required both for Cloud Functions (Cloud Build and Artifact Registry) and for Firebase Hosting to publish the Windows `.exe` installer used by the automatic update feed. Spark rejects executable uploads and cannot enable the required Functions APIs.

Before live payments, deploy the Firebase Functions in Stripe test mode and verify each outcome with Stripe test data:

1. Start the one-time 30-day Gold trial: confirm no customer, payment, or charge is created.
2. Confirm the Gold entitlement and licenses are active, then confirm a second trial is refused.
3. Complete one embedded paid checkout and verify the signed webhook activates the correct tier.
4. Double-click checkout and open a second app window: verify only one session can proceed.
5. Cancel during a paid period: verify access ends, the calculated unused amount is refunded once, and the billing activity record is present.
6. Send the listed Stripe webhook events again: verify event idempotency prevents duplicate entitlement changes or refunds.
7. Force trial expiry in a test workspace: verify `expireTrials` suspends access and licenses.

Do not switch to live Stripe keys or live Price IDs until every test passes.

## Future release signing

The current Windows packages are unsigned. Before a broader paid Windows distribution, use an organization-owned, trusted Authenticode certificate and verify the published package. Keep the certificate file and password outside the repository. Electron Builder reads standard certificate environment variables during packaging:

```powershell
$env:CSC_LINK = 'C:\secure\black-lion-code-signing.pfx'
$env:CSC_KEY_PASSWORD = 'replace-with-certificate-password'
cd C:\Users\solid\Documents\Codex\OverHead
npm run dist:win
Get-AuthenticodeSignature .\release\OverHead-Setup-<version>-win-x64.exe
```

For a signed release, verify that the signature status is `Valid` and identifies the expected publisher. A self-signed certificate is not commercially trusted and is not an acceptable substitute. Apple signing/notarization is a separate, paid later-stage decision and is not required for the current free-demo stage.

## Update publishing

The public standard desktop feed now advertises version 0.3.27 and links to the official GitHub release asset with its SHA-512 hash. Verify an update from a previously installed build. For future releases, publish matching metadata and installer assets, verify the asset URLs and update behavior, and state the package signing status accurately.

OverHead Cylinder uses a separate Windows Server/Windows IoT-only channel: publish its installer, blockmap, and matching `latest.yml` to `https://overhead-office.web.app/updates/cylinder`. Do not mix Cylinder and desktop artifacts; their app IDs, local data roots, and compatibility gates are intentionally separate.

## Cylinder commercial activation gate

The public Cylinder feed now advertises version 0.3.27 and links to the official GitHub release asset with its SHA-512 hash. Keep it isolated from the desktop feed and verify an update from a previously installed Cylinder build.

Cylinder has a separate one-time, 30-day, no-card evaluation per server workspace. It does not use the standard desktop checkout, does not create a payment, and does not renew automatically. Before enabling paid Cylinder access, verify all of the following:

1. The host is a supported Windows Server or Windows IoT edition.
2. The evaluation is within its 30-day window, or a paid Cylinder entitlement has been issued.
3. A deployment order or contract clearly states the $499 monthly or $4,990 annual price, billing interval, renewal, cancellation, refund, support, and entitlement terms.
4. Billing confirmation and the issued entitlement are recorded before the paid deployment is activated.
5. Qualified counsel has reviewed the final commercial terms for the applicable jurisdiction.

Do not represent Cylinder checkout or recurring billing as live until that separate activation path is implemented, tested, and approved.
