# EstateHat Assistant + Native Wrapper Refresh

Date: 2026-04-29

## Scope

This pass tightened the shared assistant UX, reduced mobile shell friction, and resynced the Android and iOS wrappers to the current Next export.

## Assistant updates

- The right-rail assistant now includes clearer quick-topic shortcuts tied to the current workspace.
- Compact/mobile assistant behavior was tightened so the docked shell reads more like a native utility tray than a floating oversized panel.
- Assistant body height is now bounded with internal scrolling so long responses do not overrun the viewport.
- Mobile workspace spacing was reduced so the assistant and page content waste less vertical room on smaller screens.

## Native wrapper updates

- Android assets were resynced with:
  - `npm run sync:android`
- iOS assets were resynced with:
  - `npm run sync:ios`
- Current synced locations:
  - Android web bundle: `android/app/src/main/assets/public`
  - iOS web bundle: `ios/App/App/public`

## Operational note

- Android and iOS syncs should be run sequentially, not in parallel.
- Parallel sync attempts can collide inside the shared Next build/export path and leave one wrapper with an incomplete artifact copy.

## Verification

- `npm run sync:android` passed.
- `npm run sync:ios` passed.
- Shared web build remained valid after the wrapper refresh.

