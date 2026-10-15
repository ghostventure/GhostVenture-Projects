# FoxHub Android And Windows Refresh - 2026-05-27

## Summary

Refreshed the Android and Windows software after the splash footer boilerplate fix and again after the release-readiness/public-footer-route install.

## Outputs

- Android debug APK: `release/FoxHub-Android-Debug-0.1.0.apk`
- Android Gradle output: `android/app/build/outputs/apk/debug/app-debug.apk`
- Windows portable executable: `release/FoxHub-0.1.0-x64.exe`
- Windows unpacked app: `release/win-unpacked/FoxHub.exe`

## Commands

Android:

```bash
npm run sync:android
cd android
JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64 ./gradlew --no-daemon assembleDebug -Djava.net.preferIPv4Stack=true
cd ..
cp android/app/build/outputs/apk/debug/app-debug.apk release/FoxHub-Android-Debug-0.1.0.apk
```

Windows:

```bash
npm run dist:win
```

## Verification

- `npm run sync:android`: pass
- Android Gradle `assembleDebug` with Java 21: pass
- `file release/FoxHub-Android-Debug-0.1.0.apk`: Android package with APK Signing Block
- `npm run dist:win`: pass
- `file release/FoxHub-0.1.0-x64.exe`: Windows PE executable / portable self-extracting archive
- Android assets contain:
  - `android/app/src/main/assets/public/assets/index-BsADIE4X.js`
  - `android/app/src/main/assets/public/assets/index-Bmm8Z6Vf.css`
- Android asset smoke found:
  - `Splash footer`
  - `landing-footer`
  - `footer-info-page`
- Windows `app.asar` contains:
  - `/dist/assets/index-BsADIE4X.js`
  - `/dist/assets/index-Bmm8Z6Vf.css`

## Notes

- Android build used Java 21 intentionally. The host default Java is Java 25, but this project has a documented Java 21 build path.
- Windows build completed with the default Electron icon warning because no app icon is configured.
- In the sandboxed shell, Gradle may fail before startup with `Could not determine a usable wildcard IP for this machine`; running the documented Java 21 Gradle command outside the network-restricted sandbox resolved it.
