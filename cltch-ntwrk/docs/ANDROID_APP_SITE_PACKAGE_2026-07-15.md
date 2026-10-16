# Android App Site Package - 2026-07-15

## Summary

- Added a hosted Android app surface at `android-app.html`.
- Reworked the surface after Android UI research so it behaves less like the website and more like an Android app shell: sticky top app bar, bottom navigation, FAB, compact cards, segmented auth controls, and separate Today, Work, Sync, and Install screens.
- The page uses the same Firebase project as the main CLTCH site: `cltch-ntwrk-social`.
- Android sign-in/sign-up uses the same Firebase Auth user database.
- Account summaries write through `app/user-db.js` to the same `users/{uid}` documents as the web app.
- Role records write to the same `userRoles/{uid}` documents used by the web app for host/performer routing.
- Added a zipped Android package path at `downloads/CLTCH-NTWRK-Android-Debug-1.0.0.apk.zip`.

## Security And Function Parity

- Strong-password checks match the website auth flow: at least 8 characters with uppercase, lowercase, and a number.
- Role values are normalized through the shared `normalizeRole` helper.
- Sign-in events use the shared `recordAuthEvent` helper.
- New accounts use `ensureRoleRecord` and `writeUserSummary` so Android and web share the same operational account records.

## Android UI Research Notes

- Material guidance favors app scaffolds with top app bars, bottom navigation for handheld destinations, FABs for primary actions, compact cards/chips, and adaptive layouts.
- The CLTCH implementation keeps the brand palette but now prioritizes Android-style task flow over a website landing page: Today queue, Work lanes, Sync/security, and Install.

## Hosting Notes

- `firebase.json` intentionally ignores the native `android/**` Capacitor folder, so the public Android GUI is hosted as `android-app.html`.
- The raw APK remains in `release/`, which is ignored for Hosting. The downloadable package is zipped under `downloads/`.
