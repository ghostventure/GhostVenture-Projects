# Staff Member Login Separation - 2026-06-06

## Summary

FoxHub now enforces a two-way separation between member sign-in and staff/management sign-in.

## Rules

- Members use `/signin`.
- Staff and management use `/management`.
- Valid member credentials cannot enter `/management`.
- Valid staff/management credentials cannot enter `/signin`.
- Wrong-lane sign-ins are immediately signed back out.
- Wrong-lane error message: `Not Permitted.`

## Reason

This prevents internal tampering and manipulation by keeping staff credentials out of member-account surfaces and keeping member credentials out of management controls.

## Verification

- `npm test` passed with 17/17 tests.
- `npm run build` passed.
- `npm run smoke:public` passed.
- Firebase Hosting deploy completed for project `foxhub-superapp`.
- Live `/signin` and `/management` render checks returned HTTP 200 and logged no console/page errors.

## Preservation

Per owner instruction on 2026-06-06, the zip archive was not refreshed for this change.
