# WeChat Non-Video Parity Install - 2026-04-19

## Summary

Installed a simple FoxHub Services `Parity` tab for the remaining WeChat-style gaps, excluding the Channels/short-video lane.

This is intentionally a simple install list, not a deeper enhancement pass.

## Installed Packs

- Media Messaging And Calls
- Group And Social Privacy
- Official Account Console
- Mini Program Developer Platform
- Real Wallet And Payment Rails
- Orders, Loyalty, And Local Transactions
- Ecosystem Search And Discovery
- Ads And Merchant Growth
- Production Trust And Safety
- Native Push And Service Alerts
- Platform, Developer, And Enterprise Layer

## Scope

- Added 11 packs.
- Added 118 checklist items.
- Added Open buttons that route into existing FoxHub services.
- Did not add the Channels/short-video feed pack.
- Did not claim external payment, bank, call, SMS, or native push rails are live.

## Files

- `src/data.js`
- `src/FoxHubShell.jsx`
- `src/styles.css`

## Verification

- `npm test`: pass
- `npm run build`: pass
- `npm run sync:android`: pass
- `npm run sync:ios`: pass
- `npx firebase-tools deploy --only hosting --project foxhub-superapp`: pass
- Live bundle smoke: pass
