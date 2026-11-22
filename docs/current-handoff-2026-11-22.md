# OverHead current handoff — 2026-11-22

This document supersedes `current-handoff-2026-08-21.md`. It records the observed website, release, updater, and backend state on 2026-11-22. Recheck remote state before another release.

## Public website and downloads

- Website: <https://overhead-office.web.app>
- Free interactive demo: <https://overhead-office.web.app/demo/>
- Download catalog: <https://overhead-office.web.app/download/>
- FAQ and support: `/faq/` and `/support/`
- Mac Suite 0.1.4: `/downloads/mac/OverHead-Mac-0.1.4.zip` (Intel x86_64, macOS 14+, unsigned and not notarized)
- Windows Suite 0.3.27, Install Manager dated 2026-11-01, and Cylinder 0.3.27 are linked from their official GitHub release pages via the Download page.

The site was statically built and deployed to Firebase Hosting on 2026-11-22. Homepage, demo, download, FAQ, support, updater feeds, and the Mac ZIP returned HTTP 200 after deployment. Windows and Cylinder installer/checksum links on the Download page target GitHub release assets; they are not hosted in `website-deploy`.

Customer-facing pages call the installed Windows and Mac products **OverHead Suite**. The internal support classification is in `OVERHEAD_SUPPORT_RELEASE_CHANNELS.md`; do not add a visible Production badge to customer pages. The browser demo uses fictional sample records and is not connected to business workspaces.

## Release and updater state

The internal support catalog currently identifies Windows Suite 0.3.27, Mac Suite 0.1.4, Install Manager 2026-11-01, and Cylinder 0.3.27. The website Download page links to these packages and discloses that the Windows packages are unsigned and the Mac package is unsigned/not notarized. Notarization is a later paid release step and is intentionally deferred at this stage.

The Windows updater feeds now point to the official 0.3.27 GitHub release assets. The manifests use their published SHA-512 values and absolute asset URLs; installer and blockmap URLs returned HTTP 200 after following GitHub redirects. An actual update from an older install still needs Windows verification. These Windows packages remain unsigned.

- `/updates/latest.yml` advertises Windows Suite 0.3.27 and references the official GitHub installer asset.
- `/updates/cylinder/latest.yml` advertises Cylinder 0.3.27 and references the official GitHub installer asset.
- `/updates/mac/latest.json` advertises Mac 0.1.4 and points to the live ZIP. The Mac app checks this feed and the user installs updates manually.
- Mac 0.1.4 package SHA-256: `31d0b807a4f424d0e30c69e7892540531e8f31cf4c0a413c5eef9f60d4a5aa3a` (`OverHead-Mac-0.1.4.zip`).

Keep Cylinder isolated from the standard desktop channel. For future releases, update each manifest with the exact release asset URL, SHA-512, and version. Verify a real update from an already installed build.

## Billing, trials, and backend

The account page is read-only for subscription requests; paid checkout, cancellation, and refunds are not enabled publicly. The `trial` codebase now serves both `overheadTrialApi` and a no-Stripe `billingApi` compatibility endpoint. It supports verified administrator trial, entitlement, activity, and free-trial-cancellation actions; checkout and paid cancellation return 503 without changing billing. The full Stripe implementation in `functions/index.js` is not deployed because its secrets are not configured. Unauthenticated activation requests to both endpoints return HTTP 401.

Mac Suite 0.1.4 uses `overheadTrialApi`; Windows Suite 0.3.27 uses the compatibility `billingApi` for its trial actions. Do not treat a local plan label or the UI as entitlement evidence. Verify authorized trial creation, entitlement/license issuance, one-trial enforcement, and expiry with an approved workspace. Paid billing remains disabled until Stripe secrets are configured in Firebase Secret Manager and the full Stripe-backed implementation is migrated and deployed. Never place secret values in source control or chat. Use Stripe test mode before any live payments.

The `trial` codebase also serves `checkWorkspaceDuplicate`, used before website and Mac workspace signup. It compares entered business information with existing top-level profiles and returns only a possible-match boolean; it does not disclose a matched workspace’s identity or contact information. Requests are limited to 12 per IP per 15-minute window. A possible match prompts the user to reuse/sign in to the existing workspace or confirm a separate one. Signup fails closed if the check is unavailable. Exact email reuse is rejected by Firebase Authentication and routed back to sign-in. This is a pre-signup duplicate warning for workspace/trial hygiene ahead of future paid billing; it does not change existing billing. Paid billing remains disabled.

The website FAQ and account page correctly state that public checkout is unavailable. Browser and desktop records do not automatically merge; desktop operational records remain local unless a feature explicitly synchronizes them.

## Release readiness and support

- Windows releases currently published from GitHub are unsigned; publisher identity is not verified.
- The Mac 0.1.4 package is unsigned and not notarized. macOS may require manual approval in Privacy & Security. Signing/notarization is deferred until the paid distribution stage; it is not a current work blocker.
- Keep package/version/checksum details in `OVERHEAD_SUPPORT_RELEASE_CHANNELS.md` and the Download page in sync.
- The older August handoff is retained as historical documentation only.
- For current readiness gates, see `production-readiness.md`.

## Source and workspace state

The website build succeeded before the 2026-11-22 Hosting deployment. The shared repository was on branch `codex/ghost-surfer-ios` with substantial uncommitted OverHead website and Mac source changes and separate staged/unstaged Ghost Surfer changes. Preserve those changes; do not assume the deployed website is represented by a commit or clean branch. Check `git status` before editing, staging, or packaging.

Hosting deployment command from repository root:

```sh
rsync -a website-next/out/ website-deploy/
firebase deploy --config firebase.overhead.json --only hosting --project overhead-office --non-interactive
```

The no-card trial endpoint is isolated from Stripe secrets and can be deployed independently:

```sh
firebase deploy --config firebase.overhead.json --only functions:trial:overheadTrialApi --project overhead-office --non-interactive
```

The Windows and Cylinder manifests now live in `website-next/public/updates/` and are copied with the site. Preserve their release asset URLs and SHA-512 values when rebuilding the site.
