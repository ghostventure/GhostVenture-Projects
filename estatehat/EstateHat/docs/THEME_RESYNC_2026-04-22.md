# Theme Resync - 2026-04-22

## Summary

EstateHat day/night shading was resynced so text hierarchy and header buttons remain readable in both modes.

## Changed

- Added dedicated theme tokens for fixed dark header surfaces and header text.
- Tuned night-mode secondary text colors so body, muted, and helper copy do not all read as the same brightness.
- Updated the signed-in top header buttons, account chip text, theme toggle, Find button, and logout button to use the header text token.
- Updated assistant and command palette panels that still used fixed white/tan card backgrounds and hardcoded text colors.

## Verified

- `npm test` passed.
- `npm run build` passed.
- `npm run vite:build` passed.
