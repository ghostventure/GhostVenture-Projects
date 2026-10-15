# FoxHub Release Checklist

Use this before calling a FoxHub release complete.

## Required Account

- Firebase CLI account: `solidartentertainment@gmail.com`
- Firebase project: `foxhub-superapp`
- Hosting URL: `https://foxhub-superapp.web.app`

Confirm:

```bash
npx firebase-tools login:list
npx firebase-tools hosting:sites:list --project foxhub-superapp
```

## Web Verification

Run:

```bash
npm run release:check
npm run deploy:hosting
```

Smoke-check:

- `/`
- `/landing`
- `/signin`
- `/footer/legal/privacy-policy`
- Organizer count remains `220`
- splash footer renders
- authenticated shell footer renders

## Package Verification

Run:

```bash
npm run package:android:debug
npm run dist:win
```

Confirm:

- `release/FoxHub-Android-Debug-0.1.0.apk`
- `release/FoxHub-0.1.0-x64.exe`
- Android assets contain current Vite asset names.
- Windows `app.asar` contains current Vite asset names.

## Release Notes

Update:

- `docs/PROJECT_STATUS.md`
- feature-specific install doc
- package refresh doc if Android or Windows changes
- live `Last-Modified` timestamp after deploy

## Known Production Gaps

- Android release signing is not configured.
- Windows code signing and custom icon are not configured.
- Next/API production deployment still depends on the Firebase Functions/Blaze path or another backend host.
