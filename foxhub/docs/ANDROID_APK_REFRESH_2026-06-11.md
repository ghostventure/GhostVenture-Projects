# Android APK Refresh - 2026-06-11

## Summary

Refreshed the FoxHub Android debug APK after the latest staff controls, photo upload optimization, performance pass, and captcha robot guard.

## Outputs

- Android debug APK: `release/FoxHub-Android-Debug-0.1.0.apk`
- Android Gradle output: `android/app/build/outputs/apk/debug/app-debug.apk`
- Size: `6,347,588` bytes, about 6.1 MB
- Build timestamp: `2026-06-11 14:06:19 -0400`

## Commands

```bash
npm run package:android:debug
file release/FoxHub-Android-Debug-0.1.0.apk
unzip -l release/FoxHub-Android-Debug-0.1.0.apk
```

## Verification

- `npm run package:android:debug` passed.
- Capacitor copied the Vite bundle from `dist` to `android/app/src/main/assets/public`.
- Android Gradle `assembleDebug` passed with Java 21.
- `file release/FoxHub-Android-Debug-0.1.0.apk` confirms an Android package with APK Signing Block.
- `release/FoxHub-Android-Debug-0.1.0.apk` and `android/app/build/outputs/apk/debug/app-debug.apk` have matching size: `6,347,588` bytes.
- Android wrapper security flags remain set:
  - `android:allowBackup="false"`
  - `android:usesCleartextTraffic="false"`

## Bundled web assets

The refreshed APK contains the current web bundle:

- `assets/public/index.html`
- `assets/public/assets/index-DKpyfyTK.js`
- `assets/public/assets/index-CFbtPTaO.css`
- `assets/public/assets/FoxHubShell-CibUg65P.js`
- `assets/public/assets/mediaUploads-CJMXZ47N.js`
- `assets/public/assets/repository-local-BPuhNiuR.js`
- `assets/public/assets/repository-firebase-CiF86nps.js`
- `assets/public/assets/browser-image-compression-CBVwGt6Q.js`

## Notes

- This is a debug APK for direct testing, not a signed Play Store release.
- Firebase Hosting still cannot host APK files on the current Spark plan. Keep using the local `release/` output until another permitted download surface is chosen.
- iOS was intentionally not refreshed in this pass.

