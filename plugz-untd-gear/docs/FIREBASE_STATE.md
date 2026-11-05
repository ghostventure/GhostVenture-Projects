# Plugz UNTD Firebase state

Snapshot recorded 2026-11-04 for Firebase project `plugz-untd-gear` (project number `329345923912`). Production site: <https://plugz-untd-gear.web.app>.

## Hosting

Production is serving restored Hosting version `5239836fb199d578`, first created 2026-08-16 and re-released on 2026-11-04. It contains 305 files (about 65 MB) and is the full Next.js site with its imagery and routes. The small static folder in the local Plugz Website checkout is not this build; deploying it would replace production with a fallback.

Active Hosting behavior recorded from the release configuration:

- `**`: `Cache-Control: no-cache` and security headers.
- `/_next/static/**`: `public, max-age=31536000, immutable`.
- `/assets/**`: `public, max-age=3600`.
- Clean URLs enabled.

A temporary `visual-recovery` preview channel was created during the visual restore: <https://plugz-untd-gear--visual-recovery-pb2j450h.web.app>. It serves the same build and expires 2026-11-11.

## Firestore and Storage rules

The files in this directory are copies of the active deployed rule sets:

- Firestore ruleset `4da567d6-8600-4dc1-9c16-7b891e68c27b`, updated 2026-08-02.
- Storage ruleset `8c91e320-e403-47c2-a352-4135b722b099`, updated 2026-07-29.

Firestore permits public reads only for published products and editorial content. Customer documents and orders are limited to their owner; administrative collections are owner-readable; browser writes are denied and routed through server functions. Storage permits a customer to read/write only their own profile avatar, with image content type and a 2 MiB upload limit; all other paths are denied.

The adjacent `firebase.json` points only to these rules. From this directory, `firebase deploy --only firestore:rules,storage` updates those rules and does not deploy Hosting or Functions. Review the project/account before any deployment.

## Functions and switches

Fourteen active Node.js 22 callable/HTTP functions were present in `us-east4`: `claimSignalInvite`, `createSquareSandboxPayment`, `getSquareSandboxCheckoutConfig`, `initializeCustomerProfile`, `ownerCommunityAction`, `ownerContentAction`, `ownerProductAction`, `printfulProductWebhook`, `reconcilePrintfulCatalogDaily`, `refreshPrintfulCatalog`, `submitCommunityIntake`, `syncPrintfulCatalog`, `updateCustomerAccountData`, and `updateCustomerProfile`.

Firebase Remote Config has no parameters or parameter groups deployed, so there are no Remote Config feature switches to copy. The live interface has a client-side Night mode toggle. Checkout behavior in the deployed site uses Square Sandbox with a Zazzle storefront fallback (`https://www.zazzle.com/store/plugzunited`). No Shopify storefront link was found in the inspected production JavaScript assets or related local docs.

## Upgrade work in the local fallback checkout

`fallback-upgrades/` contains the functional changes made in the small local static fallback: a persistent bag with quantity and currency totals, validated local storage and cross-tab updates; semantic labels, skip navigation, product button labels and live bag status; and Hosting cache/security headers. These changes are not part of production version `5239836fb199d578`; they are recorded here as fallback-only code and must be ported to the actual Next.js source before they can affect production.

The fallback Hosting configuration is intentionally kept separate from the rules-only Firebase config in this directory. Do not use the fallback's `firebase.json` to deploy the production site.

## Dashboard capacity candidate

`../dashboard-capacity/` contains recovered Functions source plus a candidate `getCustomerOrderPage` callable and reconstructed order-history UI section. It replaces the current unbounded customer order listener with 20-record cursor pages and sanitized fields. The candidate has not been deployed or integrated into the original Next.js page source; production still runs the previously deployed Dashboard. Its composite index is included alongside the candidate code.
