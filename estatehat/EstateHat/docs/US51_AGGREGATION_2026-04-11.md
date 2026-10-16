# EstateHat US-51 Aggregation (Operational Baseline)

Last updated: 2026-04-11

## Goal

Create one strict operational compliance baseline that can be used across all 50 states + DC, while flagging outlier jurisdictions for attorney review.

Territory addendum:

- Puerto Rico (`PR`), Guam (`GU`), and U.S. Virgin Islands (`VI`) are treated as automatic outlier jurisdictions requiring counsel review before sensitive activation.

## Aggregated finding

Across U.S. jurisdictions relevant to EstateHat's scope, the law families are broadly similar:

1. Real-estate licensing boundary (do not perform licensed brokerage activity without proper licensure).
2. Housing anti-discrimination obligations (federal + state/local expansions).
3. Data security + breach notification duties.
4. Electronic record/signature enforceability rules.
5. Money-transmission licensing boundary (if directly receiving/transmitting funds).
6. Marketing outreach consent and suppression requirements (email/SMS/call).

## Standout outlier classes

These are not unique to one jurisdiction, but they are materially stricter in practice and should trigger counsel review:

- Privacy outlier states (comprehensive consumer privacy regimes or expanded enforcement posture).
- Marketing-consent outlier states (stricter telemarketing/text consent litigation environment).
- Fair-housing outlier localities (expanded protected classes, including source-of-income in many places).
- Recording/document-processing outlier counties/cities (stricter filing standards, local forms, and transfer-tax workflows).

## EstateHat implementation status (this repo)

Implemented in code:

1. `strict_us_51` baseline profile in compliance regulatory controls.
2. Server-side outlier flags in profile compliance state:
   - `territoryOutlier`
   - `privacyOutlier`
   - `marketingOutlier`
   - `fairHousingOutlier`
   - `recordingOutlier`
   - `federalOutlier`
   - `counselReviewRequired`
3. Stronger legal components required for sensitive activation:
   - electronic records consent
   - non-brokerage acknowledgment
   - fair-housing attestation
   - support scope attestation
   - marketing consent attestation
4. Marketing consent now requires auditable metadata when opted in.
5. Support packet snapshot added to compliance model for support/legal handoff.

## Federal-level standouts reflected in controls

- Fair Housing Act and anti-discrimination baseline controls.
- CFPB/RESPA boundary controls in settlement-service positioning.
- OFAC/AML posture through sanctions/AML legal components.
- E-SIGN alignment through electronic records consent requirement.

## County/city-level standouts reflected in controls

- Local fair-housing and source-of-income risk is explicitly surfaced via outlier flags.
- Local recording complexity is surfaced via recording outlier flag and support packet narrative.

## Residual legal requirement

This is an operational engineering baseline, not a legal opinion.

Before launch in any specific jurisdiction, retained counsel should sign off on:

1. state-level matrix entry,
2. county/city/borough/parish local overlays,
3. support/subpoena/legal-hold workflow,
4. incident/breach timeline mapping,
5. marketing consent language and record design.
