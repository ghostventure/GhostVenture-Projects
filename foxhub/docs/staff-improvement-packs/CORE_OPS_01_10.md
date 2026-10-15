# FoxHub Staff Improvement Pack: Core Ops 01-10

This pack defines the first ten staff-side controls as standalone data for later UI installation. The scope is operational control, staff governance, member-facing case transparency, privacy protection, and incident response.

## Improvements

1. **Role-Based Permissions Matrix** - maps staff roles to allowed actions, scopes, reviews, and least-privilege controls.
2. **Case Management Center** - unifies disputes, fraud, safety, appeals, recovery, privacy, payment, and support cases.
3. **Staff Action Approval Flow** - adds second-review requirements for bans, sensitive access, payouts, settlements, and staff power changes.
4. **Staff Audit Search** - makes staff actions searchable by operator, member, case, action type, date, severity, and outcome.
5. **Escalation Rules** - routes fraud, security, privacy, safety, and management issues to the correct specialist queue.
6. **Staff Performance Dashboard** - tracks workload, resolution time, overdue work, reversals, quality signals, and satisfaction.
7. **User-Facing Case Status Sync** - gives members safe case statuses without exposing staff notes or risk details.
8. **Sensitive Data Access Controls** - requires reasons, masking, and audit events before staff views sensitive user data.
9. **Staff Training / Policy Library** - centralizes policy search, playbooks, macros, versioning, and knowledge checks.
10. **Incident Command Mode** - supports major incident rooms, severity, timelines, action checklists, status updates, and postmortems.

## Files Changed

- `src/staffImprovementPacks/core-ops.js`
- `docs/staff-improvement-packs/CORE_OPS_01_10.md`

## Notes

- This is a disjoint data and documentation slice only.
- No shared app, style, smoke, routing, or existing documentation files were changed.
- The exported data is ready for later aggregation into staff controls or management dashboards.
