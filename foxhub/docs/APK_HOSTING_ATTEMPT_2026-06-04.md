# APK Hosting Attempt - 2026-06-04

## Summary

A fresh FoxHub Android debug APK was built successfully, but Firebase Hosting rejected deploying it on the current Spark billing plan.

## Built Output

- Android debug APK: `release/FoxHub-Android-Debug-0.1.0.apk`
- Android Gradle output: `android/app/build/outputs/apk/debug/app-debug.apk`
- Size: about 6.0 MB
- File check: Android package with APK Signing Block

## Commands

```bash
npm run package:android:debug
file release/FoxHub-Android-Debug-0.1.0.apk android/app/build/outputs/apk/debug/app-debug.apk
```

## Hosting Attempt

The APK was temporarily copied to:

- `public/downloads/FoxHub-Android-Debug-0.1.0.apk`
- `dist/downloads/FoxHub-Android-Debug-0.1.0.apk`

The public splash page was temporarily wired with an Android APK download link and `npm run smoke:public` passed locally.

Firebase Hosting deploy then failed with:

```text
Error: Task index 0 failed: retries exhausted after 4 attempts, with error: Request to https://firebasehosting.googleapis.com/v1beta1/projects/255058898647/sites/foxhub-superapp/versions/1c6976e78d7609f8:populateFiles had HTTP Error: 400, Executable files are forbidden on the Spark billing plan. For more details, see https://firebase.google.com/support/faq#hosting-exe-restrictions
```

## Result

- The APK build is valid locally.
- The APK was removed from `public/downloads` and `dist/downloads` so Firebase Hosting can deploy cleanly.
- The direct APK download button was removed from the public site to avoid publishing a broken link.

## Practical Next Options

- Upgrade the Firebase project billing plan if direct executable hosting on Firebase Hosting is required.
- Host the APK through another release/download surface that permits APK files.
- Keep distributing the local file from `release/FoxHub-Android-Debug-0.1.0.apk` until a permitted public download host is chosen.
