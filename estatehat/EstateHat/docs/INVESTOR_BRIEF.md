# EstateHat Investor Brief

Last updated: 2026-04-09

## 1) Company

- Legal entity: **EstateHat LLC** (North Carolina).
- Product: peer-to-peer real estate transaction workflow platform.
- Live product URL: `https://estatehat.web.app`.

## 2) Problem and thesis

EstateHat is built around a simple thesis:

- Most users are not process experts.
- Real estate transaction workflows are fragmented and high-friction.
- Trust signals and clear guided flow reduce user error and fraud exposure.

## 3) Product in market today (verified current state)

- Auth-required production web app.
- "Hat Board" landing page for post-login operational visibility.
- Listing, watchlist, profile, transaction, messaging, and legal workflows.
- In-app legal pages and dedicated FAQ scope page.
- Verified User subscription mechanic in product UI (`$20/mo` model).
- Payout framework and verified-billing framework modeled in user profile state.
- Government profile role support (township/city/county/borough/parish/state/federal).

## 4) Revenue model (current in-product model)

- Platform processing fee shown as `1.50%` of completed transaction sale price.
- Additional modeled transaction fees in UI:
  - escrow: `$500`
  - wire: `$35`
- Verified User badge subscription model shown as `"$20/month"`.

Note:

- This brief reflects product-configured model presentation, not audited revenue recognition.

## 5) Competitive positioning

Primary product differentiation currently implemented:

- identity/verification-centric trust posture
- role-based workflow controls
- guided UX for non-expert users
- unified flow across profile/legal/transaction surfaces

## 6) Compliance and risk posture

In-product posture:

- legal-policy pages are available in app
- scope limitations are explicitly documented (technology platform framing)
- user readiness gating for trusted status and payout/billing activation

Important:

- External legal compliance certification and jurisdiction-specific obligations must be confirmed with counsel before broad scale-up.

## 7) Technical and operating posture

- Stack: React, Vite, Firebase Auth, Firestore, Firebase Hosting.
- User profile schema version: `12`.
- Merge-safe profile writes with managed-field repair logic.
- Capacitor native shells synced for iOS and Android.
- Platform deploy pipeline validated via:
  - `npm run build`
  - `npm run deploy:hosting`

## 8) Current gaps before institutional investor process

- Audited KPI history is not embedded in repository docs.
- No repository-native financial statements included.
- No formal compliance opinion letter included.
- No repository-native SOC report, penetration test report, or formal security attestation packet.

## 9) Investor data room checklist

Recommended minimum package:

1. Corporate and legal
- LLC operating agreement
- cap table
- IP assignment and contractor agreements
- counsel-reviewed Terms/Privacy package

2. Financial
- historical P&L / cash flow
- trailing 12-month actuals
- 24-month model with assumptions
- unit economics model (CAC, payback, contribution margin)

3. Product and GTM
- KPI dashboard export (MAU, WAU, conversion funnel, churn, cohort retention)
- customer acquisition channels + CAC by channel
- roadmap and milestone plan (next 2-4 quarters)

4. Risk and compliance
- trust & safety incident workflow
- security architecture overview
- vendor/subprocessor register
- compliance roadmap by state/jurisdiction

## 10) Suggested investor narrative (concise)

- EstateHat is a live product with a clear transaction workflow thesis and trust-first UX design.
- The platform has implemented core monetization mechanics and role/governance scaffolding.
- Near-term value creation depends on:
  - conversion and retention execution
  - billing/payout live integrations
  - legal/compliance hardening
  - measured GTM expansion

## 11) Sources in this repo

- `docs/PLATFORM_DOCUMENTATION.md`
- `docs/HANDOFF_SUMMARY.md`
- `docs/PROJECT_STATUS.md`
- `docs/OPERATIONS.md`
