# Recovered Functions source

The baseline source files were extracted from the active Firebase Gen 2 deployment archive for project `plugz-untd-gear`, region `us-east4`, on 2026-11-04. Each of the 14 then-active functions referenced the same source archive and hash. This is recovered deployment source, not the original repository with its history or local development setup.

Runtime: Node.js 22. Entry points: `index.js`. Required secrets are referenced with Firebase Secret Manager bindings; secret values are not present here.

## Local Dashboard capacity change

`index.js` now defines a candidate `getCustomerOrderPage` callable. It reads at most 21 customer-owned order documents per request, returns a 20-order page with an opaque cursor, and limits returned fields to what the customer order-history UI displays. `../firestore.indexes.json` defines the required customer UID and descending creation-time index. The reconstructed UI section is in `../dashboard/CustomerOrderHistory.jsx`.

`getCustomerOrderPage` and `updateCustomerAccountSettings` were deployed to `plugz-untd-gear` in `us-east4` on 2026-11-04. The order-history composite index is `READY`.

`updateCustomerAccountSettings` validates profile fields, communication choices, and up to five saved addresses, then writes them together in one authenticated Firestore transaction with a PII-minimal audit entry. This avoids multiple browser-to-Function calls and prevents settings sections from partially saving. The new standalone app uses it from `app/account/settings/settings-client.jsx`.

The active production frontend has not been integrated with the reconstructed settings page or order history. The live storefront still serves its existing Dashboard until a deliberate Hosting release is planned.
