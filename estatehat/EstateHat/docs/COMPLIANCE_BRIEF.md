# EstateHat Compliance Brief (Operator View)

Last updated: 2026-04-11

## What we enforce as the strict baseline

1. No unlicensed activity: EstateHat cannot operate as an unlicensed broker, settlement service, money transmitter, or creditor.
2. Fair housing first: no discriminatory workflows, ads, screening, or decisions.
3. Privacy and breach readiness: safeguards + documented incident response and notice timelines.
4. Verifiable consent: policy/e-sign/marketing consent must be auditable and reproducible.
5. Jurisdiction-aware documents: recording and filing requirements must match state + county/city.

## In-product controls already implemented

- legal verification requires evidence type, reference ID, attestation, and timestamp
- legal hold can freeze sensitive operational states
- compliance profile tracks jurisdiction, legal hold, incident posture, policy versions, and audit trail
- Firestore rules enforce compliance schema and activation risk gates server-side

## What still requires legal/ops completion

1. Attorney sign-off matrix per launch jurisdiction.
2. Written legal-hold/subpoena runbook and chain-of-custody export process.
3. State/local breach-notice timer matrix tied to incident workflows.
4. Marketing consent logging with versioned disclosure text and revocation trails.
5. Vendor legal package for escrow/title/payment/identity partners.

## Attorney footnotes

All primary citations and jurisdiction references are maintained in:

- `docs/COMPLIANCE_MATRIX_2026-04-11.md`
- `docs/US51_AGGREGATION_2026-04-11.md`
- `docs/COUNTY_PRIORITY_REGISTRY_2026-04-11.md`
- `docs/ASSISTANT_COMPLIANCE_INDEX.md`

Use that file for statute-level and regulator-level source review.
