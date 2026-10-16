# EstateHat Responsive OS Layout - 2026-04-18

Installed a final UX/UI responsive pass for EstateHat.

## Scope

- Added an operating-system detector in the main EstateHat shell.
- The app now marks the shell with `data-os`, `data-layout-mode`, and `data-mobile-os`.
- Desktop mode keeps workspace grids wide while adding overlap guards.
- Mobile mode changes major workspaces into stacked tile layouts.
- Added a top-bar layout chip that shows `Desktop View` or `Tile View`.
- Added an EstateHat Assistant topic explaining why the layout changes on phones.
- Updated the public landing page with mobile-safe grid formulas and stronger text wrapping.

## Workspaces Covered

- Move Kit
- Hat Data
- Goodies
- Main shell navigation and content grids
- Public landing page

## Files

- `src/estatehat-platform-alpha.jsx`
- `src/EstateHatMoveKit.jsx`
- `src/EstateHatUxSuite.jsx`
- `src/AdditionalComponents.jsx`
- `src/MarketingLanding.jsx`

## Verification

- `npm test` passed.
- `npm run build` passed.
- `npm run sync:android` passed.
- `./gradlew assembleDebug` passed from the Android project.
- Android package installer output: `release/EstateHat-Android-Debug-1.0.0.apk`.
- Android Gradle output: `android/app/build/outputs/apk/debug/app-debug.apk`.
- `npm run sync:ios` passed.
- iOS project output is refreshed at `ios/App/App.xcodeproj` with current web assets in `ios/App/App/public`.
- No `.ipa` was produced because this Linux environment does not have `xcodebuild`, CocoaPods, macOS signing, or Apple provisioning tools.
- `npm run build:windows` passed, so the Windows desktop web assets include the responsive OS layout pass.
- `wine32:i386` was installed and a clean 32-bit Wine prefix was created at `/home/sniper-lion-main/.wine32-estatehat`.
- `WINEPREFIX=/home/sniper-lion-main/.wine32-estatehat WINEARCH=win32 npm run dist:win` passed.
- Windows installer output: `release/EstateHat-Setup-1.0.0.exe`.
- Windows unpacked app output: `release/win-unpacked/EstateHat.exe`.
- `npm run deploy:hosting` passed and released to `https://estatehat.web.app`.
- Chromium desktop screenshot smoke passed against the built landing page at `1440x1000`.
- Chromium bundle smoke confirmed the built app includes `data-layout-mode`, `Tile View`, `Desktop View`, `device-layout`, `estatehat-responsive-workspace`, and `estatehat-landing-hero-grid`.
- Live smoke confirmed `/` and `/signin` return the deployed EstateHat shell and `assets/index-CHTMd63E.js`.
- Live smoke confirmed the deployed main bundle includes `data-layout-mode`, `data-mobile-os`, `Tile View`, `Desktop View`, `device-layout`, `estatehat-responsive-workspace`, and `estatehat-landing-hero-grid`.
- Live smoke confirmed the deployed Move Kit and Goodies chunks include the responsive workspace, tile grid, and overlap guard classes.

## Recovery Notes

- OS detection starts in `detectOperatingSystem()` in `src/estatehat-platform-alpha.jsx`.
- If mobile tile behavior regresses, check the `data-layout-mode="mobile"` CSS rules in `THEME_CSS`.
- If workspace cards overlap, check the `estatehat-responsive-workspace`, `estatehat-workspace-layout`, `estatehat-summary-grid`, `estatehat-tile-grid`, and `estatehat-no-overlap` classes.
- If the landing page clips on phones, check `src/MarketingLanding.jsx` grid formulas using `minmax(min(..., 100%), 1fr)`.
- If the Windows installer must be regenerated from this Linux machine, use `WINEPREFIX=/home/sniper-lion-main/.wine32-estatehat WINEARCH=win32 npm run dist:win`.
- If the Android debug package must be regenerated, run `npm run sync:android`, then `./gradlew assembleDebug` from the `android/` directory and copy `android/app/build/outputs/apk/debug/app-debug.apk` into `release/`.
- If the iOS package must be regenerated, run `npm run sync:ios` here, then open `ios/App/App.xcodeproj` on macOS/Xcode to archive/sign/export the `.ipa`.
