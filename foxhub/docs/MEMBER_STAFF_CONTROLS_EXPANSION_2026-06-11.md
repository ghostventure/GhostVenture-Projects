# FoxHub Member and Staff Controls Expansion - 2026-06-11

## Summary

Expanded controls in two directions:

1. Members now have clearer self-service controls for their own account, profile, security, connections, notifications, and support requests.
2. Staff and management now have deeper support and operations controls for disputes, fraud, security concerns, support alerts, account recovery, devices, and operational playbooks.

## Member-Side Controls

Added a member-facing `Account controls` surface on the normal Home workspace.

Member controls include:

- Profile and account settings entry.
- Connection permissions and pending request review.
- Message/block path for selected direct contacts.
- Notification settings / browser notification enablement.
- Support or dispute help.
- Security concern reporting.
- Device-session review and revocation.
- Unread notification review and mark-read action.
- Trusted contact summary with a manage path back to Rapport.

These controls are member-scoped and do not expose staff review authority.

## Staff and Management Controls

Expanded Management with support and operational controls for:

- Support operations overview.
- Support case creation.
- Fraud/security escalation.
- Support priority notification mode.
- Support macro/playbook launcher.
- Support alert queue.
- Dispute queue and resolution.
- Fraud hold queue.
- Security concern queue.
- Device and account recovery review.

Existing staff controls remain:

- Member applications.
- Verification queue.
- Moderator queue.
- Applicant email notices.
- Trust recalculation.
- Operator copilot.
- Notification digest.
- Audit trail.
- Merchant risk controls.
- Settlement controls.
- Compliance controls.

## Files Changed

- `src/FoxHubShell.jsx`
- `src/styles.css`
- `scripts/release-smoke.mjs`
- `docs/MEMBER_STAFF_CONTROLS_EXPANSION_2026-06-11.md`
- `docs/DOCS_INDEX.md`
- `docs/PROJECT_STATUS.md`
- `docs/CURRENT_HANDOFF_2026-05-31.md`

## Verification

Completed before deploy:

- `npm run release:check` (pass)
  - `npm test` (pass)
  - `npm run smoke:public` (pass)
  - `npm run build` (pass)

Release smoke now verifies markers for:

- `Account controls`
- `Member self-service`
- `Manage your profile, security, connections, and support.`
- `Profile and account settings`
- `Connection permissions`
- `Support or dispute help`
- `Report security concern`
- `Support operations`
- `Support, disputes, fraud, and security stay in staff view.`
- `Support macros`
- `Fraud hold queue`
- `Security concerns`
- `Device and account recovery review`

Completed after deploy:

- `npm run deploy:hosting` (pass)
- live `/` HTTP 200
- live `/signin` HTTP 200
- live `/management` HTTP 200
- live `assets/FoxHubShell-QmS3-Bjo.js` HTTP 200
- live Hosting `Last-Modified`: `Thu, 11 Jun 2026 12:24:51 GMT`
