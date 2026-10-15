# Founder Profile Retention Fix - 2026-06-06

## Summary

The founder/owner profile path was forcing default founder identity fields back into the profile, including the `@founder` handle. That made saved owner profile edits appear to reset after refresh or sign-in.

## What changed

- Updated the Firebase founder canonical profile path so founder access is forced without forcing editable identity fields back to defaults.
- Existing default founder filler values are now treated like blank placeholders instead of saved user identity.
- Scrubbed filler values include `FoxHub Founder`, `@founder`, `Atlanta`, the founder boilerplate bio, `Founder`, and `FoxHub management`.
- Future founder/staff accounts are covered by the same rule: access fields can be forced, but editable identity fields are not seeded with founder filler.
- Founder/staff accounts now bypass member setup requirements so blank member-profile fields cannot trap the founder at the setup screen.
- Added founder support for pronouns, website, availability, interests, and age-verification fields in the canonical Firebase profile.
- Updated the local founder manager profile builder to merge saved profile details instead of recreating `FoxHub Founder` / `@founder` every time.
- Made profile saves persist immediately from the app store after `updateProfileRecord`.
- Hardened local state persistence so stale profile snapshots cannot overwrite the durable saved profile record.
- Preserved role, manager access, and staff access when local profiles are saved.

## Verification

- `npm test` passed with 17/17 tests.
- Added regression coverage for default founder filler values being blanked and stale `@founder` snapshots attempting to overwrite a saved custom founder profile.
- Added regression coverage proving future member signups start with blank optional profile fields instead of saved placeholder/filler text.
- Added regression coverage proving founder/staff profiles do not require member profile fields to pass setup validation.
- `npm run build` passed.
- `npm run smoke:public` passed.
- Local Playwright render check returned HTTP 200, populated the React root, and confirmed Green Composite default theme.
- Firebase Hosting deploy completed for project `foxhub-superapp`.
- Live Playwright render check returned HTTP 200, populated the React root, confirmed Green Composite default theme, and logged no console/page errors.

## Preservation

After deploy and verification, the project archive was refreshed at:

- `/home/sniper-lion-main/Documents/Firebase Websites/Archives/FoxHub App.zip`
