# Workflow Intel Staff Improvements 11-20

This slice adds a disjoint staff improvement pack for workflow, collaboration, case intelligence, risk explanation, appeal quality, and staff permission governance.

## Improvements

11. Staff Inbox - centralizes assigned cases, mentions, approvals, escalations, and overdue work.
12. Shift Handoff Notes - gives operators a structured way to pass open incidents, risky accounts, appeals, and payment holds to the next shift.
13. Internal Staff Chat - keeps staff-only case discussion attached to users, disputes, incidents, and policy decisions.
14. Saved Views - lets staff reuse queue filters for high-risk fraud, overdue appeals, recovery, and payment disputes.
15. Bulk Actions - supports low-risk queue changes across multiple cases with preview, scope limits, and audit confirmation.
16. Evidence Locker - stores case evidence with labels, restricted access, and chain-of-custody expectations.
17. Member Timeline View - gives staff a chronological, reason-gated account history for support, recovery, and pattern review.
18. Risk Reason Explainer - shows staff why a user or case was flagged without exposing sensitive risk signals to users.
19. Appeal Quality Review - tracks whether staff decisions are upheld, reversed, or need coaching after appeal review.
20. Staff Permission Change Log - records staff invites, role changes, admin grants, revocations, and scope edits.

## Files Changed

- `src/staffImprovementPacks/workflow-intel.js`
- `docs/staff-improvement-packs/WORKFLOW_INTEL_11_20.md`

## Notes

- This pack is data and documentation only.
- No shared runtime files, styles, smoke scripts, or existing docs were edited.
- Sensitive controls in this slice are marked with `requiresApproval: true` where staff access, evidence, bulk changes, risk signals, or permission changes can create operational risk.
