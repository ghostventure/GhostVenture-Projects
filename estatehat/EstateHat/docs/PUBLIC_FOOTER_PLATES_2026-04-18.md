# EstateHat Public Footer Plates - 2026-04-18

## Summary

The EstateHat landing page and sign-in/create-account page now use the same footer plates as the signed-in app.

## Installed

- Shared public footer component: `src/EstateHatPublicFooter.jsx`
- Landing page footer placement: `src/MarketingLanding.jsx`
- Sign-in/create-account footer placement: `src/AuthScreen.jsx`

## Footer Plates

- Brand message
- Product links
- Company links
- Legal links
- Contact block
- Platform labels for Web, iOS, Android, and Windows
- Trust/compliance badges
- EstateHat LLC service disclaimer
- Processing-fee disclaimer
- Create Account and Sign In buttons

## Behavior

- Public Product, Company, and Legal footer labels send signed-out visitors to sign in.
- Create Account opens the account creation panel.
- Sign In opens the sign-in panel.
- Signed-in visitors can use the landing page footer buttons to open EstateHat.
- Careers is shown as coming soon.

## Verification

- `npm test` passed on 2026-04-18.
- `npm run build` passed on 2026-04-18.
- `npm run deploy:hosting` passed on 2026-04-18.
- Live smoke test passed on 2026-04-18:
  - `https://estatehat.web.app/` returned `200`.
  - `https://estatehat.web.app/signin` returned `200`.
  - both pages loaded `assets/index-DlQaW0Zl.js`.
  - the deployed bundle includes:
    - `Licensed Escrow Partners`
    - `A Place Where You Can Hang Your Hat`
