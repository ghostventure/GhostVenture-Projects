# Ghost Surfer Browser Site

Firebase Hosting source for the Ghost Surfer Browser public website. The Windows release bundle remains hosted by Firebase and is not duplicated in this source repository.

## Live Site

- URL: `https://ghost-surfer-browser.web.app`
- Firebase project: `ghost-surfer-browser`
- Hosting site: `ghost-surfer-browser`

## Local Structure

- `public/` - deployed static website, legal pages, styles, icon, download files, checksums, changelog
- `public/downloads/Ghost-Surfer-Browser-Windows.zip` - Firebase-hosted Windows ZIP package; the 184 MB release bundle is excluded from GitHub source.
- `public/downloads/SHA256SUMS.txt` - published release hashes
- `scripts/smoke-check.mjs` - local and live smoke checks
- `docs/GHOST_SURFER_SOURCE_RECOVERY_AND_UPGRADE_2026-07-11.md` - recovery, upgrade, compliance, and release notes
- `docs/GHOST_SURFER_SITE_OVERHAUL_2026-10-16.md` - current source maintenance notes and verification limits
- `firebase.json` - Firebase Hosting config and security/cache headers
- `.firebaserc` - Firebase project and hosting target

## Commands

```bash
npm run check
npm run check:live
npm run deploy
```

## Release Rules

Before deploying a new Ghost Surfer package:

1. Replace the ZIP in `public/downloads/`.
2. Regenerate `public/downloads/SHA256SUMS.txt`.
3. Update the visible hashes in `public/index.html`.
4. Update `public/downloads/CHANGELOG.txt`.
5. Run `npm run check`.
6. Deploy with `npm run deploy`.
7. Run `npm run check:live`.

## Current Verification

The current ZIP hash is:

`9de59f30c6074dbd37ab17fa69530dc96b51d1c0ea486aef0b7ec1083f04e5c0`

The current EXE hash published in `SHA256SUMS.txt` is:

`fe6699dc1b58c5abba19816f8e570ca747fe342797555df07f2c7105e8954ced`

The October 2026 source passes `npm run check`. The Firebase project and live site exist; a live HTTP HEAD request returned 200 on 2026-10-16. No deployment of the October source changes has occurred. The repository checkout omits the release ZIP, so the local smoke check validates its published checksum manifest but cannot hash that external bundle. Stage the verified release ZIP in `public/downloads/` before deploying from this checkout.

## GitHub Source Checkout

This project lives only in `ghost-surfer-browser/` in the GhostVenture-Projects repository. It is not copied into another project directory. Firebase project settings in `.firebaserc` and `firebase.json` are retained. The Windows ZIP is excluded because this repository does not store large Windows release bundles; its deployed copy and checksum remain on Firebase Hosting.
