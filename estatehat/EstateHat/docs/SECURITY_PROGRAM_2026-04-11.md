# Security Program Baseline (2026-04-11)

Owner: Security Lead / Engineering  
Scope: Web, Firebase services, supporting infrastructure

## 1) Penetration Testing Cadence

- External penetration test: at least annually.
- Targeted retest: after critical/high findings are fixed.
- Triggered test: before major auth/compliance architecture changes.

Deliverables:
- Findings report with severity and evidence.
- Remediation plan with owner and due date.
- Closure evidence for each critical/high issue.

## 2) Dependency and Supply Chain Hygiene

- `npm audit --production` at least weekly and before release.
- Critical vulnerabilities: block release until fixed or formally accepted with compensating controls.
- Lockfile updates tracked in PR with risk notes.

## 3) Secrets and Credentials Rotation

- Firebase/service credentials rotated every 90 days or on incident.
- No secrets in client bundle beyond expected public config keys.
- Access keys scoped to least privilege.

## 4) Incident Response Runbook

Severity bands:
- `SEV-1`: active compromise/data exposure
- `SEV-2`: major security degradation
- `SEV-3`: moderate issue/no confirmed compromise

Response steps:
1. Detect and triage.
2. Contain impact (disable affected paths, revoke credentials).
3. Investigate scope and root cause.
4. Eradicate and recover.
5. Post-incident report with prevention actions.

## 5) Minimum Technical Controls

- Firestore rules deny-by-default and least privilege by role.
- Role-restricted GUI + route gating.
- Logging for compliance-sensitive state changes.
- Periodic access review for admin/government profiles.
