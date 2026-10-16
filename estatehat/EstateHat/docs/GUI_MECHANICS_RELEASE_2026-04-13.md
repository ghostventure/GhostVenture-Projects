# GUI Mechanics Release - 2026-04-13

## Deployment

- Firebase project: `estatehat`
- Hosting URL: `https://estatehat.web.app`
- Deploy command used: `npm run deploy:hosting`
- Deployment result: successful
- Deploy guard result: passed

## Verification

- `npm run build`: passing
- `npm test`: passing
  - Runs `tests/compliance-mechanics.test.mjs`

## GUI Features Added

The following GUI surfaces were installed as first-pass functional interfaces:

- Hat Board Housing Trends
- Verified User Referral Incentive
- Universal Search
- Notification Center
- Document Vault
- Document Preview Pane
- Transaction Timeline
- Offer Composer
- Tour Scheduler
- Property Comparison
- Admin Workbench
- Global Toast Notifications
- Global Confirm Dialog

Primary implementation files:

- `src/GuiFeatureViews.jsx`
- `src/estatehat-platform-alpha.jsx`

## Mechanics Alignment

The GUI was adjusted so it no longer presents mock transaction, document, admin, professional, or notification records as real data.

Current functional mechanics:

- Live listings still come from Firestore through `subscribeToListings`.
- Housing trends on the Hat Board fetch public FRED CSV series directly:
  - `MORTGAGE30US`
  - `MSPUS`
  - `CSUSHPINSA`
  - `HOUST`
- Housing trends cache the last successful response in `estatehat-housing-trends-v1`.
- If public feeds are unavailable, the Hat Board shows an unavailable/error state and does not invent market values.
- Verified User referrals are tracked in the member profile under `verifiedBilling.referralIncentive`.
- Each verified referral earns one free Verified User month, with a hard cap of 12 earned months.
- Duplicate friend email credits are blocked in the GUI.
- Applying a referral month increments applied credit count and extends `verifiedBilling.nextChargeAt` by 30 days from the later of now or the existing next charge date.
- Offer drafts are saved locally under `estatehat-offers-v1`.
- Scheduled tours are saved locally under `estatehat-tours-v1`.
- Vault uploads are saved locally under `estatehat-vault-uploads-v1`.
- Notification Center derives notifications from saved offer drafts, scheduled tours, and vault uploads.
- Document Vault displays local user uploads and any future connected document feed passed into the component.
- Admin Workbench renders an empty connected-state until a real document, flag, or transaction feed is wired.
- Transaction Timeline renders an empty connected-state until real transaction records are wired.
- Matching Service no longer displays hardcoded professional matches.

## Mock Data Cleanup

The following hardcoded data sources were emptied so they cannot be mistaken for live production data:

- `USER_DEALS`
- `ROLE_DEALS`
- `ADMIN_VERIFICATION_QUEUE`
- `ADMIN_DOC_REVIEW_QUEUE`
- `ADMIN_ACTIVE_TRANSACTIONS`
- `ADMIN_FLAGS`
- `PROFESSIONAL_MATCH_DIRECTORY`

These names remain in source as compatibility placeholders because existing views still reference them. They now evaluate to empty collections.

## Navigation Cleanup

- Top navigation now uses a single `primaryNavItems` configuration instead of repeated inline button declarations.
- Secondary GUI tools remain reachable through Universal Search and the command palette.
- Route permission gating was extended for:
  - `compare`
  - `tours`
  - `offer`
  - `milestones`
  - `documents`
  - `admin-workbench`

## Visual Refresh

The interface received a cleaner contemporary pass:

- Reduced warm beige/brown dominance.
- Updated shell and loading colors to a more neutral palette.
- Reduced decorative background treatment.
- Tightened card/button radius usage.
- Simplified navigation styling.
- Kept the existing EstateHat gold accent for brand continuity.

## Backend-Dependent Features

The following screens are structurally ready but intentionally show empty connected states until backend feeds are implemented:

- Transaction Timeline
- Admin Workbench
- Admin Oversight queues
- Professional matching directory
- Live document review queue
- Live compliance flags
- Live transaction pipeline

## Referral Incentive Data

The referral incentive is persisted as part of the verified billing profile state:

- `verifiedBilling.referralIncentive.status`
- `verifiedBilling.referralIncentive.maxFreeMonths`
- `verifiedBilling.referralIncentive.earnedFreeMonths`
- `verifiedBilling.referralIncentive.appliedFreeMonths`
- `verifiedBilling.referralIncentive.referralCode`
- `verifiedBilling.referralIncentive.credits[]`

Each credit stores the referred friend's email/name, credit status, free-month value, creation timestamp, and credit timestamp. The profile sanitizer caps stored credits and earned/applied months at 12.

## Important Product Rule

Do not reintroduce placeholder rows that look like real people, properties, documents, transactions, or compliance events. Use empty states until the data is connected to a real backend source or is explicitly user-created local state.
