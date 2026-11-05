# Recovered Functions source

The baseline source files were extracted from the active Firebase Gen 2 deployment archive for project `plugz-untd-gear`, region `us-east4`, on 2026-11-04. Each of the 14 then-active functions referenced the same source archive and hash. This is recovered deployment source, not the original repository with its history or local development setup.

Runtime: Node.js 22. Entry points: `index.js`. Required secrets are referenced with Firebase Secret Manager bindings; secret values are not present here.

## Local Dashboard capacity change

`index.js` now defines a candidate `getCustomerOrderPage` callable. It reads at most 21 customer-owned order documents per request, returns a 20-order page with an opaque cursor, and limits returned fields to what the customer order-history UI displays. `../firestore.indexes.json` defines the required customer UID and descending creation-time index. The reconstructed UI section is in `../dashboard/CustomerOrderHistory.jsx`.

This change is local and has not been deployed. The new standalone app mounts the reconstructed section from `dashboard/CustomerOrderHistory.jsx`; the active production frontend still uses its existing unbounded real-time order listener until this source is reviewed and released.
