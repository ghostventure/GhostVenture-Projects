# Plugz Dashboard source setup

This is a new, standalone Next.js setup assembled on 2026-11-04 from the Firebase deployment recovery. It is a maintainable reconstruction, not the missing original Plugz Git checkout.

## What is included

- Customer account dashboard with the live site's email/password sign-in, account creation, password reset, profile summary, saved-piece count, preference status, and links to existing storefront account/support routes.
- In-app `/account/settings` center for profile details, notification choices, saved addresses, email verification, password reset, and account-data export.
- Paginated order history with test/production filters, cursor-based load-more, explicit loading/error/retry/empty states, and accessible status announcements.
- `getCustomerOrderPage` callable in `functions/index.js`, which returns at most 20 customer-scoped orders and excludes unnecessary/private fields from the response.
- `updateCustomerAccountSettings` callable, which validates and saves profile, communication preferences, and addresses in one authenticated transaction.
- Active Firestore and Storage rule snapshots and the required customer-order composite index.
- Recovered deployed backend baseline. Compiled reference assets are kept in the local recovery artifacts and are excluded from this source project.

The original Next.js frontend source and source maps were not present in the deployment. This new app reconstructs the customer Dashboard flow; it does not reproduce every route or the storefront.

## Local setup

Use Node.js 22 or later. Install dependencies with `npm ci`. Copy `.env.example` to `.env.local` and fill the six `NEXT_PUBLIC_FIREBASE_*` values from the Firebase Web app configuration for `plugz-untd-gear`. These are public client configuration values; do not place service account credentials or Secret Manager values in this app.

Start the local app with `npm run dev`, then open `http://localhost:3000/dashboard`. Email/password Authentication must be enabled for the Firebase project, and the current hostname must be an authorized Authentication domain. The order page calls `getCustomerOrderPage`.

The static production build is available at [https://plugz-dashboard-capacity.web.app](https://plugz-dashboard-capacity.web.app). The dashboard and account settings paths are `/dashboard/` and `/account/settings/`.

## Firebase deployment boundaries

`firebase.json` targets the separate Firebase Hosting site `plugz-dashboard-capacity` and publishes the static export from `out/`. It does not target the storefront Hosting site `plugz-untd-gear`.

Deployment status on 2026-11-04:

- `getCustomerOrderPage` is deployed to `plugz-untd-gear` in `us-east4` as a Node.js 22 callable.
- `updateCustomerAccountSettings` is deployed to `plugz-untd-gear` in `us-east4` as a Node.js 22 callable.
- The `orders` composite index (`customerUid` ascending, `createdAt` descending) is `READY`.
- The standalone app was deployed to the separate Hosting site `plugz-dashboard-capacity` at `https://plugz-dashboard-capacity.web.app`. `/`, `/dashboard/`, and `/account/settings/` returned HTTP 200.
- No Firestore rules or Storage rules were deployed. The main storefront site `plugz-untd-gear.web.app` and its existing Dashboard remain unchanged.

See [`docs/DEPLOYMENT_HANDOFF_2026-11-04.md`](docs/DEPLOYMENT_HANDOFF_2026-11-04.md) for the current state and resume steps.

The main storefront remains unchanged. This account app is hosted separately; do not change its Hosting target to `plugz-untd-gear` as a standalone replacement for the full site.
