# Plugz Dashboard deployment handoff — 2026-11-04

## Current state

- Firebase project: `plugz-untd-gear`.
- The new `getCustomerOrderPage` callable was deployed successfully as a Gen 2 Node.js 22 function in `us-east4`.
- `updateCustomerAccountSettings` was also deployed successfully as a Gen 2 Node.js 22 function in `us-east4`. It saves the allowed profile fields, three communication preferences, and up to five addresses in one authenticated transaction, then records counts without address values in the audit event.
- Firebase Functions inventory confirms both new callables alongside the existing functions. Each deployment targeted only its named callable; no other Functions were selected.
- The Firestore composite index for `orders` (`customerUid` ascending, `createdAt` descending) is `READY`.
- The static app was deployed to the newly created Firebase Hosting site `plugz-dashboard-capacity` at `https://plugz-dashboard-capacity.web.app`.
- `/`, `/dashboard/`, and `/account/settings/` returned HTTP 200 after deployment.
- The local `/dashboard` route returned HTTP 200 before the deployment. Authenticated sign-in, account saves, and order loading have not been exercised.
- No Firestore rules or Storage rules were deployed. The main Hosting site `plugz-untd-gear` and its existing Dashboard frontend remain unchanged.

## Source and release boundary

This standalone setup was reconstructed from Firebase deployment artifacts. The original Next.js Dashboard source and source maps were not recovered. The new frontend implements the account settings and paginated order-history flows; it is not a complete copy of the storefront or the original Dashboard source.

The project targets a separate Hosting site and does not replace the storefront. Keep future deploys pinned to `plugz-dashboard-capacity`.

## Resume steps

1. From `plugz-untd-gear/dashboard-capacity`, confirm the order index remains `READY`:

   ```sh
   npx firebase-tools firestore:indexes --project plugz-untd-gear --pretty
   ```

2. Run the local app with `npm run dev`. Review `/dashboard` and `/account/settings` with an authorized test account.
3. Verify profile and preference updates, address add/edit/remove, verification email, password reset, account-data export, and order paging. Confirm unauthenticated settings writes are rejected and data remains scoped to the signed-in customer.
4. Before any future Hosting changes, review routes, redirects, Firebase Auth authorized domains, and the active target. Do not switch the Hosting site to `plugz-untd-gear` without a separate storefront integration plan.
5. Recheck the project and Hosting site explicitly before changes. The successful targeted deploy commands were:

   ```sh
   npx firebase-tools deploy --only functions:getCustomerOrderPage --project plugz-untd-gear
   npx firebase-tools deploy --only functions:updateCustomerAccountSettings --project plugz-untd-gear
   npx firebase-tools deploy --only firestore:indexes --project plugz-untd-gear
   npm run build
   npx firebase-tools deploy --only hosting --project plugz-untd-gear
   ```

   Do not redeploy rules or Storage as part of this Dashboard change unless separately reviewed and intended.

## Verification limits

- `node --check functions/index.js` passed before deployment.
- Firebase reported successful create operations, and `functions:list` showed both new callables in `us-east4` on Node.js 22.
- Index deployment succeeded and the latest status is `READY`.
- `npm run build` completed with static routes `/`, `/dashboard`, and `/account/settings`.
- The deployed `/`, `/dashboard/`, and `/account/settings/` routes returned HTTP 200. Authenticated sign-in, callable use from the hosted domain, and order workflows were not exercised.
- No application tests were run.
