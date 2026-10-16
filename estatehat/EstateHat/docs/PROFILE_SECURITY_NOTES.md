# EstateHat Profile And Security Notes

This document tracks the current profile, verification, and account-security implementation in the Vite/Firebase app.

## Primary files

- `src/backend.js`
- `src/estatehat-platform-alpha.jsx`
- `src/main.jsx`
- `src/AuthScreen.jsx`

## Current user profile model

User records are stored in the Firestore `users` collection and are normalized through `src/backend.js`.

Current schema version:

- `10`

Managed fields include:

- `uid`
- `name`
- `email`
- `phone`
- `address`
- `accountType`
- `security`
- `verification`
- `trust`
- `legal`
- `compliance`
- `userDatabase`
- `payoutFramework`
- `verifiedBilling`
  - `referralIncentive`
- `createdAt`
- `updatedAt`

Profile writes are merge-based. The current implementation updates managed fields without intentionally replacing unrelated customer-record data.

## Security object

The `security` object currently supports:

- `twoFactorEnabled`
- `loginAlerts`
- `trustedDevice`
- `documentShield`
- `sessionTimeoutMinutes`

These values are sanitized in `src/backend.js` and surfaced in the Profile Security tab.

## Verification object

The `verification` object currently supports:

- `stepStatus`
- `citizenshipStatus`
- `homeownerVerified`
- `review`

The `review` object currently contains:

- `status`
- `lastSubmittedAt`
- `lastReviewedAt`
- `queueLabel`
- `notes`

This allows the profile UI to show verification progress as a persistent account component rather than only local view state.

## Role blueprint system

The main application now defines role blueprints for:

- buyer
- seller
- corp_buyer
- corp_seller
- attorney
- agent
- inspector
- lender
- admin
- webmaster
- guest

Each blueprint includes:

- role label
- responsibilities
- security priorities
- operational access

This is used to keep profile, shell messaging, and role expectations consistent.

## Profile tabs

The profile surface currently includes:

- Profile
- Verification
- Security
- Documents
- role-specific practice tabs for attorney, agent, inspector, and lender
- Entity Management for corporate accounts
- Financial when permitted
- Receipts when permitted

## New profile components added in the April 3, 2026 overhaul

- role responsibility card
- customer record health card
- role access summary
- security center
- account health checklist
- trusted devices panel
- recent security activity panel
- recovery / reauthentication summary
- verification review status / queue / submission metadata

## Research direction used

The current profile/security additions were guided by:

- OWASP Session Management Cheat Sheet
- OWASP MFA guidance
- NIST SP 800-63B direction around stronger authentication, session controls, and reauthentication for sensitive actions

These were used as implementation direction only. The current app still exposes UI-level controls and metadata; full enforcement logic would require follow-up work in auth/session and backend policy layers.

## Important implementation note

The current profile experience now documents and persists security and verification posture, but it does not itself enforce every security control end-to-end at the platform layer. For example:

- MFA toggles are profile-state today, not a full Firebase MFA enrollment flow
- trusted-device state is profile-state today, not device-bound cryptographic trust
- verification review status is persisted, but admin workflow enforcement still depends on the surrounding app logic

This is intentional so the customer database remains intact while the profile system evolves without destructive record changes.
