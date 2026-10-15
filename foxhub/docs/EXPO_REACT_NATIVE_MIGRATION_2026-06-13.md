# Expo React Native Migration - 2026-06-13

FoxHub's active mobile target moved from Capacitor wrappers to an Expo/React Native app under `mobile/`.

## What changed

- Added `mobile/` as a standalone Expo project.
- Added a native FoxHub mobile shell in `mobile/App.js`.
- Added shared mobile auth/profile rules in `mobile/src/foxhubMobileCore.js`.
- Added `mobile/scripts/mobile-smoke.mjs`.
- Added `scripts/sync-mobile-content.mjs` to generate mobile content from `src/data.js` and mobile themes from `src/rules.js` plus `src/styles.css`.
- Removed active Capacitor dependencies from the root package.
- Removed the generated root `ios/`, `android/`, and `capacitor.config.json` artifacts.
- Replaced root mobile scripts with Expo commands:
  - `npm run mobile`
  - `npm run mobile:ios`
  - `npm run mobile:android`
  - `npm run mobile:web`
  - `npm run mobile:sync-content`
  - `npm run mobile:smoke`
  - `npm run mobile:ready:ios`

## Current mobile scope

The Expo mobile pass covers the mobile foundation:

- member sign-in
- member sign-up with 18+ gate
- management sign-in
- two-way member/management lane blocking with `Not Permitted.`
- profile display-name alignment
- website-derived mobile surfaces for Home, Social, Rapport, Communal, Services, Needs, Pay, Goodies, Tools, Organizer, and Ops
- generated website content for trusted people, circles, listings, local places, mini apps, wallet events, connector tools, organizer rooms, and management queues
- generated content module: `mobile/src/foxhubMobileContent.generated.js`
- generated app theme module: `mobile/src/foxhubMobileThemes.generated.js`
- signed-in mobile theme picker matching the website's Green Composite, Day, Night, Matrix, Forest, Ocean, Ember, Slate, Rose, High Contrast, Lavender, Cyberpunk, Mint, Midnight, Solar, Arctic, Grape, and premium theme labels
- Browser parity tab: native iOS/Android uses `react-native-webview` to load the real hosted FoxHub web app. Expo web preview shows an external-open fallback because the hosted site blocks iframe embedding with CSP `frame-ancestors 'none'`.

## Auto-population

Refresh mobile content from the website data with:

```bash
npm run mobile:sync-content
```

The root mobile commands run this automatically before Expo starts or before the mobile smoke export:

```bash
npm run mobile
npm run mobile:ios
npm run mobile:android
npm run mobile:web
npm run mobile:smoke
```

The full browser super-app surface has not been mechanically ported. DOM/CSS-heavy modules should be rebuilt as native screens in follow-up passes.

## Verification

Passed after migration:

```bash
npm test
npm run smoke:public
npm run mobile:smoke
npm run mobile:ready:ios
```

`npm run mobile:smoke` runs the mobile auth/profile contract checks and exports the Expo web bundle.

iOS build-readiness details live in `docs/IOS_EXPO_BUILD_READY_2026-06-13.md`.
