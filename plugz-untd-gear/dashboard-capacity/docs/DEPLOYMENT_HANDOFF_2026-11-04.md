# Plugz Dashboard deployment handoff — 2026-11-04

## Current state

- Firebase project: `plugz-untd-gear`.
- The new `getCustomerOrderPage` callable was deployed successfully as a Gen 2 Node.js 22 function in `us-east4`.
- `updateCustomerAccountSettings` was also deployed successfully as a Gen 2 Node.js 22 function in `us-east4`. It saves the allowed profile fields, three communication preferences, and up to five addresses in one authenticated transaction, then records counts without address values in the audit event.
- Firebase Functions inventory confirms both new callables alongside the existing functions. Each deployment targeted only its named callable; no other Functions were selected.
- The Firestore composite index for `orders` (`customerUid` ascending, `createdAt` descending) is `READY`.
- The standalone local Next.js `/dashboard` route returned HTTP 200. Authenticated sign-in and order loading were not exercised.
- The `/account/settings` route is part of the source, but its route and authenticated workflows have not been exercised.
- No Hosting, Firestore rules, or Storage rules were deployed. The live storefront and its existing Dashboard frontend remain unchanged.

## Source and release boundary

This standalone setup was reconstructed from Firebase deployment artifacts. The original Next.js Dashboard source and source maps were not recovered. The new frontend implements the account settings and paginated order-history flows; it is not a complete copy of the storefront or the original Dashboard source.

The local project intentionally has no Firebase Hosting target. Do not deploy it as a standalone Hosting replacement for the storefront.

## Resume steps

1. From `plugz-untd-gear/dashboard-capacity`, confirm the order index remains `READY`:

   ```sh
   npx firebase-tools firestore:indexes --project plugz-untd-gear --pretty
   ```

2. Run the local app with `npm run dev`. Review `/dashboard` and `/account/settings` with an authorized test account.
3. Verify profile and preference updates, address add/edit/remove, verification email, password reset, account-data export, and order paging. Confirm unauthenticated settings writes are rejected and data remains scoped to the signed-in customer.
4. Before any Hosting rollout, decide how to integrate the reconstructed Dashboard without replacing the existing storefront. Review routes, redirects, Firebase Auth authorized domains, and the active Hosting configuration first.
5. Recheck the project explicitly before backend changes. The successful targeted deploy commands were:

   ```sh
   npx firebase-tools deploy --only functions:getCustomerOrderPage --project plugz-untd-gear
   npx firebase-tools deploy --only functions:updateCustomerAccountSettings --project plugz-untd-gear
   npx firebase-tools deploy --only firestore:indexes --project plugz-untd-gear
   ```

   Do not redeploy rules or Storage as part of this Dashboard change unless separately reviewed and intended.

## Verification limits

- `node --check functions/index.js` passed before deployment.
- Firebase reported successful create operations, and `functions:list` showed both new callables in `us-east4` on Node.js 22.
- Index deployment succeeded and the latest status is `READY`.
- The local `/dashboard` route returned HTTP 200 before the account-settings expansion. No application tests, production build, authenticated callable checks, or end-to-end workflows were run for these account settings changes.
