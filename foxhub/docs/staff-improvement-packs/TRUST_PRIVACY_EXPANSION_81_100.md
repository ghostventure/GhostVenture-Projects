# Trust Privacy Expansion Staff Improvements 81-100

This pack defines the trust, safety, moderation, privacy, legal, youth safety, harassment, threat, content review, and community integrity expansion slice for FoxHub staff-side improvements. It is intentionally data/doc only so it can be integrated without touching shared application files.

## Improvements

81. Threat Triage Console - prioritizes violent threats, self-harm signals, doxxing, extortion, and credible harassment reports.
82. Harassment Pattern Review - connects repeated unwanted contact, dogpiling, coded abuse, and targeted campaigns across surfaces.
83. Youth Safety Review - routes possible minor safety issues, grooming indicators, and youth privacy concerns into protected review.
84. Age Assurance Review - supports age-related checks with minimized identity data and restricted reviewer access.
85. Content Severity Classifier - classifies reported content by harm type, severity, exposure, and policy area.
86. Harmful Recommendation Review - investigates feeds, search, suggestions, or notifications that promoted harmful content.
87. Privacy Request Intake - centralizes access, deletion, correction, export, objection, and restriction requests.
88. Legal Request Tracker - tracks subpoenas, preservation requests, emergency disclosures, takedowns, and law-enforcement correspondence.
89. Evidence Preservation Hold - preserves relevant records for legal, safety, or fraud review with restricted access.
90. Data Minimization Review - checks whether staff workflows collect, expose, retain, or export only what is needed.
91. Moderator Queue Calibration - aligns moderators through sampled decisions, calibration cases, and disagreement tracking.
92. Community Integrity Sweep - finds coordinated manipulation, brigading, mass reporting, fake engagement, and disruption patterns.
93. Protected Class Abuse Review - routes hate, identity-based harassment, and targeted protected-class abuse to trained reviewers.
94. Doxxing and Personal Data Exposure - handles exposed addresses, phone numbers, IDs, workplace details, and other personal data.
95. Intimate Content Safety - prioritizes non-consensual intimate content, sextortion, sexual harassment, and sensitive media reports.
96. Content Policy Exception Review - reviews edge cases involving newsworthiness, public interest, satire, documentation, or education.
97. Appeal Evidence Redaction - protects reporter identity, staff notes, third-party data, and sensitive signals in appeal summaries.
98. Safety Resource Referral - lets staff send safe support resources for crisis, harassment, abuse, compromise, or scam situations.
99. Reporter Retaliation Monitor - monitors whether users who report abuse face retaliation through messages, mentions, or false reports.
100. Transparency Report Builder - aggregates privacy, legal, moderation, safety, and enforcement metrics for public-safe reporting.

## Files Changed

- `src/staffImprovementPacks/trust-privacy-expansion.js`
- `docs/staff-improvement-packs/TRUST_PRIVACY_EXPANSION_81_100.md`

## Integration Notes

- The exported array is `trustPrivacyExpansionStaffImprovements`.
- Each item uses the shared pack schema: `id`, `title`, `category`, `priority`, `owner`, `riskLevel`, `description`, `controls`, `queues`, `metrics`, `staffActions`, `userVisibleStatus`, and `requiresApproval`.
- Approval-required items are reserved for critical youth safety, legal, privacy, emergency removal, personal data exposure, and public reporting workflows.
