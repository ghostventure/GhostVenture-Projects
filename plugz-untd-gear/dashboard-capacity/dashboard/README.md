# Reconstructed customer order history

`CustomerOrderHistory.jsx` is the reconstructed order-history section mounted in `app/dashboard/DashboardClient.jsx`. It replaces the current all-orders real-time listener with a cursor-paginated callable flow. It provides order type filtering, explicit loading/retry/empty states, bounded page loading, accessible status announcements, and safe display summaries.

It expects the caller to pass the initialized Firebase Functions client and signed-in UID. This standalone reconstruction does not alter the recovered live Next.js app. Treat it as a replacement candidate for review; do not deploy it to the live Hosting site without integrating it with the complete storefront source.
