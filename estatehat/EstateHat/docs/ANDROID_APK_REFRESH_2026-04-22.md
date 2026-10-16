# EstateHat Android APK Refresh - 2026-04-22

## Summary

Refreshed the EstateHat Android debug APK after the Next.js foundation was added.

Output:

- `release/EstateHat-Android-Debug-1.0.0.apk`
- `android/app/build/outputs/apk/debug/app-debug.apk`

## Verified

- `npm run sync:android` passed.
- `JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64 ./gradlew --no-daemon assembleDebug -Djava.net.preferIPv4Stack=true` passed from `android/`.
- `file release/EstateHat-Android-Debug-1.0.0.apk` confirms an Android package with APK Signing Block.
- The APK contains `assets/public/home.html`.

## Notes

The Android wrapper still uses the retained Vite/Capacitor bundle path. The new Next.js foundation is for local web/runtime migration and does not change the native wrapper build path.
