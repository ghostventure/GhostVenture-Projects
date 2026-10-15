# FoxHub Versioning And Packaging

Current app version:

- `0.1.0`

Current package outputs:

- Android debug: `release/FoxHub-Android-Debug-0.1.0.apk`
- Windows portable: `release/FoxHub-0.1.0-x64.exe`

## Version Bump Rules

- Patch version: UI copy, footer pages, docs, smoke-test improvements, small route fixes.
- Minor version: new product surfaces, major Organizer expansions, new package/runtime behavior.
- Major version: production backend contract changes, paid wallet behavior, breaking data model changes.

Before a version bump:

1. Update `package.json` version.
2. Update Android version code/name in the Android project when moving beyond debug packages.
3. Rebuild Android and Windows outputs.
4. Update `docs/PROJECT_STATUS.md`.
5. Record the live Hosting `Last-Modified` timestamp after deploy.

## Installed Scripts

- `npm run smoke:public`
  - builds the Vite bundle and verifies public splash/footer/Organizer assets.
- `npm run release:check`
  - runs unit tests, public smoke, and Next build.
- `npm run package:android:debug`
  - syncs Capacitor, builds Android debug with Java 21, and copies the APK into `release/`.
- `npm run package:software`
  - refreshes Android debug and Windows portable packages.

## Latest Verified Package Assets

Latest refreshed assets:

- Vite JS: `index-BsADIE4X.js`
- Vite CSS: `index-Bmm8Z6Vf.css`

These are present in:

- Android wrapper assets
- Windows `app.asar`

## Signing Status

- Android debug signing: available through Gradle debug build.
- Android release signing: not configured.
- Windows Authenticode signing: not configured.
- Windows icon: not configured.

Do not call a package production-ready until release signing is configured and verified on a clean install machine.
