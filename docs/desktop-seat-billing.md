# Desktop seat pricing and central billing

Status: implemented in the current source tree, but not live. Firebase Hosting was not published; the live `overhead-office` release remains dated 2026-10-18 14:29:05. The `billingApi` Functions deployment is blocked because Secret Manager reports the required `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` entries missing (404). Do not add secret values to documentation or source control. A read-only active Firestore check confirmed that the current `cloud.firestore` release uses ruleset `1d9927d4-efc0-458e-8ce1-417aa50ae1a9`, updated `2026-10-22T04:58:41.676674Z`; its source matches commit `00e8c6c` (Cylinder release changes). The canceled seat-billing deployment did not commit the current seat-billing rules. Production behavior also requires distributing a Desktop build containing the matching client changes. No live Stripe charge or deployed behavior is certified by this document.

## Product boundary

OverHead Desktop is priced for an individual business workspace with additional billed user seats. Cylinder is the department/server capacity for larger groups and includes its own centralized employee, Rank, and device controls. Desktop seat billing does not enable Cylinder's GPO-style management features. Cylinder has a separate entitlement and commercial activation path.

## Desktop price schedule

Each Silver, Gold, or Black Desktop subscription includes its first user at the plan's base monthly price. The price for each additional user is half the prior seat's price, rounded down to a whole dollar, with a $14.99 monthly minimum. Examples:

| Plan | Seat 1 | Seat 2 | Seat 3 | Later seats |
| --- | ---: | ---: | ---: | --- |
| Silver | $59 | $29 | $14.99 | $14.99 each |
| Gold | $129 | $64 | $32 | $16, then $14.99 each |
| Black | $299 | $149 | $74 | $37, $18, then $14.99 each |

The recurring Desktop charge is capped at $499 per month. When a new seat crosses that limit, only the remaining amount up to the cap is charged; subsequent seats do not increase the capped total. The product recommends Cylinder when the uncapped Desktop total exceeds $499. This is a pricing recommendation, not an automatic conversion or Cylinder purchase.

Cylinder is currently described at $499/month or $4,990/year and supports up to 50 users under its entitlement. The dashboard compares the Desktop seat count with both Cylinder price points. Compare annual Cylinder pricing as a separate commitment; the Desktop seat amounts above are monthly rates.

## What counts as a seat

The trusted Firebase billing service maintains the workspace seat summary and deduplicates identities by normalized email. Active non-customer workspace members, unexpired invitations, and reserved Desktop-only staff seats count. Customer-role records and Cylinder-managed users are excluded. Suspending or releasing a member removes that identity from the active billable set; reactivation is repriced at its current seat position. The billing service then updates the recurring seat amount for a later invoice.

Workspace invitations and Desktop-only staff creation reserve seats through the same central service. Desktop staff records are local to that installation, so creating a new one requires internet access and a verified shared OverHead account with Owner authority. Once provisioned, existing Desktop accounts and local data remain usable offline. On shared-account sign-in, the client attempts to register eligible existing local staff seats centrally; unresolved reservations are surfaced for follow-up.

Seat changes update recurring billing without prorating the current period. A new or changed amount is scheduled for the next subscription invoice. Checkout prices the current eligible seat count under the selected tier and includes a recurring monthly seat-overage line when needed.

## First month and the existing Gold trial

The first paid checkout receives a 30-day Stripe trial, so the first paid month is free. It is available only when the workspace has not consumed the existing 90-day no-card Gold trial and has not already used the first-paid-month offer. The offers do not stack: an active 90-day Gold trial must end before paid checkout, and a consumed Gold trial does not create another 30-day free period. Later subscriptions do not receive this offer again.

## Source of truth and verification

The shared schedule is in `functions/seat-pricing.cjs`; the billing endpoint in `functions/index.js` owns seat reservations, membership status changes, checkout totals, and recurring Stripe updates. Website pricing guidance lives in `website-next/app/data.js` and the workspace dashboard. The Desktop sends seat reservation and migration requests through its authenticated billing API.

Before describing this workflow as live, configure the required Stripe secrets in Firebase Secret Manager, deploy the current Firestore seat-billing rules, deploy the Functions and website, confirm the required Stripe monthly plan Price IDs, and run test-mode cases for checkout, trial exclusion, seat invitation, local-seat reservation, suspension/reactivation, duplicate email, cap behavior, and webhook retries. Separately build and install the updated Desktop package to verify its shared-auth seat path. Record actual Firebase deployment and Stripe test evidence in the release handoff; source changes alone do not update installed clients or public billing behavior.
