# FoxHub Mobile Tamper Resistance

Last updated: 2026-04-02

This file records the native hardening pass applied to the FoxHub iOS and Android wrappers. The goal was not to claim the apps are impossible to reverse engineer. The goal was to remove the easiest client-side abuse path and tighten the native defaults.

## What changed

### Locked backend mode for native builds

FoxHub now has a third backend mode in `src/repository.js`:

- `local`
- `firebase`
- `locked`

When FoxHub is running inside a Capacitor native shell and Firebase env vars are missing, the app now loads `src/repository-locked.js` instead of `src/repository-local.js`.

That means:

- iOS and Android builds no longer permit the writable local repository fallback
- all mutating data operations throw a clear security error
- the app stays in a non-authenticated secure-mobile state until Firebase-backed mode is configured

### iOS hardening

The iOS wrapper now explicitly tightens:

- App Transport Security with `NSAllowsArbitraryLoads = false`
- file exposure through `UIFileSharingEnabled = false`
- document opening in place through `LSSupportsOpeningDocumentsInPlace = false`

### Android hardening

The Android wrapper now explicitly tightens:

- `android:allowBackup = false`
- `android:fullBackupContent = false`
- `android:usesCleartextTraffic = false`

### Capacitor config

`capacitor.config.json` now explicitly keeps secure transport defaults:

- `iosScheme = https`
- `cleartext = false`

## What this does not do

This does not make FoxHub literally tamper-proof. A determined attacker with full device control can still inspect a client app. The goal here is practical resistance:

- remove the writable local mobile backend
- reduce transport downgrade risk
- reduce backup and file-exposure risk
- make native builds depend on the secure backend path

## Operational rule

For native releases, treat Firebase-backed mode as required. If a mobile build opens in `locked` mode, that is a configuration problem, not a feature.

## Recovery checklist

1. confirm `src/repository.js` still routes native non-Firebase builds to `src/repository-locked.js`
2. confirm `src/App.jsx` still shows the secure-mobile lock message instead of offering local sign-in on native
3. confirm `ios/App/App/Info.plist` still contains the ATS and file-sharing restrictions
4. confirm `android/app/src/main/AndroidManifest.xml` still disables backup and cleartext traffic
5. confirm `capacitor.config.json` still keeps secure transport defaults
