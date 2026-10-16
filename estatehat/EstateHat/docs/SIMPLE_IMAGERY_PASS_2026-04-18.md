# EstateHat Simple Imagery Pass - 2026-04-18

## Summary

Simple image accents were added across EstateHat so the product feels less text-heavy without changing the core workflows.

## Installed

- Shared image component: `src/EstateHatImagery.jsx`
- Main signed-in page headers now show simple image bands through `SectionHeader`.
- Sign-in/create-account page now includes a simple image band before the public footer.
- Hat Data now includes a simple image band.
- Move Kit now includes a simple image band.
- Goodies now includes a simple image band.

## Image Style

- Simple home, interior, paperwork, planning, and city imagery.
- Lazy-loaded remote images.
- Rounded corners limited to 8px.
- Auto-wrapping layout for phones and desktop.
- No core account, listing, legal, or transaction behavior was changed.

## Verification

- `npm test` passed on 2026-04-18.
- `npm run build` passed on 2026-04-18.
- `npm run deploy:hosting` passed on 2026-04-18.
- Live smoke test passed on 2026-04-18:
  - `https://estatehat.web.app/` returned `200`.
  - `https://estatehat.web.app/signin` returned `200`.
  - both pages loaded `assets/index-DOe3Gw2h.js`.
  - the deployed bundle includes `estatehat-image-band` and the simple image alt text.
