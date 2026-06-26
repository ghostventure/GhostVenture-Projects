# Firebase Migration Handoff - 2026-05-20

## Goal

Move Black Lion Studios from the current Firebase project to the target Firebase project/account identified as:

- Target project ID: `black-lion-media-studio`
- Target Google account used for Firebase CLI deploys: `blacklionmediastudio@gmail.com`

## Previous production project

- Previous Firebase project: `black-lion-studios`
- Previous Hosting site: `black-lion-studios`
- Previous live URL: `https://black-lion-studios.web.app`
- Previous SSR function: `firebase-frameworks-black-lion-studios:ssrblacklionstudios(us-central1)`

## Completion status

Completed on 2026-05-20 after adding Firebase CLI account `blacklionmediastudio@gmail.com`.

New production target:

- Firebase project: `black-lion-media-studio`
- Hosting site: `black-lion-media-studio`
- Live URL: `https://black-lion-media-studio.web.app`
- SSR function: `firebase-frameworks-black-lion-media-studio:ssrblacklionmediastudio(us-central1)`

Post-deploy fix applied:

- Cloud Run service `ssrblacklionmediastudio` was granted `roles/run.invoker` for `allUsers` because the first deploy returned 403 from Hosting until public invocation was set.

Verified:

- `/portal` returned HTTP 200.
- Signed-out `/dashboard` returned HTTP 307 to `/portal?auth=required`.
- `/api/events` POST returned `{"ok":true}`.

## Original access blocker, now resolved

The Firebase CLI on this workstation originally used an account that could access and deploy the old `black-lion-studios` project, but it did not have permission on `black-lion-media-studio`.

Confirmed command:

```bash
npx firebase-tools hosting:sites:list --project black-lion-media-studio
```

Observed result:

```text
HTTP Error: 403, The caller does not have permission
```

The Gmail password cannot be used by the Firebase CLI for deployment. Firebase deploy access must be granted through Google OAuth/IAM.

Resolution:

- Added Firebase CLI account `blacklionmediastudio@gmail.com` through OAuth.
- Verified access to Firebase project `black-lion-media-studio`.
- Deployed the app to the new project and Hosting site.

## Current deploy commands

Check access:

```bash
npx firebase-tools projects:list --account blacklionmediastudio@gmail.com
npx firebase-tools hosting:sites:list --project black-lion-media-studio --account blacklionmediastudio@gmail.com
```

Deploy:

```bash
npm run deploy:full
```

Equivalent direct command:

```bash
npm run build
npx firebase-tools deploy --project black-lion-media-studio --account blacklionmediastudio@gmail.com
```

Verify:

```bash
curl -sI https://black-lion-media-studio.web.app/portal
curl -sI https://black-lion-media-studio.web.app/dashboard
curl -s -X POST https://black-lion-media-studio.web.app/api/events \
  -H 'Content-Type: application/json' \
  --data '{"eventName":"page_view","path":"/migration-smoke","source":"deploy-smoke"}'
```

Expected checks:

- `/portal` returns HTTP 200.
- Signed-out `/dashboard` returns a single 307 to `/portal?auth=required`.
- `/api/events` POST returns `{"ok":true}`.

## Data migration note

This project uses Firestore-backed data. A full move to a new Firebase project is not only a Hosting deploy. It also requires one of:

- Firestore export/import between projects.
- A clean new project with empty user/request/message data.
- A deliberate account/data migration plan for users, requests, messages, analytics events, and manager configuration.

The deployed code has moved to the new Firebase project. Existing production data from the old project should not be assumed to have moved automatically.

## Final backup

- Restore archive: `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_firebase_migration_final_20260520-214004.tar.gz`

## Old origin undeploy

Completed after the migration:

- Disabled Firebase Hosting for old project/site `black-lion-studios`.
- Deleted old SSR function `firebase-frameworks-black-lion-studios:ssrblacklionstudios(us-central1)`.
- Left old Firestore/database data untouched.

Verified:

- Old URL `https://black-lion-studios.web.app/` returned HTTP 404.
- Old project functions list returned empty.
- New URL `https://black-lion-media-studio.web.app/portal` still returned HTTP 200.

Restore archive after undeploy:

- `/home/sniper-lion-main/Documents/Black Lion Studios/Black_Lion_Studios_old_origin_undeployed_20260520-214312.tar.gz`
