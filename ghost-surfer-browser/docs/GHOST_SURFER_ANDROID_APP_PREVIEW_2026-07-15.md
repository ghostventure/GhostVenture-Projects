# Ghost Surfer Android App Preview - 2026-07-15

## Summary

- Added `public/android-app.html` as an Android-style Ghost Surfer companion preview.
- Kept the existing Ghost Surfer dark blue privacy-console color scheme.
- Reworked the preview to look like Ghost Surfer itself rather than a site page: browser top chrome, signal address bar, Guard/Speed/Grid/Clean controls, Startpage search card, Ghost Guard console, cookie clearance sheet, tracker alert rows, control drawer, and browser-style bottom toolbar.
- Linked the Android preview from the homepage navigation and hero actions.

## Product Boundary

- Ghost Surfer currently remains a static, download-only site for the Windows ZIP package.
- There is no Firebase Auth account system, user database, analytics, cloud sync, telemetry, or Android APK in this source folder today.
- The Android preview states that clearly instead of implying a shared account database exists.
- A future Android release should trigger the compliance review already listed in the Ghost Surfer compliance documentation.

## Verification

- `npm run check`
- `npm run deploy`
- `npm run check:live`
