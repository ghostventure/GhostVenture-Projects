# Ghost Surfer

Ghost Surfer is a simple Windows web browser shell built with Python, PySide6, and QtWebEngine.

It intentionally avoids copying the current mainstream browser look:

- left-side navigation rail instead of a common top toolbar
- custom "Ghost Surfer" start pane
- green, brass, and off-white visual system
- local bookmarks and history stored under the user's local app data
- standard browser functions: address/search, back, forward, reload, home, tabs, bookmarks, downloads
- familiar shortcuts: `Ctrl+L` address bar, `Ctrl+T` new tab, `Ctrl+W` close tab, `Ctrl+Shift+T` reopen tab, `Ctrl+R` reload, and `Esc` stop loading
- visible labels on the navigation rail, consistent rounded controls and focus states, plus quick bookmark/download shortcuts (`Ctrl+D`, `Ctrl+J`)
- a cleaner address row and scrollable control center with consistent section spacing and paired download actions
- download progress and outcomes with open, show-folder, cancel, and clear-finished actions
- clear-data confirmation that also removes saved cookie decisions and Ghost Guard alerts while preserving bookmarks
- a bottom notification bar for cookie choices and privacy alerts, so browsing is not interrupted by privacy pop-ups
- one consolidated consent panel with per-site allow/block choices, an optional "Allow all sites" shortcut, and a global privacy setting to ask per site, allow first-party cookies, or block all cookies
- third-party tracking cookies and camera, microphone, location, notification, and clipboard permissions remain blocked regardless of the first-party cookie setting
- persistent page zoom from 80% through 150%, plus a Cookie Decisions manager for forgetting one site or all saved choices
- Startpage.com as the default home page and search provider
- ghost mode defaults: blocks common trackers, third-party cookies, geolocation, camera, microphone, notifications, clipboard access, and local font access
- Tor-aware startup: if Tor is listening on `127.0.0.1:9050` or `127.0.0.1:9150`, Ghost Surfer routes browser traffic through that local SOCKS endpoint and opens `https://check.torproject.org/` from the Tor button

Ghost Guard labels the current page as secure, upgrading, or local so the browsing state is easier to read at a glance.

For the control center, cookie choices, and privacy notice behavior, see the [user guide](docs/USER_GUIDE.md).

Run from source:

```powershell
py -3 ghost_surfer.py
```

Build an executable:

```powershell
py -3 -m PyInstaller --clean -y --onedir --windowed --name "Ghost Surfer" ghost_surfer.py
```
