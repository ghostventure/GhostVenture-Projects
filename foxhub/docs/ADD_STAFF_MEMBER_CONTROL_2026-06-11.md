# Add Staff Member Control - 2026-06-11

## Summary

Added a populated `Add new FoxHub Staff Member` card to the Management workspace.

## What changed

- Management now includes a staff-only card for staging a new staff account.
- The card now includes a role template library with 12 staff roles:
  - Support ops
  - Trust and safety
  - Fraud and risk
  - Disputes
  - Compliance
  - Moderator
  - Merchant ops
  - Security analyst
  - Customer success
  - Operations manager
  - Admin
  - Auditor
- The form is prefilled with:
  - `New FoxHub Staff Member`
  - `support.staff@foxhub.app`
  - `Support Operations Specialist`
  - `Support Operations`
  - `support, member-review, connections, notifications, account-recovery`
- Selecting a role quick-pick updates the title, department, and permission scopes.
- Submitting the form creates a pending staff record and matching operator access record in app state.
- The Management dashboard now shows a `Staff setup queue` with pending staff invites and staged operator access records.
- The action also records a staff audit event and notification.
- Management now includes a `Loaded staff controls` panel for access review, permission audit, application sweep, fraud hold, security incident, dispute intake, compliance review, merchant risk, settlement approval, and device recovery.

## Files changed

- `src/useFoxHubStore.js`
- `src/App.jsx`
- `src/FoxHubShell.jsx`
- `src/styles.css`
- `scripts/release-smoke.mjs`
- `docs/ADD_STAFF_MEMBER_CONTROL_2026-06-11.md`
- `docs/STAFF_MANAGEMENT_CONSOLE_2026-06-11.md`
- `docs/DOCS_INDEX.md`
- `docs/PROJECT_STATUS.md`
- `docs/CURRENT_HANDOFF_2026-05-31.md`

## Verification

Completed:

- `npm run release:check` (pass)
- `npm run deploy:hosting` (pass)
- live `/management` HTTP 200
- live `/assets/FoxHubShell-DVnSwmOI.js` HTTP 200
- live `/assets/index-CLXWXSls.css` HTTP 200
- live Hosting `Last-Modified`: `Thu, 11 Jun 2026 12:43:59 GMT`

Release smoke covers these shipped markers:

- `Add new FoxHub Staff Member`
- `Support Operations Specialist`
- `support.staff@foxhub.app`
- `Add staff member`
- `Staff setup queue`
- `Staff role library`
- `Fraud Risk Analyst`
- `Compliance Operations Officer`
- `Security Operations Analyst`
- `Loaded staff controls`
- `Permission audit`
- `Device recovery`
