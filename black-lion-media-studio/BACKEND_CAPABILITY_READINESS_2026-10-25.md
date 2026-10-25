# Black Lion Studios backend capability readiness

This note describes the local source implementation for the site-wide functionality scope in `WEBSITE_UX_FEATURES_50.md`. Source code, GitHub publication, Firebase deployment, provider configuration, and authenticated production verification are separate release states.

## Local backend contracts

| Capability | Server contract | Access and persistence |
| --- | --- | --- |
| Square consultation availability | `GET /api/consultations/availability?startAt=...&endAt=...` with optional owned `requestId` | Signed-in account; Square Bookings is the authority for availability and slot conflicts. |
| Appointment creation | `POST /api/requests` with `startAt` and stable UUID `bookingAttemptId` | Authenticated request; idempotent Square booking attempt; compensates by cancelling a created booking if request persistence fails. |
| Appointment reschedule/cancel | `PATCH` or `DELETE /api/consultations/bookings` with `requestId` and optional `startAt` | Request ownership checked before calling Square; Square booking updates are written back to the request. |
| Request files | `GET`/`POST /api/requests/{requestId}/attachments`; `GET /api/attachments/{attachmentId}` | Owner-only; PDF/PNG/JPEG up to 10 MB; private object path; bounded multipart body; authenticated download redirects to a short-lived signed URL. Booking managers can list/download request-linked files through `/api/manager/requests/{requestId}/attachments`. |
| Message files | `GET`/`POST /api/messages/{messageId}/attachments`; `GET /api/messages/{messageId}/attachments/{attachmentId}` | Only the account that owns a client-authored message; up to 10 files per message, PDF/PNG/JPEG up to 10 MB; private object path and short-lived signed download. Booking managers have message-scoped list/download routes under `/api/manager/messages/{messageId}/attachments`. |
| Payment history | `GET /api/requests/{requestId}/payments` | Request owner only; returns Square payment events and receipt links recorded from verified webhooks. |
| Square payment/refund events | `POST /api/square/payments/webhook` | Dedicated HMAC signature key and configured location checked; payment/refund event IDs are deduplicated; out-of-order events do not replace newer per-payment/refund states; completed refunds reduce net paid totals. |
| Password recovery | `POST /api/account/recovery/request` and `POST /api/account/recovery/complete` | Generic request response; per-IP and per-account throttles; one-time SHA-256 token with 30-minute expiry; successful reset invalidates prior sessions. Email link token is carried in a URL fragment. |
| Account deletion request | `POST /api/account/deletion`; manager queue `GET`/`PATCH /api/manager/account-deletions` | Authenticated client intake and booking-manager review. The workflow records follow-up; it does not delete account data. |

## Required provider configuration

- **Square:** production `SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID`, `SQUARE_CONSULTATION_SERVICE_VARIATION_ID`, Bookings API permissions, and an eligible Appointments plan. Register booking events at `/api/square/bookings/webhook` and payment/refund events (`payment.created`, `payment.updated`, `refund.created`, `refund.updated`) at `/api/square/payments/webhook`; each endpoint requires the exact registered URL and its matching signature key. Payment history remains empty until events arrive.
- **Firebase Storage:** provision a bucket and set `FIREBASE_STORAGE_BUCKET`. The new `storage.rules` denies direct client reads/writes; the authenticated server routes use Firebase Admin and short-lived signed downloads. Confirm the runtime service account can read/write objects and sign URLs.
- **Password recovery email:** configure SMTP host, port, sender, username/password, and `SITE_BASE_URL` in the hosted runtime. A recovery request remains generic if delivery is unavailable; users will not receive a usable link until SMTP works.
- **Account retention:** define the deletion scope, retention schedule, legal-hold process, client follow-up, and completion policy before turning a reviewed request into data deletion.
- **Cancellation policy:** publish the studio's client-facing cancellation window, fees/refunds, and exceptions before representing appointment cancellation as policy-complete.
- **Portfolio filters:** add real portfolio entries with studio branch and project-type metadata. Current gallery cards are illustrative previews.

## Release status

The current checklist is **47/50 locally implemented**. Features 8, 17, and 46 remain incomplete for the data and policy reasons above. The production build passed locally under Node 22.23.3 after correcting two recovery-route import paths. This source has not yet been deployed or verified with authenticated production workflows. Do not treat a successful build or source publication as proof that Square, Storage, SMTP, Hosting, or account workflows are live.
