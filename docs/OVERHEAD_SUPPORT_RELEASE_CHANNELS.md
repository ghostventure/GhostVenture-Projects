# OverHead support release channel map

Internal support reference. The product website uses customer-facing names such as **OverHead Suite** and **Install Manager**. Do not add a visible “Production” label to customer pages; use the channel classification here for support triage.

| Internal channel | Customer-facing name | Current release | Supported package/source | Support note |
| --- | --- | --- | --- | --- |
| Production | OverHead Suite for Windows | 0.3.27 | GitHub release `overhead-v0.3.27`; `OverHead-Setup-0.3.27-win-x64.exe` | Windows 10/11 desktop app. Unsigned; publisher identity is not verified. |
| Production | OverHead Suite for Mac | 0.1.4 | Firebase Hosting `/downloads/mac/OverHead-Mac-0.1.4.zip` | Intel (x86_64), macOS 14+. Unsigned and not notarized; notarization deferred to paid distribution stage. |
| Production | OverHead Install Manager | 2026-11-01 | GitHub release `overhead-install-manager-2026-11-01`; `OverHead-Install-Manager.exe` | Separate Windows executable. Unsigned; publisher identity is not verified. |
| Production | OverHead Cylinder | 0.3.27 | GitHub release `overhead-cylinder-v0.3.27`; `OverHead-Cylinder-Setup-0.3.27-win-x64.exe` | Separate supported Windows Server / Windows IoT deployment. Do not recommend for standard Windows 10/11. |
| Demo | OverHead browser demo | Current website build | `/demo/` | Fictional sample records; client-side temporary actions; no account or production connections. Never treat demo records as a customer workspace. |

Mac 0.1.4 package SHA-256: `31d0b807a4f424d0e30c69e7892540531e8f31cf4c0a413c5eef9f60d4a5aa3a`.

For a download issue, capture the customer-facing product name, release/version, OS version, exact warning/error, and checksum result. A matching SHA-256 checksum establishes file integrity only; it does not establish publisher identity.

## Current operational notes — 2026-11-22

- The website download page points to the current packages listed above. Windows packages are unsigned. Mac 0.1.4 is unsigned and not notarized; notarization is intentionally deferred until the paid distribution stage.
- The desktop and Cylinder updater manifests now target the official 0.3.27 GitHub release assets using their published SHA-512 values. Update from a prior installed build still needs an end-to-end check.
- The Mac update feed points to the 0.1.4 ZIP; users download and install it manually.
- `overheadTrialApi` and the no-Stripe `billingApi` compatibility endpoint handle no-card trial and entitlement actions. Paid checkout/cancellation return unavailable and do not change billing. The Stripe-backed service still needs its secrets and a planned codebase migration. See `current-handoff-2026-11-22.md`.
- `checkWorkspaceDuplicate` checks signup business names against shared profiles and returns only a possible-match flag. It is limited to 12 checks per IP per 15 minutes. A match warns of possible separate subscriptions and requires explicit confirmation to proceed; an unavailable check blocks account creation. Paid billing is still disabled.
