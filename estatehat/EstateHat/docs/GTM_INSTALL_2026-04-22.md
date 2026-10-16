# Google Tag Manager Install - 2026-04-22

## Summary

Installed Google Tag Manager container `GTM-TWW3MG8S` for EstateHat so AdRoll can be managed through GTM.

## Changed

- Added the AdRoll/GTM script snippet to Vite HTML entry points:
  - `index.html`
  - `start.html`
  - `signin.html`
  - `home.html`
- Added the AdRoll/GTM noscript iframe immediately after `<body>` in those Vite HTML entry points.
- Added the AdRoll/GTM script and noscript iframe to the Next.js root layout.
- Updated Firebase Hosting CSP to allow `www.googletagmanager.com` for script, connect, and frame sources.

## Verification

Build and deploy verification should confirm `GTM-TWW3MG8S` appears in the generated `dist` HTML files.
