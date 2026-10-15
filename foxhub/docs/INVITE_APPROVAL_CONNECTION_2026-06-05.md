# Invite Approval Connection - 2026-06-05

## Summary

Approved invite requests now create a connection between the inviter/sponsor and the new member.

## Behavior

- When a sponsor approves a pending invite, the invited applicant is added to the sponsor's Rapport contacts.
- The contact is marked as:
  - `status: "invite approved"`
  - `trust: "trusted"`
  - `trustTier: "B"`
  - `referralSource: "sponsor invite"`
- In Firebase mode, the sponsor-side contact is written in the same batch as the invite approval.
- In Firebase mode, when the approved applicant signs in and the redeemed invite is applied, the sponsor is added to the applicant's contacts.
- Duplicate contact records are avoided in local/demo mode.

## Files Updated

- `src/repository-local.js`
- `src/repository-firebase.js`
- `src/useFoxHubStore.js`
- `tests/local-profile-persistence.test.mjs`

## Verification

Run:

- `npm test`
- `npm run smoke:public`
- `npm run build`

Regression coverage:

- Local sponsor invite approval marks the invite as redeemed.
- The approved applicant appears in the sponsor's contacts.
- The applicant can sign in after approval.
