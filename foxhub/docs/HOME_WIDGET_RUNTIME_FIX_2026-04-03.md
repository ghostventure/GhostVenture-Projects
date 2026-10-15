# FoxHub Home Widget Runtime Fix

Date: 2026-04-03

## Summary

FoxHub could load `Chats`, `Market`, and the other tabs while `Home` still appeared empty.

This was not a general app-load failure. The issue was isolated to the `HomeWorkspace` render path inside `src/FoxHubShell.jsx`.

## Observed behavior

- `https://foxhub-superapp.web.app` loaded normally
- non-Home tabs remained usable
- switching to `Home` left the content area appearing empty

## Actual root cause

`HomeWorkspace` directly used actions that were not fully wired through the shell layer.

Two separate missing-prop issues were confirmed during debugging:

1. the Home render branch in `src/FoxHubShell.jsx` was not passing:
   - `openCommunityChannel`
   - `resolveLocalListing`
   - `updateCreatorOrder`
   - `logDemandSignal`
2. `src/App.jsx` passed `startShakeMatch` and `logFileTransfer` into `FoxHubShell`, but `FoxHubShell` did not include them in its top-level function signature

The critical live failure reproduced in Chromium was:

- `ReferenceError: startShakeMatch is not defined`

That error only triggered when `Home` rendered because the shake widget belongs to the Home workspace.

## Fix applied

Updated `src/FoxHubShell.jsx` in two places:

- added the missing Home-specific props to the `HomeWorkspace` invocation
- added `startShakeMatch` and `logFileTransfer` to the top-level `FoxHubShell` function signature

## Verification

Verified in three steps:

1. `npm run build`
2. local Chromium test against the rebuilt app with a direct `Home` tab click
3. live Chromium test against `https://foxhub-superapp.web.app` after deploy

Confirmed visible Home content after the fix included:

- `Simple overview`
- `Quick services`
- `Thread snapshot`
- `Payments wallet`
- `People nearby & matches`
- `Official hubs`

## Recovery guidance for future tab-only failures

If one FoxHub tab is empty while the rest of the app still works:

1. isolate the problem to the specific workspace component instead of treating it like a full boot failure
2. verify every action used inside that workspace is accepted by `FoxHubShell`
3. verify the workspace invocation actually passes those props through
4. test the live tab directly in Chromium after deploy instead of relying only on build success
