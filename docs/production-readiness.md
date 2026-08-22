# Production readiness

For the current deployed release, shared-licensing model, and Firebase handoff status, start with `docs/current-handoff-2026-08-21.md`.

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

## Release signing

Use an organization-owned Windows code-signing certificate. Keep the certificate file and password outside the repository. Electron Builder reads standard certificate environment variables during packaging:

```powershell
$env:CSC_LINK = 'C:\secure\black-lion-code-signing.pfx'
$env:CSC_KEY_PASSWORD = 'replace-with-certificate-password'
cd C:\Users\solid\Documents\Codex\OverHead
npm run dist:win
Get-AuthenticodeSignature .\release\OverHead-Setup-<version>-win-x64.exe
```

The final verification must report `Valid` and identify the organization certificate. Do not publish a release that reports `NotSigned`.

## Update publishing

Publish the standard desktop installer, blockmap, and matching `latest.yml` together to `https://overhead-office.web.app/updates`. Confirm the public `latest.yml` version matches the installer version and that a prior packaged build detects and downloads the update. Never point the app at a feed containing unsigned artifacts.

OverHead Cylinder uses a separate Windows Server/Windows IoT-only channel: publish its installer, blockmap, and matching `latest.yml` to `https://overhead-office.web.app/updates/cylinder`. Do not mix Cylinder and desktop artifacts; their app IDs, local data roots, and compatibility gates are intentionally separate.

## Cylinder commercial activation gate

Cylinder has a separate one-time, 30-day, no-card evaluation per server workspace. It does not use the standard desktop checkout, does not create a payment, and does not renew automatically. Before enabling paid Cylinder access, verify all of the following:

1. The host is a supported Windows Server or Windows IoT edition.
2. The evaluation is within its 30-day window, or a paid Cylinder entitlement has been issued.
3. A deployment order or contract clearly states the $499 monthly or $4,990 annual price, billing interval, renewal, cancellation, refund, support, and entitlement terms.
4. Billing confirmation and the issued entitlement are recorded before the paid deployment is activated.
5. Qualified counsel has reviewed the final commercial terms for the applicable jurisdiction.

Do not represent Cylinder checkout or recurring billing as live until that separate activation path is implemented, tested, and approved.
