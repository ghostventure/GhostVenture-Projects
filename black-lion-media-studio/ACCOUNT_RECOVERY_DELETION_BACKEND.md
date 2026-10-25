# Account recovery and deletion request backend

This local source adds backend workflows for password recovery and account deletion requests. It does not delete account data automatically, and it is not deployed.

## Password recovery

- `POST /api/account/recovery/request` accepts `{ "email": "..." }` and returns the same generic success response whether or not the account exists.
- Requests are limited by the existing per-IP authentication limiter and a Firestore transactional per-account limit of three requests per hour.
- Recovery tokens are cryptographically random, stored only as SHA-256 hashes, expire after 30 minutes, and are consumed in the same transaction that changes the password.
- The recovery link carries its token in the URL fragment (`#token=...`) so browsers do not send it with page or asset requests.
- Password recovery bumps `auth_version`, invalidating existing sessions.
- `POST /api/account/recovery/complete` accepts `{ "token": "...", "newPassword": "..." }`.
- Delivery uses the existing SMTP settings (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, optional `SMTP_FROM`) and `SITE_BASE_URL`. If SMTP is unavailable, the generic request response is retained and delivery failure is logged without the token.

## Account deletion requests

- Authenticated `POST /api/account/deletion` accepts an optional `{ "reason": "..." }` and creates a durable request without removing data.
- Repeated requests are deduplicated while one is pending. If SMTP is configured, the studio receives an alert; the request remains in Firestore if email fails.
- Booking managers can list requests at `GET /api/manager/account-deletions` and update their review state at `PATCH /api/manager/account-deletions` with `{ "requestId": "...", "status": "under_review|awaiting_client|policy_review|declined|resolved", "managerNote": "..." }`.
- The server explicitly flags retention review. A retention schedule, legal hold process, deletion scope, and final client response policy still need studio ownership. `resolved` records administrative follow-up only; it does not delete account data.
- Optional alert recipient: `ACCOUNT_DELETION_ALERT_TO` (defaults to the existing studio alert address).

Firestore client rules deny all direct reads and writes, so these records are only accessible through the server's Firebase Admin SDK routes. Deployment and SMTP delivery have not been verified.
