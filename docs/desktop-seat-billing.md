# Desktop seat pricing and central billing

**Production status, checked 2026-10-22: not live.** Website, Desktop 0.3.24, Cylinder Server 0.3.24, and Cylinder Client 0.3.24 share Firebase Authentication and the `overhead-office` Firestore workspace profile. The website and Desktop read the same entitlement and member-license paths described in [Shared identity and plan entitlements](shared-identity-and-entitlements.md). Desktop refreshes these values at sign-in and every five minutes during a signed-in standard staff session. Firebase currently deploys `trialApi`, `expireTrials`, and `cylinderApi`; `billingApi` is absent (live endpoint returned HTTP 404). Therefore paid checkout, subscription changes, seat reservation/charges, and related paid-license writes are unavailable. The Stripe billing code and seat schedule described below are the intended implementation, not active production behavior. No paid transaction was performed for this audit.

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

**Intended behavior after `billingApi` deployment:** the trusted Firebase billing service maintains the workspace seat summary and deduplicates identities by normalized email. Active non-customer workspace members, unexpired invitations, and reserved Desktop-only staff seats count. Customer-role records and Cylinder-managed users are excluded. Suspending or releasing a member removes that identity from the active billable set; reactivation is repriced at its current seat position. The billing service then updates the recurring seat amount for a later invoice. These seat writes are not currently available in production.

The planned workflow has workspace invitations and Desktop-only staff creation reserve seats through the same central service. Desktop staff records are local to that installation, so a future central reservation requires internet access and a verified shared OverHead account with Owner authority. This reservation path currently returns an unavailable-function response because `billingApi` is not deployed. Local data and previously cached accounts remain subject to Desktop's local/offline behavior; a local staff seat is not evidence of a centrally billed license.

The proposed seat changes update recurring billing without prorating the current period. A new or changed amount is scheduled for the next subscription invoice. Checkout prices the current eligible seat count under the selected tier and includes a recurring monthly seat-overage line when needed. These paid operations are not enabled until the production `billingApi` and Stripe configuration are deployed and verified.

## First month and the existing Gold trial

**Proposed paid checkout behavior, not live:** the first paid checkout receives a 30-day Stripe trial, so the first paid month is free. It is available only when the workspace has not consumed the existing 90-day no-card Gold trial and has not already used the first-paid-month offer. The offers do not stack: an active 90-day Gold trial must end before paid checkout, and a consumed Gold trial does not create another 30-day free period. Later subscriptions do not receive this offer again. The currently deployed Gold trial is the separate 90-day no-card trial.

## Source of truth and verification

The proposed shared schedule is in `functions/seat-pricing.cjs`; the source billing endpoint in `functions/index.js` owns seat reservations, membership status changes, checkout totals, and recurring Stripe updates. Website pricing guidance lives in `website-next/app/data.js` and the workspace dashboard. The Desktop client contains authenticated seat-reservation and entitlement-refresh paths. Only entitlement reads and the 90-day no-card trial are available through the currently deployed service; paid and seat-write operations must not be treated as active.

Before describing this workflow as live, configure Stripe secrets in Firebase Secret Manager, deploy and verify `billingApi` and the current Firestore seat-billing rules, confirm the Stripe monthly plan Price IDs, and run test-mode checkout, trial exclusion, seat invitation, local-seat reservation, suspension/reactivation, duplicate-email, cap, and webhook-retry cases. The currently installed Desktop 0.3.24 already reads shared entitlement and license records; verify it again after the paid backend is deployed. Record live Firebase deployment and Stripe test evidence in the release handoff. Never put secret values in documentation or source control.
