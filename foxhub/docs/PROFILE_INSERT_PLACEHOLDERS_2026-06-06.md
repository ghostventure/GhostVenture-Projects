# Profile Insert Placeholders - 2026-06-06

## Summary

New-account and profile-edit fields now use neutral `Insert...` placeholder text instead of sample names, sample handles, sample cities, or founder-flavored examples.

## What changed

- Public display name placeholder: `Insert public display name`
- Username placeholder: `Insert username`
- City placeholder: `Insert city`
- Bio placeholder: `Insert short public bio`
- Occupation placeholder: `Insert occupation`
- Demographic placeholder: `Insert audience or community`
- Pronouns placeholder: `Insert pronouns, if you want`
- Website placeholder: `Insert website or profile link`
- Availability placeholder: `Insert availability`
- Interests placeholder: `Insert interests and strengths`
- Invite label placeholder: `Insert invite label`

The default profile bio seed is now blank so new profiles do not receive saved filler text.

Future account guard:

- New member accounts start with blank optional profile fields.
- Placeholder text remains UI-only and is not saved as profile information.
- Founder/staff access setup does not seed editable identity fields with founder filler.

## Verification

- `npm test` passed with 17/17 tests.
- `npm run build` passed.
- `npm run smoke:public` passed.
- Local browser check confirmed the sign-up fields use `Insert...` placeholders and no longer show the old sample placeholders.
- Firebase Hosting deploy completed for project `foxhub-superapp`.
- Live browser check confirmed the deployed sign-up fields use `Insert...` placeholders, no old sample placeholders remain, and no console/page errors were logged.

## Preservation

After deploy and verification, the project archive was refreshed at:

- `/home/sniper-lion-main/Documents/Firebase Websites/Archives/FoxHub App.zip`
