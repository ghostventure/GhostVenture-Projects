# Assistant Compliance Index

Last updated: 2026-04-11

Use this index for support, compliance review, and legal-response preparation.

## Primary docs

- `docs/COMPLIANCE_BRIEF.md` : operator quick view.
- `docs/COMPLIANCE_MATRIX_2026-04-11.md` : statute/regulator source matrix.
- `docs/US51_AGGREGATION_2026-04-11.md` : 50-state + DC aggregation and outlier model.
- Territory overlays included: `PR`, `GU`, `VI` (automatic outlier escalation).
- `docs/COUNTY_PRIORITY_REGISTRY_2026-04-11.md` : strongest counties first + similarity roll-down.
- `docs/data/county_priority_registry.json` : machine-readable county tier registry.

## Code enforcement points

- `src/backend.js`
  - schema versioning
  - legal component normalization
  - jurisdiction outlier flags
  - support packet state
  - marketing consent metadata hardening
- `firestore.rules`
  - legal/compliance schema validation
  - marketing consent enforcement
  - legal hold and activation risk gates
  - support packet consistency requirements
- `src/estatehat-platform-alpha.jsx`
  - required legal component UX
  - compliance control panel
  - outlier flag visibility
  - support packet generation action
  - transaction-time jurisdiction sync from listing submit and buyer offer flows
  - compliance attestation/acknowledgment templates with city/state/county/municipality fill-ins

## Support handoff fields (profile)

Assistant should read these profile paths first:

1. `compliance.jurisdiction`
2. `compliance.regulatoryProfile`
3. `compliance.outlierFlags`
4. `compliance.supportPacket`
5. `compliance.legalHold`
6. `legal.components`
7. `userDatabase.marketingOptIn` + marketing consent fields

## Notes

- This package is an engineering compliance framework and audit aid.
- It does not replace retained counsel advice for a specific jurisdictional dispute.
