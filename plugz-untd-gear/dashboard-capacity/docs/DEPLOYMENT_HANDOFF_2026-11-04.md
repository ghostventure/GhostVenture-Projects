# Plugz Dashboard deployment handoff — 2026-11-04

## Current state

- Firebase project: `plugz-untd-gear`.
- The new `getCustomerOrderPage` callable was deployed successfully as a Gen 2 Node.js 22 function in `us-east4`.
- Firebase Functions inventory confirmed `getCustomerOrderPage` alongside the existing functions. Deployment targeted only this callable; no other Functions were selected for deployment.
- The Firestore composite index for `orders` (`customerUid` ascending, `createdAt` descending) was deployed. Its latest status is `CREATING`; wait until it reports `READY` before treating live order paging as available.
- The standalone local Next.js `/dashboard` route returned HTTP 200. Authenticated sign-in and order loading were not exercised.
- No Hosting, Firestore rules, or Storage rules were deployed. The live storefront and its existing Dashboard frontend remain unchanged.

## Source and release boundary

This standalone setup was reconstructed from Firebase deployment artifacts. The original Next.js Dashboard source and source maps were not recovered. The new frontend implements the account and paginated order-history flow; it is not a complete copy of the storefront or the original Dashboard source.

The local project intentionally has no Firebase Hosting target. Do not deploy it as a standalone Hosting replacement for the storefront.

## Resume steps

1. From `plugz-untd-gear/dashboard-capacity`, check the index until it reports `READY`:

   ```sh
   npx firebase-tools firestore:indexes --project plugz-untd-gear --pretty
   ```

2. Run the local app with `npm run dev` and open `http://localhost:3000/dashboard`.
3. Using an authorized test account, verify sign-in and the callable's first page, filters, load-more cursor, empty state, and retry behavior. Confirm unauthenticated requests are rejected and results are scoped to the signed-in customer.
4. Before any Hosting rollout, decide how to integrate the reconstructed Dashboard without replacing the existing storefront. Review routes, redirects, Firebase Auth authorized domains, and the active Hosting configuration first.
5. Recheck the project explicitly before backend changes. The successful targeted deploy commands were:

   ```sh
   npx firebase-tools deploy --only functions:getCustomerOrderPage --project plugz-untd-gear
   npx firebase-tools deploy --only firestore:indexes --project plugz-untd-gear
   ```

   Do not redeploy rules or Storage as part of this Dashboard change unless separately reviewed and intended.

## Verification limits

- `node --check functions/index.js` passed before deployment.
- Firebase reported a successful create operation, and `functions:list` showed the new function in `us-east4` on Node.js 22.
- Index deployment succeeded, but the latest status remains `CREATING`.
- The local `/dashboard` route returned HTTP 200. No application tests, production build, authenticated callable check, or end-to-end order workflow was run.
