# EstateHat Deployment Checklist

## Web

1. Run `npm install` if dependencies changed.
2. Run `npm run build`.
3. Verify `dist/` was updated.
4. Run `npm run deploy:hosting`.
5. Check `https://estatehat.web.app`.

## iOS

1. Run `npm run sync:ios`.
2. Open `ios/App/App.xcodeproj`.
3. Confirm signing, bundle settings, icons, and target device.
4. Build in Xcode.

## Windows

1. Run `npm run build:desktop`.
2. Run `npm run dist:win` on a machine with the required Windows packaging support.
3. Check output under `release/`.

## Final checks

- Footer pages load
- Admin view opens
- Webmaster/admin profiles resolve correctly after login
- Watchlist and saved searches persist
- Messaging and transactions load without blank screens
- Auth screen uses EstateHat branding only
- No gig/performer/host/CLTCH wording appears in the main user flows
