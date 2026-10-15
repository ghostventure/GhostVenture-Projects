# FoxHub Android APK Build - 2026-04-18

Built a direct-install Android debug APK for FoxHub.

## Scope

- Synced the latest Vite web build into the Capacitor Android wrapper.
- Added local Android SDK path configuration for this machine.
- Built a debug Android package installer.
- Copied the APK into the repo `release/` folder with a clear FoxHub filename.

## Commands

- `npm run sync:android`
- `JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64 ./gradlew assembleDebug`

## Outputs

- `release/FoxHub-Android-Debug-0.1.0.apk`
- `android/app/build/outputs/apk/debug/app-debug.apk`

## Verification

- `npm run sync:android` passed.
- `JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64 ./gradlew assembleDebug` passed from the Android project.
- `file release/FoxHub-Android-Debug-0.1.0.apk` confirmed the output is an Android package with an APK signing block.
- APK size is about `5.8 MB`.

## Recovery Notes

- Keep `android/local.properties` pointed at `/home/sniper-lion-main/Android/Sdk` on this machine.
- Use Java 21 for FoxHub Android APK builds:
  - `JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64 ./gradlew assembleDebug`
- The debug APK is intended for direct testing and field review. A production Play Store release needs release signing and store packaging setup.
