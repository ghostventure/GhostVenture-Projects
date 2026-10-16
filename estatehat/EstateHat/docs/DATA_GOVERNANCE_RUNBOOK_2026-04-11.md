# Data Governance Runbook (2026-04-11)

Owner: Privacy + Compliance + Engineering

## 1) Retention and Deletion Automation

Required retained data classes:
- Transaction records: per policy retention window.
- Legal/audit evidence: per legal retention obligations.
- Security logs: per security monitoring policy.

Operational rules:
- Automated purge job for expired records.
- Legal hold flag overrides purge schedule.
- Deletion requests logged with timestamp, requestor, resolution status.

## 2) Legal Hold SOP

Trigger events:
- Litigation notice
- Regulatory inquiry
- Subpoena/preservation request

Steps:
1. Compliance marks legal hold as active.
2. Purge/cleanup routines excluded for hold scope.
3. All hold actions logged (who, when, scope, reason).
4. Hold release requires documented counsel approval.

## 3) Audit Log Export Policy

- Support packet and compliance logs exportable for counsel/regulator review.
- Export request requires authorized requester and reason code.
- Export artifacts stored with checksum and access log.

## 4) Access Governance

- Quarterly review of privileged roles (`admin`, `webmaster`, government profiles).
- Remove stale elevated access within 24 hours of role change/offboarding.
