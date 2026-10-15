# Complaint-Zero Controls - 2026-06-11

## Summary

Installed the eight complaint-prevention categories into FoxHub as member controls and staff operations controls.

## Installed categories

- Feed Control
- Commercial Boundaries
- Safety and Moderation
- Trust and Anti-Spam
- Privacy and Account Control
- Attention and Notification Health
- Support and Dispute Resolution
- Product Guardrails

## Member controls

Members now see `Complaint prevention controls` in Account controls. The controls route users to feed, commerce, profile/privacy, notification, support, safety, spam/scam, and product-concern actions.

## Staff controls

Management now includes:

- `Complaint-zero dashboard`
- `Complaint-zero staff controls`
- category counts for the eight complaint sources
- staff actions for feed review, commerce boundary audit, moderation appeal sweep, spam/scam sweep, privacy review, notification health, support SLA review, and product drift review

## Files changed

- `src/FoxHubShell.jsx`
- `src/styles.css`
- `scripts/release-smoke.mjs`
- `docs/COMPLAINT_ZERO_CONTROLS_2026-06-11.md`
- `docs/DOCS_INDEX.md`
- `docs/PROJECT_STATUS.md`
- `docs/CURRENT_HANDOFF_2026-05-31.md`

## Verification

Completed:

- `npm run release:check` (pass)
- `npm run deploy:hosting` (pass)
- live `/management` HTTP 200
- live `/assets/FoxHubShell-BV8FXhEA.js` HTTP 200
- live `/assets/index-BznudTYY.css` HTTP 200
- live Hosting `Last-Modified`: `Thu, 11 Jun 2026 13:00:09 GMT`

Release smoke now verifies:

- `Complaint prevention controls`
- `Feed Control`
- `Commercial Boundaries`
- `Safety and Moderation`
- `Trust and Anti-Spam`
- `Privacy and Account Control`
- `Attention and Notification Health`
- `Support and Dispute Resolution`
- `Product Guardrails`
- `Complaint-zero dashboard`
- `Complaint-zero staff controls`
