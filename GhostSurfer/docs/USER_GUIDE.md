# Ghost Surfer User Guide

## A consistent browsing layout

The left navigation rail keeps the main browser actions in one place. Each icon has a text label, and the address and tab area uses consistent control sizes, spacing, rounded corners, and focus states. The right-side **Ghost Control** panel is scrollable, so privacy, appearance, performance, tab, and library controls stay in a single organized place.

Use **Ctrl+L** to focus the address bar, **Ctrl+T** to open a tab, **Ctrl+W** to close one, **Ctrl+Shift+T** to reopen a closed tab, **Ctrl+R** to reload, **Ctrl+D** to bookmark the current page, **Ctrl+J** to open downloads, and **Esc** to stop loading.

## Cookie and privacy choices

Cookie prompts and privacy alerts appear in one notification bar at the bottom of the browser window instead of opening separate pop-up dialogs. When a site asks to store first-party cookies, choose **Allow this site** or **Block this site** in that bar. The choice is saved for that site. If another site's cookie request is waiting, its notice appears in the same bar after the current decision.

To set the default for all sites, open **Ghost Control** and use **Cookies & Consent**:

- **Ask once per site** keeps the per-site prompt behavior.
- **Allow first-party cookies** allows first-party cookies across sites without prompting.
- **Block all cookies** rejects cookies across sites.

The **Allow all sites** button in a cookie notice is a shortcut to the global **Allow first-party cookies** setting. Third-party cookies remain blocked under every option. Camera, microphone, location, notification, and clipboard requests remain blocked; the cookie setting does not grant these permissions.

The **Cookie Decisions** list in Ghost Control lets you forget the selected site's saved decision or clear all saved decisions. **Clear cookies, cache, history** also clears saved cookie decisions and recent privacy alerts while preserving bookmarks. The privacy status area shows the current cookie policy, blocked tracker count, privacy alerts, and Tor connection state.

## Appearance and browsing controls

Choose an accent color under **Theme Color** in Ghost Control; the change is applied immediately. **Page Zoom** offers 80%, 90%, 100%, 110%, 125%, and 150%. These preferences are saved locally. The same panel groups performance toggles, tab actions, downloads, bookmarks, history, and recent privacy alerts.

Downloads show progress and completion state. Select a completed item to open it or its containing folder; an active download can be canceled, and finished entries can be cleared from the list.

## Scope of privacy controls

Ghost Surfer's controls describe browser behavior; they cannot guarantee that a site will not identify a user through its own account, content, or other browser signals. Allowing first-party cookies may be needed for sign-in, carts, and preferences. Tor routing is available only when a local Tor service is listening on the supported port when Ghost Surfer starts.
