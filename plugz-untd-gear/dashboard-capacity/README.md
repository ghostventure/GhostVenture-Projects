# Plugz Dashboard source setup

This is a new, standalone Next.js setup assembled on 2026-11-04 from the Firebase deployment recovery. It is a maintainable reconstruction, not the missing original Plugz Git checkout.

## What is included

- Customer account dashboard with the live site's email/password sign-in, account creation, password reset, profile summary, saved-piece count, preference status, and links to existing storefront account/support routes.
- Paginated order history with test/production filters, cursor-based load-more, explicit loading/error/retry/empty states, and accessible status announcements.
- `getCustomerOrderPage` callable in `functions/index.js`, which returns at most 20 customer-scoped orders and excludes unnecessary/private fields from the response.
- Active Firestore and Storage rule snapshots and the required customer-order composite index.
- Recovered deployed backend baseline. Compiled reference assets are kept in the local recovery artifacts and are excluded from this source project.

The original Next.js frontend source and source maps were not present in the deployment. This new app reconstructs the customer Dashboard flow; it does not reproduce every route or the storefront.

## Local setup

Use Node.js 22 or later. Install dependencies with `npm ci`. Copy `.env.example` to `.env.local` and fill the six `NEXT_PUBLIC_FIREBASE_*` values from the Firebase Web app configuration for `plugz-untd-gear`. These are public client configuration values; do not place service account credentials or Secret Manager values in this app.

Start the local app with `npm run dev`, then open `http://localhost:3000/dashboard`. Email/password Authentication must be enabled for the Firebase project, and the current hostname must be an authorized Authentication domain. The order page calls `getCustomerOrderPage`.

## Firebase deployment boundaries

`firebase.json` defines only Cloud Functions, Firestore rules/indexes, and Storage rules. It contains no Hosting target or Hosting configuration. The source project cannot deploy or overwrite the live storefront's Hosting build.

Deployment status on 2026-11-04:

- `getCustomerOrderPage` is deployed to `plugz-untd-gear` in `us-east4` as a Node.js 22 callable.
- The `orders` composite index (`customerUid` ascending, `createdAt` descending) was deployed and last reported `CREATING`. It must reach `READY` before order queries can use it reliably.
- No Firestore rules, Storage rules, or Hosting deployment was made from this setup. The existing production Dashboard remains unchanged.

See [`docs/DEPLOYMENT_HANDOFF_2026-11-04.md`](docs/DEPLOYMENT_HANDOFF_2026-11-04.md) for the current state and resume steps.

The existing production Dashboard remains unchanged until this reconstructed app is integrated into a deliberate Hosting rollout. Do not deploy this app to `plugz-untd-gear` Hosting as a standalone replacement for the full site.
