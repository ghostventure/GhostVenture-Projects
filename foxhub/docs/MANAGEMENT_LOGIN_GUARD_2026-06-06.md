# Management Login Guard - 2026-06-06

## Summary

The Management sign-in route now rejects valid member credentials when the signed-in profile does not have FoxHub management access.

The member sign-in route also rejects staff/management credentials. Staff accounts must use `/management`.

## Behavior

- Route: `/management`
- Non-management account result: `Not Permitted.`
- The app signs the non-management session back out immediately.
- The user stays on the Management sign-in route.
- Staff/management access still follows the existing rule: the profile email domain must contain `foxhub`.
- Member route staff result: `Not Permitted.`
- Staff/management accounts are signed back out if they attempt to use `/signin`.

## Verification

- `npm test` passed with 17/17 tests.
- `npm run build` passed.
- `npm run smoke:public` passed.
- Firebase Hosting deploy completed for project `foxhub-superapp`.
- Live `/signin` and `/management` render checks returned HTTP 200, displayed the expected sign-in pages, and logged no console/page errors.

## Preservation

Per owner instruction on 2026-06-06, the zip archive was not refreshed for this change.
