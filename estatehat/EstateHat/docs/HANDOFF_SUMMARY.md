# EstateHat Handoff Summary

Last updated: 2026-04-13

## What is live now

- Production web app is live at `https://estatehat.web.app`.
- Authentication is required (demo/guest access removed).
- Default post-login landing page is `Hat Board`.
- Core navigation includes profile, listing discovery, transactions, messaging, legal pages, and FAQ scope.
- New GUI workspaces are live for search, notifications, document vault, offer drafting, tour scheduling, property comparison, transaction timeline, and admin workbench.

## Product state at handoff

- UI direction: lean, simple, premium styling.
- UI direction refreshed toward a more current neutral interface with tighter controls, simpler nav, and less decorative background treatment.
- Assistant-first guidance is active for less-technical users.
- "Common Forms" naming is live, alongside the Hat Data and Goodies surface labels.
- Verified User badge flow is installed (`$20/month` UI model) with gating:
  - profile completion
  - verification readiness
  - legal component readiness
- User/customer database controls are available in profile.
- Government role profiles are installed:
  - township, city, county, borough, parish, state, federal
- Payout and verified-billing frameworks are modeled in user profile state.
- US-51 strict compliance baseline is active with state/local outlier flags.
- Support packet snapshot workflow is available in profile compliance controls.
- Marketing opt-in now requires consent metadata plus legal component attestation.

## Legal and trust state

- Company references updated to **EstateHat LLC**.
- Legal pages are in-app:
  - Terms
  - Privacy
  - Accessibility
  - DMCA
- FAQ scope page is installed and linked from:
  - Help Center
  - command palette
  - footer legal/company sections

## Technical state

- Stack: React + Vite + Firebase Auth + Firestore + Firebase Hosting.
- Firestore user profile schema version: `12`.
- Core user-profile managed fields include:
  - identity/contact
  - security
  - verification
  - trust
  - legal
  - compliance
  - userDatabase
  - payoutFramework
  - verifiedBilling
    - referralIncentive

## Deployment status

- Build command: `npm run build` (passing).
- Test command: `npm test` (passing).
- Deploy command: `npm run deploy:hosting` (latest deploy successful on 2026-04-13).
- Mock-like transaction/admin/professional-match rows have been removed from visible mechanics; affected surfaces now show empty connected states until live backend feeds exist.

## Immediate operating priorities

- Validate all legal copy with counsel before external scaling.
- Connect live billing/payout processors for production money movement.
- Connect real transaction, admin queue, document-review, compliance flag, and professional matching feeds.
- Finalize policy enforcement and support SOPs for trust/safety events.
- Establish KPI dashboard and investor reporting cadence.

## Reference docs

- `docs/PLATFORM_DOCUMENTATION.md`
- `docs/PROJECT_STATUS.md`
- `docs/OPERATIONS.md`
- `docs/US51_AGGREGATION_2026-04-11.md`
- `docs/ASSISTANT_COMPLIANCE_INDEX.md`
- `docs/GUI_MECHANICS_RELEASE_2026-04-13.md`
