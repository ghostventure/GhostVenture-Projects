# Signup Age Verification - 2026-06-05

## Summary

FoxHub member signup is now explicitly 18+ only.

## Behavior

- The member signup form collects date of birth.
- Signup rejects missing, invalid, or under-18 birth dates.
- The UI blocks under-18 signup before submission.
- The local/demo repository also blocks under-18 signup if the UI is bypassed.
- The Firebase repository blocks under-18 signup before `createUserWithEmailAndPassword`, so Firebase Auth accounts are not created for underage member signup attempts.
- Successful member signup stores `ageVerified: true` and `ageVerifiedAt`.
- The raw birth date is not stored on the member profile.

## Scope

- Applies to public member signup.
- Management/staff sign-in remains a sign-in-only path and does not expose public member signup.

## Files Updated

- `src/App.jsx`
- `src/rules.js`
- `src/repository-local.js`
- `src/repository-firebase.js`
- `tests/local-profile-persistence.test.mjs`
- `scripts/release-smoke.mjs`

## Verification

Run:

- `npm test`
- `npm run smoke:public`
- `npm run build`

Regression coverage:

- Missing date of birth is rejected.
- Under-18 date of birth is rejected.
- Adult signup succeeds.
- Successful signup stores an age-verification marker.
- Raw date of birth is not stored on the profile.
