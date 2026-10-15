# Premium Theme Locks - 2026-06-06

## Summary

FoxHub now treats the three premium themes as paid member options while keeping them available to staff accounts.

## Premium themes

- Premium Silver - $10/month
- Premium Gold - $20/month
- Dark Marble Premium - $30/month

## Access rules

- Member accounts do not get these themes by default.
- Staff accounts bypass the premium lock when the signed-in email domain contains `foxhub`, regardless of suffix.
- Member accounts unlock a premium theme when the profile has a matching paid entitlement.
- An `all` entitlement unlocks every premium theme for that member profile.

## Entitlement fields

The app accepts these profile fields for future billing or manual approval wiring:

- `premiumThemes`
- `themeEntitlements`
- `premiumThemeAccess`
- `activeThemeSubscriptions`
- `paidThemes`

Array values can include a theme id such as `premium-silver`. Object values can mark a theme as `true`, `active`, `paid`, or `subscribed`.

## GUI behavior

- The header theme picker shows locked premium options as disabled for unpaid member accounts.
- The theme cycle skips locked themes for unpaid member accounts.
- If a member account has a locked premium theme saved from an older session, the app automatically falls back to Day.
- Staff accounts can select and cycle through all installed themes.

## Verification

- `npm test` passed with 15/15 tests.
- `npm run build` passed.
- `npm run smoke:public` passed.
- Local Playwright check against `dist` returned HTTP 200, populated the React root, and logged no console/page errors.
- Firebase Hosting deploy completed for project `foxhub-superapp`.
- Live Playwright check against `https://foxhub-superapp.web.app` returned HTTP 200, populated the React root, and logged no console/page errors.

## Preservation

After deploy and verification, the project archive was refreshed at:

- `/home/sniper-lion-main/Documents/Firebase Websites/Archives/FoxHub App.zip`
