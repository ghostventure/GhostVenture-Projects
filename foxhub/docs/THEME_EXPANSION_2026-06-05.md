# Theme Expansion - 2026-06-05

## Summary

FoxHub now has 20 selectable color themes.

## Installed themes

- Day
- Green Composite
- Night
- Matrix
- Forest
- Ocean
- Ember
- Slate
- Rose
- High Contrast
- Lavender
- Cyberpunk
- Mint
- Midnight
- Solar
- Arctic
- Grape
- Premium Silver - $10/month
- Premium Gold - $20/month
- Dark Marble Premium - $30/month

## What changed

- Added a shared `THEME_OPTIONS` registry.
- Expanded saved theme validation from 3 themes to 19 themes.
- Updated the theme toggle to cycle through all installed themes.
- Added a direct theme picker in the app header.
- Added theme token sets for Forest, Ocean, Ember, Slate, Rose, and High Contrast.
- Added high-contrast button/input hardening.
- Added mobile handling for the theme picker.
- Added release smoke markers for new theme labels and CSS selectors.

## Variety expansion

- Added 7 more themes after the first expansion:
  - Lavender
  - Cyberpunk
  - Mint
  - Midnight
  - Solar
  - Arctic
  - Grape
- The theme picker and cycle now include all 20 themes.

## Default visitor theme

- Green Composite is the default first-visit theme.
- Returning visitors without a valid saved theme also fall back to Green Composite.
- Visitors who already selected and saved another valid theme keep their saved theme.

## Premium theme expansion

- Added Premium Silver at `$10/month`.
- Added Premium Gold at `$20/month`.
- Added Dark Marble Premium at `$30/month`.
- These themes are locked for member accounts unless the profile has the matching paid theme entitlement.
- FoxHub staff accounts can use premium themes without payment.

## Verification

- `npm test` passed on 2026-06-06.
- `npm run build` passed on 2026-06-06.
- `npm run smoke:public` passed on 2026-06-06.
- Local Playwright render check against `dist` returned status 200, populated `#root`, and no console/page errors.
- Firebase Hosting deploy to `https://foxhub-superapp.web.app` completed on 2026-06-06.
- Live Playwright render check against `https://foxhub-superapp.web.app` returned status 200, populated `#root`, and no console/page errors.
