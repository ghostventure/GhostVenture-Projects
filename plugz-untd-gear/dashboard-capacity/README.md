# Plugz Dashboard capacity candidate

This folder contains the recovered deployed Cloud Functions baseline with a local addition for paginated customer order history, the required Firestore composite index, and a reconstructed UI section that consumes the new callable.

`backend/index.js` is based on the active function deployment source archive and adds `getCustomerOrderPage`. It returns at most 20 sanitized order records per call, scoped to the authenticated user, with a cursor for the next page. `dashboard/CustomerOrderHistory.jsx` provides type filtering, incremental loading, loading/retry/empty states, and status announcements.

This candidate is not deployed. The active site still uses the existing full-order listener. The React section is not integrated into the original Next.js source because that source is unavailable; it is a maintainable reconstruction for integration into a recovered or rebuilt Dashboard. This folder has no deployment configuration. Deploying the function requires the matching composite index and a reviewed frontend integration.
