# Dashboard Access Fix - 2026-06-12

## Summary

Fixed the staff/manager dashboard access issue where authenticated manager accounts were being redirected from `/dashboard` to `/booking-manager`.

The intended behavior now is:

- `/dashboard` opens for authenticated client, staff, and manager accounts.
- `/booking-manager` remains manager-only.
- Staff/manager accounts can use the normal dashboard and open Manager from the dashboard navigation when needed.
- Signed-out users are still redirected from protected routes to `/portal?auth=required`.

## Root Cause

Two redirect paths treated manager accounts as a special case and sent them to `/booking-manager` instead of allowing `/dashboard`:

- `app/dashboard/page.js` used `requireWorkspaceUser({ redirectAuthedManagersTo: "/booking-manager" })`.
- `components/auth-form-card.js` and `components/auth-sync.js` sent manager accounts to `/booking-manager` after login or portal auth sync.

## Code Changes

- `app/dashboard/page.js`
  - Removed the manager redirect from the dashboard server guard.
  - Dashboard now calls `requireWorkspaceUser()` with no manager redirect.

- `components/auth-form-card.js`
  - Login/signup continuation now sends authenticated users to `/dashboard`.
  - Staff helper copy now says Manager is available from dashboard navigation.

- `components/auth-sync.js`
  - Portal auth sync now routes authenticated users to `/dashboard`.
  - Manager-only protection for `/booking-manager` remains intact.

- `components/dashboard-app.js`
  - Added the missing `consultationTime` selector to the dashboard request form.
  - Marked consultation date, budget, and timeline fields as required.

## Verification

Commands run:

```bash
npm run build
npm run deploy:framework-hosting
npm run smoke:live
```

Live manager smoke:

- `POST /api/login` for `manager@blacklionstudios.com` returned `200`.
- Authenticated `GET /dashboard` returned `200`.
- Authenticated `/dashboard` did not redirect to `/booking-manager`.
- Manager dashboard HTML included `Client dashboard`, `Manager`, `Client`, and `Consultation time`.
- Authenticated `GET /booking-manager` returned `200`.

Live dashboard request smoke:

- Disposable signup returned `201`.
- Authenticated `/dashboard` returned `200`.
- Dashboard page included `Consultation time`.
- `POST /api/requests` accepted a service request with `consultationTime`.
- `GET /api/dashboard` returned `200` and reflected `totalOrders: 1`.

## Live URL

- `https://black-lion-media-studio.web.app`
