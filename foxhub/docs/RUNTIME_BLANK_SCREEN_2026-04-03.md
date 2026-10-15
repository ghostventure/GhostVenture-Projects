# FoxHub Runtime Blank Screen Fix

Date: 2026-04-03

## Summary

FoxHub deployed successfully but rendered a blank page on Hosting.

This was not a build failure and not a general React mount failure. The live root stayed empty because a top-level `ReferenceError` stopped `App` before React could mount the shell.

## Observed behavior

- `https://foxhub-superapp.web.app` showed a blank page
- the hosted DOM contained `<div id="root"></div>` with no mounted UI
- earlier guesses about loading state and async repository initialization were not the real blocker

## Actual root cause

`src/App.jsx` passed three props into `FoxHubShell` that were not destructured from `useFoxHubStore()`:

- `resolveLocalListing`
- `updateCreatorOrder`
- `logDemandSignal`

Because those identifiers were referenced directly in JSX without being defined in `App`, the browser threw a top-level runtime error before React could mount:

- `ReferenceError: resolveLocalListing is not defined`

That exception was verified with headless Chromium against the live deployed site.

## Fix applied

Updated `src/App.jsx` to actually destructure the missing store actions from `useFoxHubStore()` before passing them into `FoxHubShell`.

## Secondary hardening added during debugging

The following guards were also added while tracing the incident:

- `src/FoxHubShell.jsx`
  - launch context now safely handles missing `selectedThread` and `activeCircle`
- `src/App.jsx`
  - invalid persisted `activeTab` values now fall back to `chat`
- `src/useFoxHubStore.js`
  - startup now has a synchronous local seed plus explicit `loadState()` fallback so the app does not sit in the boot shell waiting on subscription timing

Those changes were not the primary root cause, but they make startup more resilient.

## Verification method

The critical verification step was checking the live deployed page directly with headless Chromium instead of relying only on builds:

1. dumped the live DOM and confirmed `#root` was empty
2. captured Chromium console output against the live Hosting URL
3. identified `ReferenceError: resolveLocalListing is not defined`
4. patched `src/App.jsx`
5. rebuilt and redeployed

## Recovery guidance for future blank pages

If FoxHub builds but the site is blank:

1. inspect the live hosted page, not just local build output
2. check browser console errors first
3. verify every prop passed from `App` into `FoxHubShell` is actually defined in the `useFoxHubStore()` destructure
4. verify `currentView`, `selectedThread`, and `activeCircle` paths are null-safe
5. only after that investigate repository initialization timing
