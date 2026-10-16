# EstateHat Platform Documentation

Last updated: 2026-04-11

## 1) Platform Overview

EstateHat is a production Firebase-hosted web platform for peer-to-peer real estate workflow coordination.

Live URL:

- `https://estatehat.web.app`

Core stack:

- React + Vite
- Firebase Auth
- Firestore
- Firebase Hosting

Business identity:

- EstateHat LLC (North Carolina)

## 2) Primary Product Direction

Current UX goals implemented:

- Lean and simple interface for casual users
- Luxury visual direction
- Assistant-first guidance
- Critical mechanics grouped under top-level feature categories
- Single-page post-login landing surface ("Hat Board")

## 3) Current Navigation Model

Default post-login view:

- `dashboard` (Hat Board)

Main views:

- `dashboard` (Hat Board)
- `browse`
- `watchlist`
- `detail`
- `list`
- `profile`
- `transaction`
- `messages`
- `boilerplates` (Common Forms wording in UI)
- `admin`
- `calculator`
- `help`
- `faq` (FAQ & Scope)
- `terms`
- `privacy`
- `about`
- `press`
- `accessibility`
- `dmca`

## 4) Hat Board (Landing Page)

The Hat Board is the post-login status page and contains high-value widgets:

- Trusted User status
- Profile completion
- Verification progress
- Legal component completion
- Payout framework readiness
- Verified billing readiness
- Watchlist count
- Live listing/sync status

It also includes:

- Priority checklist actions
- Activity indicators
- Direct links to Profile, My Deal, Messages, Browse

## 5) Trust & Verified Profile

Verified Profile (green icon):

- Price: `$20/mo`
- Visibility toggle supported
- Availability gated by profile/legal/verification readiness
- Referral incentive supported: one free Verified User month per verified friend referral, capped at 12 total earned months.

Framework state stored per user:

- `trust` (badge state/visibility/plan/price/since)
- `verifiedBilling` (provider, interval, status, compliance checks, charge markers, referral incentive credits)

Verified billing readiness checks include:

- Profile eligibility
- Legal readiness
- Payment method saved
- Fraud review clear

## 6) Payout Framework

Payout framework is now modeled and persisted in user profile state:

- Primary/fallback provider
- Payout method
- Payout schedule
- Minimum threshold
- Reserve rate
- Instant payout toggle
- Readiness/compliance controls
- Provider account identifiers
- Queue snapshot support

Default provider strategy in UI:

- Stripe Connect-first

## 7) Legal & Governance Surface

Legal pages implemented:

- Terms of Service
- Privacy Policy
- Accessibility
- DMCA

Legal copy status:

- Updated to EstateHat LLC references
- Scope disclaimers tightened (technology platform framing)
- Over-claiming compliance language reduced
- "Back" actions route to Hat Board for flow consistency

## 8) FAQ & Scope Page

New dedicated page:

- `FAQ & Scope` (`view = "faq"`)

Covers:

- What EstateHat offers
- What EstateHat does not offer
- What support is in scope
- What support is out of scope
- Billing/fees scope
- Data/privacy scope
- Government profile role scope
- Verified badge scope

Discovery:

- Footer Company links
- Footer Legal links
- Command palette entry
- Help Center CTA

## 8.1) Jurisdiction Auto-Sync + Compliance Forms

- Buyer flow (`Make an Offer`) now captures transaction location (city/state/county/municipality) and syncs profile compliance jurisdiction automatically.
- Seller flow (`List Property`) now captures location fields and syncs profile compliance jurisdiction on listing submission.
- Profile compliance overlay is auto-applied (`strict_us_51` baseline + outlier flags + checklist notes).
- Forms now include compliance attestations/acknowledgments with jurisdiction fill-ins:
  - Non-Brokerage Acknowledgment
  - Fair Housing Attestation
  - Support Scope Attestation
  - Electronic Records Consent Acknowledgment
  - Marketing Consent Attestation
  - Platform Fee Disclosure Attestation
  - Funds Custody Boundary Attestation

## 8.2) FAQ + Assistant Compliance Disclosure Coverage

- Help Center FAQ now explicitly states where legal/compliance/support disclosures are located.
- FAQ & Scope includes explicit sections for:
  - required legal component evidence expectations,
  - jurisdiction-aware compliance adjustments (state/county/city/borough/parish + territories),
  - in-product disclosure locations (Help, FAQ, Assistant, Forms, Hat Data, Goodies, My Info).
- EstateHat Assistant now includes a dedicated compliance topic with direct links to Help Center, FAQ & Scope, Forms, Hat Data, Goodies, and My Info.

## 9) User Profile Data Model (Firestore)

Collection:

- `users`

Current profile schema version:

- `12`

Managed areas:

- Base identity/contact fields
- `security`
- `verification`
- `trust`
- `legal`
- `compliance`
- `userDatabase`
- `payoutFramework`
- `verifiedBilling`

Write behavior:

- Merge-based updates (`setDoc(..., { merge: true })`)
- Repair/write gating compares managed fields
- Managed field comparison now uses stable structural equality to reduce unnecessary writes

## 10) Account Roles

Supported account types include:

- buyer, seller
- corp_buyer, corp_seller
- attorney, agent, inspector, lender
- admin, webmaster
- gov_township, gov_city, gov_county, gov_borough, gov_parish, gov_state, gov_federal

## 11) Current Fee Presentation

In-product fee model currently presented:

- EstateHat processing fee: `1.50%`
- Escrow flat fee: `$500`
- Wire flat fee: `$35`

## 12) Deploy and Verification

Build:

```bash
npm run build
```

Deploy:

```bash
npm run deploy:hosting
```

Recent deployment:

- 2026-04-11 deploy completed successfully to `https://estatehat.web.app`

## 13) Important Files

- `src/estatehat-platform-alpha.jsx`
- `src/backend.js`
- `src/main.jsx`
- `src/AuthScreen.jsx`
- `src/firebase.js`
- `docs/PROJECT_STATUS.md`
- `docs/OPERATIONS.md`
- `docs/PLATFORM_DOCUMENTATION.md`
- `docs/ANDROID_SETUP.md`
- `docs/IOS_SETUP.md`
- `docs/WINDOWS_SETUP.md`
- `docs/LEGAL_SIGNOFF_WORKFLOW_2026-04-11.md`
- `docs/SECURITY_PROGRAM_2026-04-11.md`
- `docs/DATA_GOVERNANCE_RUNBOOK_2026-04-11.md`
- `docs/VENDOR_COMPLIANCE_PACKET_CHECKLIST_2026-04-11.md`
- `docs/ACCESSIBILITY_AUDIT_LOG_2026-04-11.md`
- `tests/compliance-mechanics.test.mjs`
- `.github/workflows/compliance-ci.yml`

## 14) Compliance Program Controls Added (2026-04-11)

Implemented controls matching requested areas:

1. Legal sign-off workflow
- `docs/LEGAL_SIGNOFF_WORKFLOW_2026-04-11.md`

2. Automated compliance tests in CI
- `tests/compliance-mechanics.test.mjs`
- `.github/workflows/compliance-ci.yml`

3. Security hardening ops program
- `docs/SECURITY_PROGRAM_2026-04-11.md`

4. Data governance and legal hold runbook
- `docs/DATA_GOVERNANCE_RUNBOOK_2026-04-11.md`

5. Vendor legal/security packet checklist
- `docs/VENDOR_COMPLIANCE_PACKET_CHECKLIST_2026-04-11.md`

6. Accessibility audit and remediation log process
- `docs/ACCESSIBILITY_AUDIT_LOG_2026-04-11.md`

## 15) Client Platform Update Status (2026-04-11)

Android:
- Added scripted update path: `npm run sync:android`
- Verified sync completed against current `dist/` build.

iOS:
- Verified `npm run sync:ios` completed against current `dist/` build.

Windows:
- Added scripted validation build path: `npm run build:windows`
- Verified desktop production web build completed successfully.
