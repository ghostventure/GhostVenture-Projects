# EstateHat Rollback Notes

Use this document when the current checkout needs to be restored but Git history is unavailable or incomplete.

## Current limitation

- This repository may not have usable commit history for content rollback.
- In that case, `git revert`, `git restore`, and reflog-based recovery may not help.

## Authoritative fallback sources

Use these in this order when validating older EstateHat wording or structure:

1. `/home/sniper-lion-main/Documents/EstateHat_files/estatehat-platform.jsx`
2. `/home/sniper-lion-main/Documents/EstateHat_files/EstateHat_platform.html`
3. `/home/sniper-lion-main/Documents/EstateHat_files/estatehat/src/estatehat-platform-alpha.jsx`

These are older EstateHat artifacts. They are useful as fallback references for EstateHat-specific language and UI intent, but they are not a drop-in replacement for the current Vite/Firebase app.

## Files to inspect first during rollback

- `src/estatehat-platform-alpha.jsx`
- `src/AuthScreen.jsx`
- `src/authBranding.js`
- `src/main.jsx`
- `index.html`

## Cross-project contamination checklist

If any of the following appear in EstateHat source, treat it as likely contamination and compare against the fallback sources above:

- `CLTCH`
- `gig`
- `performer`
- `host`
- `Gig Radar`
- `Artists welcome`
- references to another product replacing EstateHat branding

## Safe rollback procedure

1. Search the current source for obviously foreign branding or domain language.
2. Compare only the affected sections against the fallback artifacts.
3. Restore EstateHat wording and behavior without overwriting newer EstateHat-specific infrastructure.
4. Rebuild with `npm run build`.
5. If the build passes, deploy with `npm run deploy:hosting`.

## Do not do this

- Do not replace the entire current app with the older artifact wholesale.
- Do not trust generated `dist/` files as the source of truth.
- Do not guess at old content when a fallback artifact is available.

## Verified recovery on 2026-04-02

The following contamination was successfully removed using the fallback artifacts above as reference:

- CLTCH auth-brand branching in `src/authBranding.js`
- CLTCH-driven branding selection in `src/AuthScreen.jsx`
- gig/performer/host wording in `src/estatehat-platform-alpha.jsx`

After cleanup, the app was rebuilt and redeployed to `https://estatehat.web.app`.
