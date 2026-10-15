# Android APK Refresh - 2026-04-22

## Summary

Refreshed the FoxHub Android debug APK after the latest social landing, OneID, Next foundation, Firebase Functions adapter, and UI wrapping updates.

Output:

- `release/FoxHub-Android-Debug-0.1.0.apk`
- `android/app/build/outputs/apk/debug/app-debug.apk`

## Verified

- `npm run sync:android` passed.
- `JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64 ./gradlew --no-daemon assembleDebug -Djava.net.preferIPv4Stack=true` passed from `android/`.
- `file release/FoxHub-Android-Debug-0.1.0.apk` confirms an Android package with APK Signing Block.
- Synced Android wrapper and `dist` both reference `assets/index-D4eakTuU.js`.
- The APK contains `assets/public/assets/index-D4eakTuU.js`.

## Notes

The APK uses the retained Vite/Capacitor web bundle path. The new Next.js Firebase Functions adapter is for web/backend hosting and does not change the native Android wrapper build path.
