# FoxHub Sign-In and Moments Enrichment - 2026-05-31

## Summary

FoxHub's hosted static bundle now includes the enriched sign-in page and the updated Moments composer/reactions work.

## Installed

- Enriched the public `/signin` screen in `src/App.jsx`.
- Added stronger return-context copy for conversations, circles, Moments, saved context, and local recommendations.
- Added sign-in status cues for runtime mode, account access, and OneID.
- Added access highlight cards for Circles, OneID, and local signal.
- Added a sign-in preview panel that shows the user's current thread, Moments count, Circles count, and Services count.
- Preserved the existing password, Google, email-link, landing, and sign-up handlers.
- Expanded Moments reactions in `src/FoxHubShell.jsx` from the original three text buttons to a compact emoji-style reaction bar:
  - Like
  - Love
  - Haha
  - Wow
  - Fire
  - Support
  - Thanks
  - Watching
- Added Moment photo posting with up to 4 images per post.
- Added Moment photo preview and remove controls before posting.
- Added image compression before persisting Moment photos.
- Added `attachments` support to Moment records in the local and Firebase repositories.
- Added styling for the enriched sign-in page, Moment photo previews, Moment photo grids, and reaction bar in `src/styles.css`.

## Changed Files

- `src/App.jsx`
- `src/FoxHubShell.jsx`
- `src/styles.css`
- `src/repository.js`
- `src/repository-local.js`
- `src/repository-firebase.js`
- `src/useFoxHubStore.js`

## Verification

Completed before deploy:

- `npm run smoke:public` (pass)
- `npm test` (pass)

Deployment:

- `npm run deploy:hosting` (pass)
- Firebase project: `foxhub-superapp`
- Hosting URL: `https://foxhub-superapp.web.app`
- Live sign-in route: `https://foxhub-superapp.web.app/signin`
- Live `/signin` returned HTTP 200.
- Live `Last-Modified`: `Sun, 31 May 2026 21:54:35 GMT`

Live bundle checks:

- JS contains `Come back to your people, posts, and local signal`.
- JS contains `Secure entry`.
- JS contains `After sign-in`.
- Shell bundle contains `Add photos`, `Moment photos`, and `Watching`.
- CSS contains `auth-preview-panel`.
- CSS contains `moment-photo-preview-grid`.
- CSS contains `moment-reaction-bar`.

## Notes

- Firebase Hosting still serves the Vite static bundle from `dist`.
- Moment photos currently persist as compressed data URL attachments in the existing record flow. A production media path should move photos to dedicated object storage with server-side validation, malware/content checks, signed URLs, and moderation hooks before wider release.
- The sign-in page remains a client-rendered React screen routed through the shared `src/App.jsx` controller.
