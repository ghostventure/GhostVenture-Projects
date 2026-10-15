# Case Support Expansion Staff Improvements 41-60

This pack defines 20 additional staff-side components, features, and functions focused on case operations, support automation, evidence, inbox routing, and member communications. It avoids duplicating the existing 1-40 staff controls by concentrating on intake quality, communication safeguards, evidence readiness, and operational follow-through.

## Improvements

41. **Case Intake Triage Wizard** - Guided routing for new reports into support, safety, fraud, privacy, payment, or account recovery paths.
42. **Duplicate Case Merge Assistant** - Suggests related cases and helps staff merge or link duplicate reports.
43. **Case Dependency Tracker** - Tracks blockers such as evidence, partner review, verification, or manager decision.
44. **Support Playbook Launcher** - Opens the right support checklist for the case type and state.
45. **Smart Evidence Request Builder** - Builds issue-specific evidence requests with deadlines and privacy-safe wording.
46. **Evidence Completeness Score** - Scores whether the case has enough evidence before closure, escalation, or account action.
47. **Attachment Redaction Helper** - Helps staff remove sensitive details before attachments are shared internally.
48. **Case Conversation Summaries** - Produces internal summaries for long threads, handoffs, and prior decisions.
49. **Member Reply Clarity Checker** - Checks outgoing messages for clarity, missing next steps, and tone issues.
50. **Outbound Message Approval Rules** - Requires review before high-risk outbound messages are sent.
51. **Priority Member Care Lane** - Routes high-impact, vulnerable, repeat, or payment-sensitive members to faster care.
52. **First Response SLA Guard** - Warns staff before new cases miss the first-response window.
53. **Case Reassignment Reason Codes** - Makes ownership changes measurable through required reason codes.
54. **Member Evidence Portal** - Gives members a structured upload and receipt flow for requested evidence.
55. **Internal Mention Routing** - Routes staff mentions from case notes into inbox work with acknowledgement tracking.
56. **Case Watchlist** - Lets staff follow sensitive cases without taking ownership away from the assignee.
57. **Customer Promise Tracker** - Tracks follow-up promises, deadlines, and completion proof.
58. **Case Outcome Reason Analytics** - Aggregates closure reasons and complaint causes for management review.
59. **Protected Member Handling** - Adds safeguards for minors, vulnerable users, threat victims, and severe harassment targets.
60. **Support Deflection Insights** - Finds repeat support topics that should become self-service or clearer help content.

## Files Changed

- `src/staffImprovementPacks/case-support-expansion.js`
- `docs/staff-improvement-packs/CASE_SUPPORT_EXPANSION_41_60.md`

## Validation

- Run `node --check src/staffImprovementPacks/case-support-expansion.js` from the FoxHub App repository root.
