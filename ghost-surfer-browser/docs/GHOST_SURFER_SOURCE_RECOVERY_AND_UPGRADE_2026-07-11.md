# Ghost Surfer Browser Source Recovery and Upgrade

Date: 2026-07-11

## Firebase Target

- Firebase project ID: `ghost-surfer-browser`
- Hosting site ID: `ghost-surfer-browser`
- Live URL: `https://ghost-surfer-browser.web.app`
- Local source folder: ``ghost-surfer-browser/``

## What Was Found

The deployed Firebase project existed, but no matching local source folder or `.firebaserc` was present in the expected Firebase Websites or GitHub workspace folders at the time of recovery. The live site was mirrored into a maintained local source folder so the deployed public surface is no longer orphaned.

The live channel showed a latest release time of `2026-07-11 09:47:47` for `https://ghost-surfer-browser.web.app`.

## Preserved Assets

- The Firebase-hosted `public/downloads/Ghost-Surfer-Browser-Windows.zip` release bundle (kept out of this GitHub source checkout because the repository does not store large Windows bundles).
- `public/downloads/SHA256SUMS.txt`
- `public/downloads/CHANGELOG.txt`
- `public/assets/ghost-surfer-icon.svg`
- Existing legal, compliance, support, security, and policy HTML pages

The Windows ZIP is approximately 184 MB and matches the published ZIP SHA-256 hash:

`9de59f30c6074dbd37ab17fa69530dc96b51d1c0ea486aef0b7ec1083f04e5c0`

The published EXE SHA-256 hash remains:

`fe6699dc1b58c5abba19816f8e570ca747fe342797555df07f2c7105e8954ced`

## Upgrades Added

- Added a maintained Firebase source scaffold with `.firebaserc`, `firebase.json`, and `package.json`.
- Added deploy headers for CSP, HSTS, clickjacking protection, MIME sniffing protection, referrer policy, and permissions policy.
- Added no-cache headers for downloadable release files.
- Expanded the homepage with:
  - Trust center section
  - Release intelligence/specs section
  - Source recovery note in the latest build band
  - More explicit install verification step
- Kept legal and trust links visible from the public homepage and legal hub.
- Added an automated smoke test script at `scripts/smoke-check.mjs`.

## Legal and Compliance Coverage

The public site includes policy coverage for:

- Privacy
- Terms
- License
- Cookies and local storage
- Refunds and downloads
- Security and privacy limits
- Accessibility
- Acceptable use
- Copyright and intellectual property
- Third-party notices
- Compliance overview
- Support

The compliance page states that the current site is informational and download-only. It also identifies triggers that require review before adding payments, support forms, analytics, email marketing, accounts, cloud sync, crash reporting, telemetry, mobile apps, paid licensing, enterprise deployment, or targeted advertising.

The compliance page now also separates domestic U.S. readiness from global user notice coverage. The domestic section calls out notice at collection, user choices, children's privacy, sensitive-information boundaries, support-email rights requests, anti-abuse language, download/refund posture, and accessibility/support routing. The global notice section calls out IP/network limits, no analytics or ad cookies on the static site, third-party component/service notices, and review triggers for data-collection or commercial expansion.

This documentation is operational coverage, not legal advice. Commercial launch or material data collection still needs qualified legal review.

## Verification Commands

Run local smoke checks:

```bash
npm run check
```

Run live smoke checks:

```bash
npm run check:live
```

Deploy:

```bash
npm run deploy
```

## Release Discipline

Before each future deployment:

1. Update the ZIP package only from the trusted build output.
2. Regenerate `public/downloads/SHA256SUMS.txt`.
3. Update visible hashes on `public/index.html`.
4. Update `public/downloads/CHANGELOG.txt`.
5. Run `npm run check`.
6. Deploy with an authorized Firebase account to the `ghost-surfer-browser` project.
7. Run `npm run check:live`.
