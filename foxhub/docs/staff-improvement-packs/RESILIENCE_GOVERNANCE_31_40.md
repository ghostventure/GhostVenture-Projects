# Resilience Governance Staff Improvements 31-40

This pack defines the resilience and governance slice for FoxHub staff-side improvements. It is intentionally data/doc only so it can be integrated without touching shared application files.

## Improvements

31. Staff Workload Balancing - balances queue ownership, staff capacity, overdue work, and backup assignment.
32. Case Reopen Flow - lets staff or members reopen closed cases when new evidence or failed resolution appears.
33. Sensitive Action Simulator - previews high-impact actions before execution and routes risky actions for approval.
34. Compliance Export - packages audit, privacy, dispute, safety, and payment records for compliance review.
35. Staff Knowledge Checks - gates sensitive permissions behind policy, privacy, security, or payment checks.
36. Fraud Ring Graph - maps linked accounts, devices, payment methods, invite chains, reports, and transactions.
37. Moderation Consistency Checker - compares similar moderation cases and flags inconsistent outcomes.
38. Staff Availability / On-Call - shows coverage, escalation contacts, availability, and on-call gaps.
39. Emergency Lockdown - freezes sensitive actions during security, fraud, payout, or harmful content incidents.
40. Staff Feedback Loop - captures staff feedback on tooling, policy gaps, workflow friction, and repeated complaints.

## Files Changed

- `src/staffImprovementPacks/resilience-governance.js`
- `docs/staff-improvement-packs/RESILIENCE_GOVERNANCE_31_40.md`

## Integration Notes

- The exported array is `resilienceGovernanceStaffImprovements`.
- Each item uses the shared pack schema: `id`, `title`, `category`, `priority`, `owner`, `riskLevel`, `description`, `controls`, `queues`, `metrics`, `staffActions`, `userVisibleStatus`, and `requiresApproval`.
- Approval-required items are reserved for high-risk governance actions such as sensitive action simulation, compliance exports, fraud ring enforcement, and emergency lockdown.
