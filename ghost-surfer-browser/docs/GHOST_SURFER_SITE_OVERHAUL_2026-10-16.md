# Ghost Surfer Site Overhaul

Date: 2026-10-16

## Changes

- Added a keyboard skip link to every public HTML page, visible focus indicators, and reduced-motion handling.
- Made the main navigation horizontally scrollable on smaller screens so links remain reachable without squeezing the header.
- Reworked the Android page into an interactive website companion preview. Address/search launches HTTP(S) destinations or Startpage searches in a new tab; appearance presets and sample cookie choices persist in page-scoped local storage; reset clears only those preview settings. Back navigation, grid/compact appearance, and settings/help controls now work.
- Labeled the preview's counters and cookie choices as sample data, and stated that the site does not provide an Android app/APK or intercept traffic, manage website cookies, or block trackers. Disabled the nonfunctional Launch, Speed, and Grid controls in the homepage browser illustration.
- Tightened the Firebase Content Security Policy with explicit same-origin connection/font rules and disabled embedded frames. Kept the policy compatible with the current static site, which loads its assets from the same origin and does not use JavaScript.
- Removed the HSTS `preload` directive, which should only be used as an intentional domain-wide preload commitment. Kept a one-year HSTS policy with subdomains.
- Changed the existing smoke checker to hash the large Windows ZIP as a stream instead of loading the entire 184 MB file into memory. It now also checks local relative file links and HTML fragments during local checks.
- Preserved the Windows ZIP, published SHA-256 values, changelog, project target, and existing download URLs.

## Static Inspection

- Local validation passed with `npm run check` before deployment.
- The source and documentation are published in `ghostventure/GhostVenture-Projects`, under `ghost-surfer-browser/`, branch `codex/ghost-surfer-source-sync-2026-10-16`. The large Windows ZIP is intentionally excluded from GitHub; its local SHA-256 is `9de59f30c6074dbd37ab17fa69530dc96b51d1c0ea486aef0b7ec1083f04e5c0`, matching the published checksum. The ZIP and EXE were not rebuilt or modified.

## Deployment and Live Verification

- Local validation passed with `npm run check` before deployment.
- Deployed the complete configured `public/` directory to Firebase Hosting site `ghost-surfer-browser` in project `ghost-surfer-browser` under `solidartentertainment@gmail.com` on 2026-10-16. Firebase finalized Hosting version `3ceb2ea65c9323bc` and released it to the live channel as release `1792173901026000` at `2026-10-16T18:05:01.026Z`.
- The live homepage returned HTTP 200. All 15 required public HTML pages returned HTTP 200 and contained an HTML doctype when checked with `curl`.
- The homepage response includes the configured CSP, frame, referrer, permissions, and content-type security headers. Its HSTS response includes `preload`, although the deployed Hosting config explicitly sets `max-age=31536000; includeSubDomains` without `preload`.
- The Windows ZIP download returned HTTP 200 as `application/zip`; its streamed SHA-256 `9de59f30c6074dbd37ab17fa69530dc96b51d1c0ea486aef0b7ec1083f04e5c0` matches the published checksum.
- The built-in `npm run check:live` could not complete because Node's `fetch` timed out connecting to Firebase in this environment. `curl` could reach the site and was used for all live page and download checks.
