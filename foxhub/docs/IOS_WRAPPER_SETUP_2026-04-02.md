# FoxHub iOS Wrapper Setup

Last updated: 2026-04-02

This file records the FoxHub iOS app wrapper that was created inside this repo so the setup can be recovered later without rebuilding context from scratch.

## What was created

FoxHub started as a plain Vite web app. An iOS wrapper was added using Capacitor.

Created or updated files:

- `package.json`
- `capacitor.config.json`
- `README.md`
- `index.html`
- `src/styles.css`
- `ios/App/...`

## iOS wrapper structure

The generated iOS wrapper lives in:

- `ios/App`

Important generated files:

- `ios/App/App.xcodeproj/project.pbxproj`
- `ios/App/App/AppDelegate.swift`
- `ios/App/App/Info.plist`
- `ios/App/App/Base.lproj/Main.storyboard`
- `ios/App/App/Base.lproj/LaunchScreen.storyboard`
- `ios/App/App/capacitor.config.json`
- `ios/App/App/public/index.html`

## Scripts added

These scripts now exist in `package.json`:

- `build:ios`
- `sync:ios`
- `open:ios`

Current command meanings:

- `npm run build:ios`
  - builds the FoxHub web app into `dist`
- `npm run sync:ios`
  - builds the web app and syncs it into the Capacitor iOS wrapper
- `npm run open:ios`
  - opens the iOS project in Xcode on a Mac

## Capacitor config

Root config file:

- `capacitor.config.json`

Current values:

- app id: `com.foxhub.app`
- app name: `FoxHub`
- web dir: `dist`

## iOS-specific web polish added

The following iOS-facing adjustments were added:

- `index.html`
  - `viewport-fit=cover`
  - Apple mobile web app meta tags
  - theme color
- `src/styles.css`
  - safe-area-aware padding using `env(safe-area-inset-*)`
  - reduced overscroll weirdness
  - cleaner touch/tap behavior
  - smoother font rendering

## Verification completed

The following commands were run successfully:

- `npm install`
- `npx cap add ios`
- `npm run sync:ios`

Result:

- the iOS wrapper was generated successfully
- the FoxHub web bundle was copied into `ios/App/App/public`

## Known current limitation

FoxHub still has a large JS bundle during production build.

Current warning:

- Vite warns that a chunk is larger than 500 kB after minification

This does not block the iOS wrapper, but it is the next obvious performance cleanup target if startup or update size becomes a problem.

## What was not done here

- Xcode was not launched from this environment
- no signed iOS archive or IPA was created
- no App Store packaging or Apple signing work was completed

## Next steps on a Mac

1. run `npm run open:ios`
2. open the generated Xcode project
3. set Apple signing/team
4. run on simulator or device
5. archive when ready

## If this breaks later

Check these first:

1. `capacitor.config.json` still points to `dist`
2. `npm run build:ios` still succeeds
3. `npm run sync:ios` still copies assets into `ios/App/App/public`
4. the root `index.html` and `src/styles.css` still contain the iOS-safe meta and safe-area changes


## Native hardening added

A later security pass tightened the iOS wrapper so the mobile app is more tamper resistant:

- native builds now fall into a `locked` backend mode when Firebase is not configured
- writable local repository mode is no longer available inside the iOS shell
- `Info.plist` now explicitly disables arbitrary loads through App Transport Security
- `Info.plist` now disables iTunes file sharing and opening documents in place

This does not make the app tamper-proof. It removes the easiest local-state abuse path and tightens the native transport and file-exposure defaults.


See also:

- `docs/MOBILE_TAMPER_RESISTANCE_2026-04-02.md`
