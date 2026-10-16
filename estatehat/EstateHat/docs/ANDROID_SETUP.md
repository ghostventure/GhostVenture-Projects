# EstateHat Android Setup

The Android app is scaffolded with Capacitor and lives in `android/`.

## Local workflow

Build and sync the web app into the native Android project:

```bash
npm run sync:android
```

Open Android Studio from the project root and load:

```bash
android/
```

## Current app identifiers

- App name: `EstateHat`
- Capacitor package id: `com.estatehat.app`

## What is already done

- Capacitor Android project is generated.
- Web assets are copied from `dist/` into `android/app/src/main/assets/public` during sync.
- Android shell mirrors current web app behavior by loading synced build output.

## Android release-side tasks

- Configure signing key and release keystore.
- Configure Play Store listing assets and metadata.
- Run final QA on target Android versions/devices.
- Build release artifact from Android Studio / Gradle.

## Important paths

- Capacitor config: `capacitor.config.json`
- Native Android project: `android/`
- Synced web assets: `android/app/src/main/assets/public`
