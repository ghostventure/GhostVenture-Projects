# Ghost Surfer

Ghost Surfer is a simple Windows web browser shell built with Python, PySide6, and QtWebEngine.

It intentionally avoids copying the current mainstream browser look:

- left-side navigation rail instead of a common top toolbar
- custom "Ghost Surfer" start pane
- green, brass, and off-white visual system
- local bookmarks and history stored under the user's local app data
- standard browser functions: address/search, back, forward, reload, home, tabs, bookmarks, downloads
- familiar shortcuts: `Ctrl+L` address bar, `Ctrl+T` new tab, `Ctrl+W` close tab, `Ctrl+Shift+T` reopen tab, `Ctrl+R` reload, and `Esc` stop loading
- quick access palette (`Ctrl+K`) for actions, open tabs, bookmarks, recent pages, and Startpage searches
- page search (`Ctrl+F`) with next/previous matches and case sensitivity, PDF export (`Ctrl+P`), and a searchable shortcuts guide (`F1`)
- tab/session tools: restore the last session, save named sessions, pin and group tabs, mute tab audio, cycle tabs, split view, and choose recently closed tabs
- tab management: preview saved sessions before replacing, merging, or opening selected tabs; multi-select tabs for bulk pin, mute, group, or close actions; split workspaces can choose and swap pages
- per-tab Speed Mode exemptions and paused-tab indicators; drag-and-drop navigation for web addresses and text, with local file drops limited to PDF and common image formats
- context menus for links, images, selected text, and editable fields, plus video picture-in-picture controls
- bookmark and history tools: organize/search/import/export bookmarks, bookmark toolbar, searchable day-grouped history with selected-entry removal, and address suggestions
- local navigation preferences for search engine, home page, and startup behavior
- reader view, visible-page PNG capture, per-site zoom, distraction-free full screen (`F11`), and download-complete Open notifications
- accessibility options for larger interface text and high-contrast colors
- local data backend with atomic writes, integrity checks, corrupt-file recovery copies, schema versioning, and a storage summary
- debounced history persistence and background session checkpoints that preserve the selected, pinned, grouped, and muted tabs for recovery
- browser-data backup and restore for bookmarks, history, cookie decisions, privacy alerts, and download history
- a recovery center that previews saved recovery copies and saves a safety copy before restoring one
- searchable privacy alerts with tracker, permission, and IP-tripwire filters and individual dismissal
- privacy interceptor events are queued back to the UI thread and batched before alert/storage updates
- an alert-only IP tripwire that records recognized public-IP echo and IP-geolocation API requests without blocking them
- modular Ghost Guard policies for tracker requests, cookie decisions, permission requests, WebEngine privacy settings, and startup network routing
- visible labels on the navigation rail, consistent rounded controls and focus states, plus quick bookmark/download shortcuts (`Ctrl+D`, `Ctrl+J`)
- a cleaner address row and a categorized control center with separate General, Privacy, Display, Performance, and Tabs & Data pages
- a shorter primary navigation rail, with secondary actions grouped in the Library menu
- searchable Ghost Control pages with saved page selection and the `Ctrl+,` shortcut
- download progress and outcomes with open, show-folder, cancel, and clear-finished actions
- persisted download history for the latest 500 entries, including status, source address, and file availability
- no fixed 100-entry cap on saved bookmarks or history, plus user-selectable history retention (Forever, 30 days, 90 days, or 1 year)
- clear-data confirmation that also removes saved cookie decisions and Ghost Guard alerts while preserving bookmarks
- one-click-access controls for clearing website cookies and cache without deleting history, bookmarks, or saved cookie choices
- a bottom notification bar for cookie choices and privacy alerts, so browsing is not interrupted by privacy pop-ups
- one consolidated consent panel with per-site allow/block choices, an optional "Allow all sites" shortcut, and a global privacy setting to ask per site, allow first-party cookies, or block all cookies
- third-party tracking cookies and camera, microphone, location, notification, and clipboard permissions remain blocked regardless of the first-party cookie setting
- persistent page zoom from 80% through 150%, plus a Cookie Decisions manager for forgetting one site or all saved choices
- DuckDuckGo as the default home page; Startpage remains the default address-bar search provider
- optional Google Translate page opening with a per-use disclosure and confirmation that the page URL is sent to Google Translate
- ghost mode defaults: blocks common trackers, third-party cookies, geolocation, camera, microphone, notifications, clipboard access, and local font access
- Tor-aware startup: if Tor is listening on `127.0.0.1:9050` or `127.0.0.1:9150`, Ghost Surfer routes browser traffic through that local SOCKS endpoint and opens `https://check.torproject.org/` from the Tor button

Ghost Guard labels the current page as secure, upgrading, or local so the browsing state is easier to read at a glance.

The IP tripwire recognizes a limited list of common client-side IP lookup services and records an alert while allowing the request. It cannot detect a site using its own server logs or custom lookup APIs. Any site reached over a direct connection receives the public IP used for that connection; Tor or a VPN/proxy is needed to route traffic through another endpoint. Picture-in-picture depends on the page's video and Chromium allowing the page's Picture-in-Picture request. Google Translate is an external service; Ghost Surfer asks before sending the current page URL and chosen language.

For the control center, cookie choices, and privacy notice behavior, see the [user guide](docs/USER_GUIDE.md).

Run from source:

```powershell
py -3 ghost_surfer.py
```

Build an executable:

```powershell
py -3 -m pip install PySide6==6.12.0 PyInstaller
py -3 -m PyInstaller --clean -y --onedir --windowed --name "Ghost Surfer" ghost_surfer.py
```

The Windows package uses PySide6 6.12.0 with Qt WebEngine's bundled Chromium runtime. Qt 6.12 supports Windows 10 version 1809 and newer on x64 and Windows 11; Windows 10 support ends with the Qt 6.12 release line.

## Repository, manager, and website

- `install-manager/`: GS Install Manager source, bundled legal disclosures, build spec, and one-click distribution script. Build outputs and packaged binaries are not committed.
- `installer/`: per-user PowerShell installer and uninstaller scripts.
- `site/`: public website, policies, icons, release notes, and checksum manifest.
- `firebase.json` and `.firebaserc`: Firebase Hosting configuration for `ghost-surfer-browser`.
- `scripts/prepare-release-assets.ps1`: downloads and verifies public ZIP assets before deployment.

The large ZIP release assets stay on Firebase Hosting rather than being committed to GitHub. Their names and hashes are recorded in `site/downloads/SHA256SUMS.txt`.

To build the manager, install the pinned requirements above, then run:

```powershell
py -3 -m PyInstaller --clean -y "install-manager/GS Install Manager.spec" --distpath install-manager/dist --workpath install-manager/build
```

For the website, install Node.js, then run these commands from this folder:

```powershell
npm ci
npx firebase login
npm run deploy
```

The deploy command downloads the release ZIPs from the live site and checks their SHA-256 values before Firebase CLI publishes the website. This keeps the complete source project together without storing files larger than GitHub's individual-file size limit.
