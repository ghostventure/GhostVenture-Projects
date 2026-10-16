# EstateHat Recovery Guide

If you need to recover the project quickly, use this order:

## 1. Verify dependencies

```bash
npm install
```

## 2. Rebuild the web app

```bash
npm run build
```

## 3. Redeploy web hosting

```bash
npm run deploy:hosting
```

## 4. Resync iOS project

```bash
npm run sync:ios
```

## 5. Rebuild desktop shell

```bash
npm run build:desktop
```

## Key files to protect first

- `src/estatehat-platform-alpha.jsx`
- `src/AuthScreen.jsx`
- `src/authBranding.js`
- `src/backend.js`
- `src/main.jsx`
- `src/firebase.js`
- `package.json`
- `firebase.json`
- `capacitor.config.json`
- `electron/main.cjs`

## If Git history is missing

Use `ROLLBACK_NOTES.md` for the documented fallback locations and rollback procedure. Do not guess at older content when cross-project text appears in the app.

## Live site

- `https://estatehat.web.app`
