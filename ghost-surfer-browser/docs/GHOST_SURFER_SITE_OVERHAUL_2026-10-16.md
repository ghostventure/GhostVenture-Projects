# Ghost Surfer Site Overhaul

Date: 2026-10-16

## Changes

- Added a keyboard skip link to every public HTML page, visible focus indicators, and reduced-motion handling.
- Made the main navigation horizontally scrollable on smaller screens so links remain reachable without squeezing the header.
- Reworked the Android page into an interactive website companion preview. Address/search launches HTTP(S) destinations or Startpage searches in a new tab; appearance presets and sample cookie choices persist in page-scoped local storage; reset clears only those preview settings. Back navigation, grid/compact appearance, and settings/help controls now work.
- Labeled the preview's counters and cookie choices as sample data, and stated that the site does not provide an Android app/APK or intercept traffic, manage website cookies, or block trackers. Disabled the nonfunctional Launch, Speed, and Grid controls in the homepage browser illustration.
- Tightened the Firebase Content Security Policy with explicit same-origin connection/font rules and disabled embedded frames. Kept the policy compatible with the current static site, which loads its assets from the same origin; the Android preview uses same-origin JavaScript.
- Removed the HSTS `preload` directive, which should only be used as an intentional domain-wide preload commitment. Kept a one-year HSTS policy with subdomains.
- Changed the existing smoke checker to hash the large Windows ZIP as a stream instead of loading the entire 184 MB file into memory. It now also checks local relative file links and HTML fragments during local checks.
- Preserved the Windows ZIP, published SHA-256 values, changelog, project target, and existing download URLs.

## Static Inspection

- `npm run check` passed for this source on 2026-10-16.
- The Windows ZIP's current SHA-256 was independently read as `9de59f30c6074dbd37ab17fa69530dc96b51d1c0ea486aef0b7ec1083f04e5c0`, matching the existing published ZIP checksum. The ZIP and EXE were not rebuilt or modified.
- The Firebase Hosting site returned HTTP 200 to a HEAD request on 2026-10-16. This confirms reachability only; it does not verify the October source changes.
- No deployment was attempted. The live site has not been updated with this October source.

## Deployment Handoff

Before deploying, stage the verified Windows ZIP in `public/downloads/` (it is intentionally excluded from this GitHub repository), run the documented checks, and deploy only to the `ghost-surfer-browser` project. After deployment, verify the live page headers, keyboard navigation, mobile layout, download response, and published checksum. No deploy was made as part of this source publication.
