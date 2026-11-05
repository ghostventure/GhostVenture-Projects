# Plugz Dashboard source setup

This is a new, standalone Next.js setup assembled on 2026-11-04 from the Firebase deployment recovery. It is a maintainable reconstruction, not the missing original Plugz Git checkout.

## What is included

- Customer account dashboard with the live site's email/password sign-in, account creation, password reset, profile summary, saved-piece count, preference status, and links to existing storefront account/support routes.
- Paginated order history with test/production filters, cursor-based load-more, explicit loading/error/retry/empty states, and accessible status announcements.
- `getCustomerOrderPage` callable in `functions/index.js`, which returns at most 20 customer-scoped orders and excludes unnecessary/private fields from the response.
- Active Firestore and Storage rule snapshots and the required customer-order composite index.
- Recovered deployed backend baseline; compiled reference assets remain in the sibling recovery folder.

The original Next.js frontend source and source maps were not present in the deployment. This new app reconstructs the customer Dashboard flow; it does not reproduce every route or the storefront.

## Local setup

Use Node.js 22 or later. Install dependencies with `npm ci`. Copy `.env.example` to `.env.local` and fill the six `NEXT_PUBLIC_FIREBASE_*` values from the Firebase Web app configuration for `plugz-untd-gear`. These are public client configuration values; do not place service account credentials or Secret Manager values in this app.

Start the local app with `npm run dev`, then open `http://localhost:3000/dashboard`. Email/password Authentication must be enabled for the Firebase project, and the current hostname must be an authorized Authentication domain. The order page calls `getCustomerOrderPage`; the candidate callable and its Firestore index must be deployed before order data will load from the live project.

## Firebase deployment boundaries

`firebase.json` defines only Cloud Functions, Firestore rules/indexes, and Storage rules. It contains no Hosting target or Hosting configuration. The source project cannot deploy or overwrite the live storefront's Hosting build. For a targeted backend rollout, review the code, secrets, index status, account, and project, then deploy only the new callable and Firestore index with the intended project explicitly selected. No production deployment has been made from this setup.

The existing production Dashboard remains unchanged until this reconstructed app is integrated into a deliberate Hosting rollout. Do not deploy this app to `plugz-untd-gear` Hosting as a standalone replacement for the full site.
