# Inactivity Logout And OneID - 2026-04-22

## Summary

EstateHat now logs out signed-in users after 30 minutes with no browser activity.

## Changed

- Added a shared `useInactivityLogout` hook.
- Installed the hook in the Vite/mobile signed-in shell.
- Installed the hook in the Next.js `/home` signed-in shell.
- Updated the My Info identity panel to present the account marker as `OneID / One EstateHat`.

## Runtime Behavior

The 30-minute timer resets on common user activity such as click, key press, pointer/touch activity, scroll, wheel, and returning to a visible tab. When the timer expires, EstateHat calls the same logout path as the manual `Log out` button.
