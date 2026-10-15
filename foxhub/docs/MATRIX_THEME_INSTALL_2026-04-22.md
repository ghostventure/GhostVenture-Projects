# FoxHub Matrix Theme Install - 2026-04-22

## Summary

Added a third GUI theme to FoxHub: `Matrix`.

FoxHub now cycles through:

- Day
- Night
- Matrix

## Changed

- Updated theme persistence to accept `matrix` in addition to `light` and `dark`.
- Updated the theme toggle cycle:
  - Day -> Night
  - Night -> Matrix
  - Matrix -> Day
- Updated the theme toggle label logic:
  - Day shows `Night mode`
  - Night shows `Matrix mode`
  - Matrix shows `Day mode`
- Added Matrix theme CSS variables and surface treatments:
  - dark green/black base
  - neon green accent system
  - subtle grid texture
  - green glow on panels, buttons, badges, inputs, and headers

## Files

- `src/App.jsx`
- `src/rules.js`
- `src/styles.css`

## Verified

- `npm test` passed.
- `npm run build` passed.
- `npm run vite:build` passed.
