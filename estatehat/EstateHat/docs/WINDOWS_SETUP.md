# EstateHat Windows Desktop Setup

EstateHat now includes an Electron-based Windows desktop app scaffold.

## Key files

- `electron/main.cjs`
- `electron/preload.cjs`
- `package.json`

## Local development

Run the desktop app against the Vite dev server:

```bash
npm run dev:desktop
```

## Production build

Build the web app and package the Electron desktop app:

```bash
npm run dist:win
```

For a fast validation-only refresh of Windows client assets:

```bash
npm run build:windows
```

`npm run build:windows` was successfully executed during the 2026-04-11 update pass.

## Output

Packaged Windows artifacts will be written to:

```bash
release/
```

## Current desktop app details

- App name: `EstateHat`
- Windows packaging target: `nsis`
- Main Electron entry: `electron/main.cjs`

## Notes

- External links open in the default browser.
- The desktop shell loads the local Vite dev server in development and the built `dist/index.html` in production.
- The Windows desktop shell mirrors the current web app because it loads the same built `dist/` output.
- Current mirrored features include:
  - production-mode roles and admin oversight
  - webmaster and administrator profile mapping
  - watchlist
  - saved searches
  - recent views
  - cached listing bootstrap
  - footer/legal content pages
- Final code signing and installer distribution are still separate release steps you can handle later.
