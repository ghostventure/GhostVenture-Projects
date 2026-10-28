# Ghost Surfer User Guide

This guide describes the Windows browser in release 0.2.0. Use the contents list to jump to a task.

## Contents

- [Find controls and common shortcuts](#find-controls-and-common-shortcuts)
- [Browse, search, and manage tabs](#browse-search-and-manage-tabs)
- [Bookmarks and history](#bookmarks-and-history)
- [Privacy and site compatibility](#privacy-and-site-compatibility)
- [Downloads and browser data](#downloads-and-browser-data)
- [Display and accessibility](#display-and-accessibility)
- [Page tools and external services](#page-tools-and-external-services)
- [Updates and privacy limits](#updates-and-privacy-limits)

## Find controls and common shortcuts

The left navigation rail contains the main browser actions. The **Library** menu groups secondary actions such as Tor check and downloads. Open **Ghost Control** with **Ctrl+,**. Its pages group options under **General**, **Privacy**, **Display**, **Performance**, and **Tabs & Data**. Use the search field to filter settings and tools; Ghost Control remembers the last page you selected.

| Shortcut | Action |
| --- | --- |
| Ctrl+L | Focus the address bar |
| Ctrl+T / Ctrl+W | Open / close a tab |
| Ctrl+Shift+T | Reopen a closed tab |
| Ctrl+R / Esc | Reload / stop loading |
| Ctrl+D / Ctrl+J | Bookmark the page / open downloads |
| Ctrl+K | Open Quick Access |
| Ctrl+F | Find text on the current page |
| Ctrl+P | Save the current page as a PDF |
| Ctrl+Tab / Ctrl+Shift+Tab | Move between tabs |
| F1 | Open the searchable shortcuts guide |
| F11 | Toggle distraction-free view; Esc exits |

Quick access filters actions, open tabs, bookmarks, and recent pages. If there is no matching action or saved item, Enter searches Startpage by default. The home page is DuckDuckGo; the address-bar search provider is a separate setting.

In Find in Page, Enter goes to the next match and Shift+Enter goes to the previous one. **Match case** makes the search case-sensitive; Esc closes the search.

## Browse, search, and manage tabs

Right-click a tab for actions such as duplicate, pin, group, mute, split view, and **Keep active in Speed Mode**. Pinned tabs must be unpinned before they can be closed. Speed Mode pauses inactive tabs; selecting a paused tab resumes it. The exemption keeps a selected tab active. **Tabs & Data > Tab Actions** also opens named sessions and recently closed tabs.

Use **Manage saved sessions** to preview a session and replace the current tabs, merge the saved tabs, or open only selected tabs. Replacing removes the current tab set. Split view opens two selected pages in a separate workspace; it loads their addresses in new views and does not preserve the exact scroll position or live page state.

Ghost Surfer restores the previous session at startup by default. Change this under **General > Search & Startup**. After an unclean exit, a recovery dialog lets you choose tabs to reopen. Exact duplicate URLs are listed once. URLs with query or fragment data start unchecked, and those values are not shown in the dialog. You can later choose **Restore previous session** from Quick Access to restore unchecked tabs.

## Bookmarks and history

Open **Tabs & Data > Library Tools** to search, rename, delete, and organize bookmarks, or import/export Netscape-format bookmark HTML. Unfiled bookmarks appear on the bookmarks toolbar; bookmarks in folders are grouped into menus. Address suggestions can match bookmark and history titles or addresses.

History is searchable and grouped by visit date. Select entries and choose **Remove selected history entries** to delete them. Under **Tabs & Data > Browser Data**, choose a retention period: Forever, 30 days, 90 days, or 1 year. The selected limit applies when history is recorded and when you change the setting.

## Privacy and site compatibility

Cookie prompts and privacy alerts share the notification bar at the bottom of the browser. For first-party cookies, choose **Allow this site** or **Block this site**. To set the default for all sites, open **Ghost Control > Privacy > Cookies & Consent**:

- **Ask once per site** prompts for a site decision.
- **Allow first-party cookies** allows first-party cookies without prompting.
- **Block all cookies** rejects cookies.

Third-party tracking cookies and sensitive permissions, including camera, microphone, location, notifications, and clipboard access, remain blocked. Allowing first-party cookies can keep sign-ins, carts, and site preferences working; blocking them may sign you out or break those features.

For a temporary compatibility change, right-click an HTTP or HTTPS page and choose **Allow JavaScript for this site until Ghost Surfer closes** or **Load images for this site until Ghost Surfer closes**. The **Site controls** status chip shows overrides for the current site. The change lasts until Ghost Surfer closes. A reload may be needed. Global JavaScript or image restrictions can break sign-in, video, or interactive controls.

Use **Tabs & Data > Maintenance > Clear cookies & cache** to remove website cookies and cached files while keeping history, bookmarks, and saved per-site cookie decisions. **Clear cookies, cache, history** also clears history, saved cookie decisions, and recent privacy alerts while preserving bookmarks. The **Cookie Decisions** list under Privacy lets you forget one site's decision or all decisions.

The IP tripwire reports certain recognized public-IP echo and IP-geolocation requests and allows them to continue. It cannot identify every lookup service, custom endpoint, server-side logging, or other way a site may infer location. A site reached directly sees the public IP used for the connection. Tor, a VPN, or a proxy changes the network route; Ghost Surfer's privacy settings do not make browsing anonymous.

## Downloads and browser data

The Downloads panel shows progress and recent results, including the source URL and saved file path. Select an entry to open the downloaded file or its folder; cancel an active transfer; clear finished entries from the list; or choose **Delete file & record**. Deletion asks for confirmation before removing an inactive file and its history entry. If the file is already missing, the action removes only the record. Ghost Surfer keeps up to 500 download-history entries.

Under **Tabs & Data > Browser Data**, review the local data summary, export a JSON backup, set history retention, or use **Recover from a saved copy**. A backup contains bookmarks, history, cookie decisions, privacy alerts, and download history. It does not contain website cookies or cache. Backups are readable JSON; store them privately. Restoring a copy asks for confirmation and saves a safety copy of current data first.

**Reset browser profile** makes a dated safety copy, then resets settings, history, site cookie decisions, privacy alerts, download records, and saved sessions. You can choose to preserve bookmarks. It also clears website cookies and cache, so you may need to sign in again.

## Display and accessibility

Under **Display > Page & Accessibility**, set a saved zoom for the current site or use the default zoom. **Page Zoom** sets the general zoom; **Interface text size** changes Ghost Surfer's controls. **High contrast colors** and **Reduce interface motion** are also available. Reduced motion affects browser scrolling where supported; it does not change animations inside websites. Keyboard focus has a visible highlight, and the tabs, address bar, and loading status expose screen-reader names.

Use **Reader view** to show readable page text in a simplified layout, or **Capture page screenshot** to save the visible viewport as PNG. The page context menu also offers actions for links, images, selected text, and editable fields. Dropping a URL or text onto a page navigates to it or searches it. Local file drops are limited to PDF and common image formats.

## Page tools and external services

Choose **Picture in picture** from the page context menu, Quick Access, or **Alt+P**. The site and Chromium must support the request and have a ready video; a site can refuse it.

For translation, choose **Translate this page**, select a language, and review the confirmation. If you continue, Ghost Surfer opens Google Translate with the current page URL and target language. Google receives that URL. Avoid using the feature with private or sensitive URLs; translation is provided by Google, not locally.

## Updates and privacy limits

Under **General > Ghost Surfer Updates**, press **Check for updates** to query the configured GitHub releases. The updater ignores unrelated products in the shared release list and looks for a compatible Ghost Surfer package. If one is available, Ghost Surfer shows the release notes, downloads and verifies the package, then asks before closing and restarting to apply it. Checking is user-initiated. When the browser is not installed in the standard per-user folder, use GS Install Manager to install or update it.

Ghost Surfer's controls describe browser behavior. They cannot prevent identification through a site account, information you submit, server-side logs, or other browser signals. Tor routing is available only when a local Tor service is listening on a supported port when Ghost Surfer starts.
