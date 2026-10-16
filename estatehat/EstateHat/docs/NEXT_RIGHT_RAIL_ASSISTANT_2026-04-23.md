# Next Right Rail And Assistant Placement - 2026-04-23

## Summary

EstateHat now has the signed-in shell navigation moved from the top bar to a right-side rail in the Next-backed app source. The EstateHat Assistant launcher and panel are anchored on the left side.

This change was made in the active Next/Vite shared source, not only in the older Create React App copy.

## Changed

- Moved the authenticated navigation from a horizontal top bar to a fixed right-side rail on desktop.
- Kept the compact/mobile navigation horizontal and sticky to preserve small-screen space.
- Moved `EstateHatAssistant` launcher and expanded assistant panel from the right side to the left side.
- Added desktop right padding to the shell so content does not sit underneath the right rail.
- Kept command palette, dark-mode toggle, account chip, device chip, and logout inside the right rail.

## Primary File

- `src/estatehat-platform-alpha.jsx`

## Important Hosting Note

EstateHat currently has a Next local web foundation, but Firebase Hosting still publishes the Vite static bundle from `dist`.

The edited component is shared by both:

- Next routes via `app/home/page.jsx`
- Vite Hosting/native/desktop bundle via `src/main.jsx`

So the same right-rail and left-assistant placement is available to the Next app source and the hosted Vite bundle.

## Verification

Passed:

- `npm run build`
- `npm test`
- `npm run deploy:hosting`

Firebase Hosting deploy:

```sh
npm run deploy:hosting
```

Result:

- Firebase project: `estatehat`
- Hosting URL: `https://estatehat.web.app`
- Live `/start` route returned HTTP `200`
- Live `/home` route returned HTTP `200`
- Hosted bundle includes the right-side desktop rail and left-side assistant placement

Live site:

- `https://estatehat.web.app`

## UX Notes

- Desktop: primary navigation is fixed to the right side.
- Compact/mobile: navigation remains top/sticky to avoid consuming horizontal viewport width.
- Assistant: launcher and panel open from the left side on desktop and compact layouts.
