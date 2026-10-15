# FoxHub Android Wrapper Setup

Last updated: 2026-04-02

This file records the FoxHub Android app wrapper work that was created inside this repo so the setup can be recovered later without rebuilding context from scratch.

## What was created

FoxHub started as a plain Vite web app. An Android wrapper was added using Capacitor.

Created or updated files:

- `package.json`
- `README.md`
- `android/...`

## Android wrapper structure

The generated Android wrapper lives in:

- `android`

Important generated files:

- `android/app/build.gradle`
- `android/app/src/main/AndroidManifest.xml`
- `android/build.gradle`
- `android/settings.gradle`
- `android/gradle.properties`
- `android/gradlew`
- `android/gradlew.bat`
- `android/capacitor.settings.gradle`

## Scripts added

These scripts now exist in `package.json`:

- `build:android`
- `sync:android`
- `open:android`

Current command meanings:

- `npm run build:android`
  - builds the FoxHub web app into `dist`
- `npm run sync:android`
  - builds the web app and syncs it into the Capacitor Android wrapper
- `npm run open:android`
  - opens the Android project in Android Studio

## Dependencies added

Android Capacitor dependency added to `package.json`:

- `@capacitor/android`

## Verification completed

The following commands were run successfully:

- `npm install`
- `npx cap add android`

Result:

- the Android wrapper was generated successfully
- Capacitor created the native Android project under `android/`

## Sync status

The full `npm run sync:android` command now completes successfully in this environment.

Verified on 2026-04-02:

- `npm run sync:android`

Result:

- the FoxHub web bundle copies into `android/app/src/main/assets/public`
- the Android wrapper is now in sync with the current web app

Historical note:

- an earlier run hit a temporary `EROFS` write failure during the Vite build step
- that blocker is no longer the current state of this repo

## What was not done here

- Android Studio was not opened from this environment
- no emulator run was performed
- no signed APK or AAB was created

## Next steps

1. run `npm run build:android`
2. run `npm run sync:android`
3. run `npm run open:android`
4. open the Android project in Android Studio
5. run on emulator or device

## If this breaks later

Check these first:

1. `package.json` still includes Android Capacitor scripts
2. `@capacitor/android` is still installed
3. the `android/` folder still exists
4. `npm run build:android` succeeds in a writable environment
5. `npm run sync:android` can copy the web bundle after the build step succeeds


## Native hardening added

A later security pass tightened the Android wrapper so the mobile app is more tamper resistant:

- native builds now fall into a `locked` backend mode when Firebase is not configured
- writable local repository mode is no longer available inside the Android shell
- `AndroidManifest.xml` now disables backup extraction
- `AndroidManifest.xml` now disables cleartext traffic for the app

This does not make the app tamper-proof. It removes the easiest local-state abuse path and tightens the native defaults around app data and transport.


See also:

- `docs/MOBILE_TAMPER_RESISTANCE_2026-04-02.md`
