# FoxHub Staff Management Console - 2026-06-11

## Summary

Separated the staff/management workspace from member-facing content and expanded the Management dashboard with actual operator controls.

## Changes

- Staff and management accounts now receive a staff-only workspace navigation set:
  - Management
  - Staff Tools
  - Control Library
- Member-side navigation is removed for staff/management accounts:
  - Home
  - Social
  - Rapport
  - Communal
  - Services / Merchant
  - Needs & Offers
  - Pay
  - UX / Goodies
- Staff route guarding now redirects management accounts away from member tabs and back to Management unless they are opening Staff Tools or Control Library.
- Follow-up access repair: `/management` now allows `Management`, `Staff Tools`, and `Control Library` to stay active instead of forcing every management-route tab back to Management.
- Follow-up staff onboarding control: Management now includes a populated `Add new FoxHub Staff Member` card that stages a staff member record, operator access record, audit event, and staff notification.
- Staff role templates now cover support, trust and safety, fraud/risk, disputes, compliance, moderation, merchant operations, security, customer success, operations management, admin, and audit.
- Header behavior changes for staff accounts:
  - Brand click opens Management instead of Home.
  - Header title reads `Staff controls and review queues`.
  - Search/tool shortcut opens Staff Tools instead of member discovery.
  - Primary header action reads `Review`.

## Management Controls Added

- Trust recalculation control using the existing trust engine.
- Operator copilot triage control.
- Priority notification policy control.
- Notification digest panel.
- Audit trail panel.
- Merchant risk controls.
- Settlement controls.
- Compliance controls.
- Operator copilot insights panel.
- Staff Tools and Control Library navigation controls.
- Add new FoxHub Staff Member form.
- Staff setup queue for staged staff and operator access records.
- Staff role library.
- Loaded staff controls for access review, permission audit, application sweep, fraud hold, security incident, dispute intake, compliance review, merchant risk, settlement approval, and device recovery.

## Existing Review Queues Preserved

- FoxHub Member applications.
- Verification queue.
- Moderator queue.
- Applicant email notices.

## Files Changed

- `src/FoxHubShell.jsx`
- `src/App.jsx`
- `src/styles.css`
- `scripts/release-smoke.mjs`
- `docs/STAFF_MANAGEMENT_CONSOLE_2026-06-11.md`
- `docs/DOCS_INDEX.md`
- `docs/PROJECT_STATUS.md`
- `docs/CURRENT_HANDOFF_2026-05-31.md`

## Verification

Completed before deploy:

- `npm run release:check` (pass)
  - `npm test` (pass)
  - `npm run smoke:public` (pass)
  - `npm run build` (pass)

Release smoke now verifies staff-console markers including:

- `Staff control center for access, trust, risk, and operations.`
- `Staff and management accounts now stay in operator mode.`
- `Operator controls`
- `Run trust engine`
- `Merchant risk controls`
- `Settlement controls`
- `Compliance controls`
- `Operator copilot insights`
- `Staff Tools`
- `Control Library`
- `Add new FoxHub Staff Member`
- `support.staff@foxhub.app`
- `Staff setup queue`
- `Staff role library`
- `Loaded staff controls`

Completed after deploy:

- `npm run deploy:hosting` (pass)
- live `/` HTTP 200
- live `/signin` HTTP 200
- live `/feedback` HTTP 200
- live `/management` HTTP 200
- live Hosting `Last-Modified`: `Thu, 11 Jun 2026 12:13:28 GMT`
- deployed `dist/assets/FoxHubShell-rywepDkR.js` contains the staff-console markers listed above

Follow-up verification:

- `npm run release:check` (pass)
- Staff Tools and Control Library labels are now covered by public release smoke.
