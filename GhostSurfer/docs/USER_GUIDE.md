# Ghost Surfer User Guide

## A consistent browsing layout

The left navigation rail keeps the main browser actions in one place. Secondary actions such as Tor check, downloads, and clearing data are grouped in the **Library** menu. The right-side **Ghost Control** panel is split into **General**, **Privacy**, **Display**, **Performance**, and **Tabs & Data** pages, so related settings and tools are easier to find without scrolling through one long list.

Use **Ctrl+,** to open or close Ghost Control. Its search box filters settings and tools across all five pages, reports how many sections match, and jumps to the first matching page. Your last selected page is restored the next time you open Ghost Control. Use **Ctrl+L** to focus the address bar, **Ctrl+T** to open a tab, **Ctrl+W** to close one, **Ctrl+Shift+T** to reopen a closed tab, **Ctrl+R** to reload, **Ctrl+D** to bookmark the current page, **Ctrl+J** to open downloads, and **Esc** to stop loading.

Press **Ctrl+K** to open Quick access. Type to filter browser actions, open tabs, bookmarks, and recent pages. Choose a result with Enter; if there are no matching saved items or actions, Enter searches Startpage for the typed text.

Use **Ctrl+F** to find text on the current page. Enter moves to the next match, **Shift+Enter** moves to the previous match, and **Match case** makes the search case-sensitive. Press **Esc** to close Find in Page. Use **Ctrl+P** to save the current page as a PDF, and **F1** to open the searchable keyboard shortcuts guide.

## Tabs and sessions

Right-click a tab for pinning, grouping, muting, duplicating, closing, split view, and a **Keep active in Speed Mode** exemption. Pinned tabs cannot be closed until unpinned. Tab hover shows the title, address, group, mute/pin state, and whether Speed Mode paused the tab. Speed Mode freezes inactive tabs; selecting one resumes it. Tabs with the exemption remain active while Speed Mode is on. Use **Ctrl+Tab** and **Ctrl+Shift+Tab** to cycle tabs. The **Tabs & Data / Tab Actions** section in Ghost Control opens named sessions and recently closed tabs.

**Open split view** creates a separate split workspace. Choose any open tab for each side, swap sides, and add either pane back to the main tab strip. The workspace loads each tab's current address in a new view; it does not clone the exact scroll position or live page state.

Use **Manage saved sessions** to preview a named session's tabs. You can replace the current set, merge the saved tabs into it, or open only the checked entries. Replacing removes the current tabs from the window, so choose Merge or Open checked tabs when you want to keep them. **Select tabs for bulk actions** offers multi-select pin, mute, group, and close actions.

Ghost Surfer restores the previous tab session at startup by default. Choose another startup behavior under **General → Search & Startup** in Ghost Control. Named sessions can be saved, restored, and deleted under **Tabs & Data → Tab Actions**.

## Bookmarks, history, and navigation

The **Tabs & Data / Library Tools** section in Ghost Control can search, rename, delete, and folder-organize bookmarks, and import or export Netscape-format bookmark HTML. Unfiled bookmarks appear on the bookmarks toolbar; foldered bookmarks are grouped into menus. Address-bar suggestions match bookmark and history titles or addresses. Bookmarks and history no longer have the previous 100-entry storage cap. Under **Tabs & Data / Browser Data**, choose **Keep history**: Forever, 30 days, 90 days, or 1 year. The selected retention period is applied as new pages are recorded and when you change the setting; you can also remove selected history entries at any time.

History is searchable and grouped by visit date. Select one or more history entries and choose **Remove selected history entries** to delete them. History saves are batched in the background to keep page navigation responsive. Open tabs, the selected tab, pinned/grouped state, and mute state are checkpointed in the background so the existing restore-session behavior can recover recent state after an unexpected exit. DuckDuckGo is the default home page; Startpage remains the default address-bar search provider. Existing settings that used Startpage as the home page are moved to DuckDuckGo during upgrade, while the saved search provider remains unchanged. Search & Startup settings let you choose Startpage, DuckDuckGo, Brave Search, or Bing, set a home page, and choose what opens at startup.

## Page and accessibility tools

Open **Reader view** from Ctrl+K to show the page's readable text in a simplified layout. **Capture page screenshot** saves the visible viewport as PNG. Under **Display / Page & Accessibility**, set zoom for the current website or reset it to the default. **F11** hides browser controls and enters distraction-free full screen; press **Esc** to exit. Completed downloads show an in-app notification with an **Open** button. The page right-click menu offers actions for links, images, selected text, and editable fields. Dropping a URL or text onto the page navigates to it or searches it. Dropped local files are limited to PDF and common image formats; other file types are rejected.

The same Page & Accessibility section can enlarge interface text and enable high-contrast colors. These preferences are saved locally.

## Browser-data backup and recovery

Open **Ghost Control / Tabs & Data / Browser Data** to see the local bookmark/history footprint, export a JSON backup, choose history retention, or open **Recover from a saved copy**. Restoring a backup asks for confirmation and first writes a safety copy beside Ghost Surfer's local data file. Backups contain bookmarks, history, cookie choices, privacy alerts, and download history; they do not contain site cookies or cache. Backup files are readable JSON, so keep them somewhere private. The recovery center lists available copies with dates and a data-count preview; restoring a selected copy also saves a safety copy of current data first. Copies that cannot be read or previewed cannot be restored from that list.

Ghost Surfer writes local browser data through a temporary file and atomic replacement. If the saved data is corrupt or fails its integrity check, the app preserves a recovery copy before creating fresh data. Privacy network events are handled on the UI thread and grouped before they update alerts.

## Cookie and privacy choices

Cookie prompts and privacy alerts appear in one notification bar at the bottom of the browser window instead of opening separate pop-up dialogs. When a site asks to store first-party cookies, choose **Allow this site** or **Block this site** in that bar. The choice is saved for that site. If another site's cookie request is waiting, its notice appears in the same bar after the current decision.

To set the default for all sites, open **Ghost Control → Privacy** and use **Cookies & Consent**:

- **Ask once per site** keeps the per-site prompt behavior.
- **Allow first-party cookies** allows first-party cookies across sites without prompting.
- **Block all cookies** rejects cookies across sites.

The **Allow all sites** button in a cookie notice is a shortcut to the global **Allow first-party cookies** setting. Third-party cookies remain blocked under every option. Camera, microphone, location, notification, and clipboard requests remain blocked; the cookie setting does not grant these permissions.

The left rail has a **Clear cache** button, and the same action is available under **Tabs & Data → Maintenance** and in Quick Access (`Ctrl+K`). It clears website cookies and cached web files while keeping history, bookmarks, and saved per-site cookie choices. The action asks for confirmation because clearing cookies may sign you out of sites. **Clear cookies, cache, history** remains available separately to remove history, saved cookie choices, and recent privacy alerts while preserving bookmarks. The **Cookie Decisions** list in Ghost Control → Privacy lets you forget the selected site's saved decision or clear all saved decisions. The privacy status area shows the current cookie policy, blocked tracker count, privacy alerts, IP tripwire state, and Tor connection state.

The Privacy page's alert filter can show all alerts, tracker alerts, permission alerts, or IP-tripwire alerts. Select one or more and choose **Dismiss selected alerts** to remove those records without clearing the remaining alerts or other browser data. The IP tripwire is alert-only. It recognizes a limited set of common public-IP echo and IP-geolocation API requests, records the requesting site and endpoint, and allows the request to continue. It cannot detect server-side logging, custom lookup endpoints, or every way a site might infer location. A site reached directly sees the public IP used for that connection; use a Tor, VPN, or proxy route to send a different network IP.

## Appearance and browsing controls

Choose an accent color under **Display → Theme Color** in Ghost Control; the change is applied immediately. **Page Zoom** offers 80%, 90%, 100%, 110%, 125%, and 150%. These preferences are saved locally. Performance toggles are under **Performance**, while tab actions, downloads, bookmarks, and history are under **Tabs & Data**.

Downloads show progress and completion state and keep the latest 500 entries across browser restarts, including source URL and file path. Select an item to open the file or its containing folder when available; an active download can be canceled, and finished entries can be cleared from the list. If a saved file was moved or deleted, the row indicates that the file is missing and Open is unavailable.

Speed Mode displays how many background tabs are paused. A paused tab resumes when selected. Right-click a tab and select **Keep active in Speed Mode** to exempt it, for example when a site must continue an active task in the background.

Right-click a page and choose **Picture in picture**, use **Alt+P**, or select it from Ctrl+K. Ghost Surfer asks the page's video element to enter or leave Picture-in-Picture. Availability depends on the website and Chromium's support for that video; a site can refuse the request, and a page without a ready video cannot open the player.

For translation, choose **Translate this page** from the page menu or Ctrl+K, select a language, and review the confirmation. If you continue, Ghost Surfer opens Google Translate with the current page URL and target language. Google receives that URL; do not use the feature with private or sensitive URLs. Translation is provided by Google, not locally by Ghost Surfer.

## Scope of privacy controls

Ghost Surfer's controls describe browser behavior; they cannot guarantee that a site will not identify a user through its own account, content, or other browser signals. Allowing first-party cookies may be needed for sign-in, carts, and preferences. Tor routing is available only when a local Tor service is listening on the supported port when Ghost Surfer starts.
