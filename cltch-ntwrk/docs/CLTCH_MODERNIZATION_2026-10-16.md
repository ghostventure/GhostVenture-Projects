# CLTCH.NTWRK Modernization — 2026-10-16

## Delivered in this change

1. **Account-isolated profile drafts** — Host and performer drafts now use the signed-in Firebase UID in their storage key. The previous shared browser key is removed when a signed-in profile opens. Implemented in `app/profile-drafts.js`, `host-profile.html`, and `musician-profile.html`.
2. **Expiring profile drafts** — New draft records include a save timestamp and expire after seven days; expired records are removed when that profile is opened. Older records can be read once and are rewritten in the new envelope on the next save. Implemented in `app/profile-drafts.js`.
3. **Storage failure recovery** — Draft writing catches browser storage failures, keeps edits in memory for the open page, and shows a status message instead of interrupting the profile workflow. Implemented in `app/profile-drafts.js`.
4. **Page-exit draft flush** — Profile drafts save when the page becomes hidden or is being closed, in addition to the existing debounced field saves. Implemented in `app/profile-drafts.js`.
5. **Clear local draft control** — Both profile pages let the signed-in user clear their own unfinished browser draft after a confirmation. Implemented in `host-profile.html` and `musician-profile.html`.
6. **Self-service account copy** — Host and performer profile pages can download the signed-in account summary, role record, and host/performer profile documents as JSON. Firestore reads use only the current Firebase UID; Firestore timestamps are converted to ISO strings. The UI explicitly discloses that payout contact details may be included and asks before download. Implemented in `app/account-export.js`, `host-profile.html`, and `musician-profile.html`.
7. **Web-app installation flow** — The shared quick dock offers the browser installation prompt when available, detects an installed standalone session, and reports acceptance. Implemented in `site-init.js`.
8. **iOS and fallback installation guidance** — When a browser cannot provide an install prompt, the same control opens an accessible help dialog with Safari Add to Home Screen steps on iOS and general browser-menu guidance elsewhere. Implemented in `site-init.js`.
9. **Mutable-asset cache bound** — Unhashed JavaScript, CSS, SVG, and web manifests now have a five-minute cache lifetime instead of a year-long immutable cache. Explicit no-store rules follow the general rule so HTML, auth helpers, the service worker, and profile code are not cached. Verify live headers after deployment.
10. **Explicit ESM scope for browser helpers** — `app/package.json` declares the browser helper modules as ES modules so Node smoke imports do not use ambiguous module detection. Smoke runs now complete without module-type warnings.
11. **Safe portfolio link management** — Portfolio links are limited to 20 entries and bounded label/URL sizes. New and stored entries allow only HTTP(S) links without embedded credentials; duplicates are rejected, and external links open with no referrer. Implemented in `scripts/platform-components.js`.
12. **Installed-app task shortcuts** — The PWA manifest exposes same-origin shortcuts for posting a gig, finding gigs, and viewing bookings. `smoke:pwa-shortcuts` verifies the shortcut paths resolve to existing pages.
13. **Keyboard-managed accessibility dialog** — Opening the shared accessibility panel moves focus into it; Tab and Shift+Tab stay inside; Escape or Close restores focus to the invoking control. The dialog title is programmatically associated with the dialog.
14. **Export saved search presets** — Users can download up to eight current-page filter presets as JSON for portability between browsers.
15. **Validated saved search import** — Import accepts only matching-page versioned JSON under 64 KB, bounds preset names and search strings, validates existing filters/sorts, removes duplicate names, and caps storage at eight presets.
16. **Browser-local privacy clear** — Privacy settings can remove CLTCH-prefixed local/session storage and named caches after confirmation. It preserves Firebase auth and explicitly states that server account/profile/booking data is unaffected.
17. **Booking-specific preparation checklist** — Booking preparation and payment reminder checkboxes now use the booking ID as a storage scope, so one booking's checks do not mark another complete. The UI states these are private browser reminders, not shared confirmations.
18. **Private travel-fee estimate** — Performers can calculate a round-trip USD estimate from manually entered route miles and a fee rate; it validates bounds, rounds to cents, and does not store or send the values.
19. **Reduced-motion control** — Accessibility settings can enable a persistent app-level reduced-motion override or return to the operating-system preference. It covers scrolling, transitions, and animations.
20. **Payout detail screen privacy** — Host and performer payout handles are masked by default and are re-masked when the page loses focus or becomes hidden; users can temporarily reveal them with an accessible control.
21. **Duplicate gig warning** — Before geocoding and posting, hosts see a confirmation if an existing open/accepted gig has the same host, venue, location, date, and time. Canceled/expired/completed gigs do not trigger the warning; the host may continue if the duplicate is intentional.
22. **Weekly/biweekly repeat-post batch** — Hosts can create up to 12 separate gig posts with weekly or two-week cadence in one atomic Firestore batch. Date generation validates real calendar dates and leap/year boundaries. The page explains that entries are separate posts, not a shared series record.
23. **Saved host gig templates** — Hosts can save and reuse up to eight gig detail templates scoped to their signed-in UID in this browser. Templates omit event date/time and do not sync across devices. Storage limits and malformed data are handled without treating a local save as a server backup.
24. **Repeat-post cost preview** — The host composer calculates performer pay, rounded per-event processing fees, and the aggregate total for the selected 1–12 dates before posting.
25. **FAQ keyboard access** — Public FAQ navigation has a skip link; accordion questions are native buttons with exposed expanded state; reduced-motion and visible-focus styles cover the page controls.
26. **FAQ search and bulk controls** — Search covers question and answer text, hides empty groups, announces match counts/no-results, and offers expand-all and collapse-all controls.
27. **Matched Gigs keyboard search** — The queue search has a descriptive label and shortcut; Escape clears a focused query, and the clear button restores focus to search.
28. **Matched Gigs live status and mobile controls** — Result counts update as queue cards change, filters expose pressed state, and controls retain visible focus with a 44px mobile clear target.
29. **Public performer profile safety** — Profile and review strings are escaped before HTML rendering, and booking links encode performer IDs.
30. **Bounded review history** — Public profiles fetch at most 50 newest reviews and label the sample accurately.
31. **Profile loading recovery** — Review failures leave the profile usable with a clear review error; profile fetch failures show a separate recovery state.
32. **Profile sharing** — Users can share through the device share sheet or copy the current link, with an accessible status message.

## Operational catalog accuracy

`app/operational-components.js` previously generated 5,000 repeated placeholder records from a small set of domain and lane names. The Ops page now lists only its seven wired browser-local helpers and states that it has zero live integrations. The shared 145-entry catalog likewise contained ideas rather than executable features: its former Enable/Run controls only wrote local activity markers. It is now labeled as a feature-concept catalog with navigation to related pages only. The host posting score is now clearly labeled advisory, and the fake delegate email list was removed because it neither sent invitations nor granted access. These are truthfulness and scope corrections, not feature additions. Issue notes and checklist state are local to the current browser and are not production case management.

## Verification

- `npm run smoke:components` — passed; confirms seven real local helpers, six domains, and zero live integrations.
- `npm run smoke:dispatch-catalog` — checks the 145-entry list is presented as proposed concepts and exposes no fake install/run actions.
- `npm run smoke:host-readiness` — checks the posting score is advisory and no fake delegate access controls are exposed.
- `npm run smoke:local-data` — verifies CLTCH local keys/caches are cleared while Firebase auth and unrelated app data remain.
- `npm run smoke:travel-fee` — verifies round-trip calculation, cent rounding, and invalid input bounds.
- `npm run smoke:a11y-motion` — checks the system default, stored override, and reduced-motion CSS path are present.
- `npm run smoke:sensitive-fields` — checks default masking, deliberate reveal, and re-masking on blur/hidden state.
- `npm run smoke:duplicate-gig` — checks duplicate matching, host scoping, and terminal-state exclusions.
- `npm run smoke:gig-series` — checks recurrence date math, date boundaries, cadence, and 12-post limits.
- `npm run smoke:gig-templates` — checks host UID isolation, eight-template limit, malformed storage recovery, and UI wiring.
- `npm run smoke:faq-accessibility` — checks skip navigation, responsive controls, reduced motion, labeled search, live results, and keyboard-operable disclosures.
- `npm run smoke:matched-gigs-accessibility` — checks labels, live results, filter state, clear/search keyboard paths, focus, and mobile target size.
- `npm run smoke:gig-budget` — checks fee rounding, aggregate multi-date totals, valid counts, and host preview wiring.
- `npm run smoke:performer-public-profile` — checks output escaping, review bounds, error states, link sharing, and encoded booking targets.
- `npm run smoke:plugz` — passed.
- `npm run smoke:draft-protection` — passed; confirms UID isolation, seven-day expiry, and blocked-storage recovery.
- `npm run smoke:account-export` — passed; confirms UID-scoped reads, timestamp conversion, file download behavior, and object-URL cleanup.
- `npm run smoke:hosting-policy` — passed; checks the target and header-rule order, short cache lifetime, and no-store overrides.
- `npm run smoke:portfolio-links` — passed; rejects script/data URLs, relative links, embedded credentials, empty input, and oversize URLs.
- `npm run smoke:pwa-shortcuts` — verifies same-origin PWA shortcut targets exist.
- Chromium keyboard smoke — verified initial dialog focus, Tab wrapping, Escape close, and focus restoration.
- Chromium catalog smoke — verified all 145 entries are labeled proposed concepts, no install/run controls remain, and related-page navigation remains available.
- Chromium saved-search transfer smoke — verified JSON export and import, duplicate handling, malformed-file rejection, and preset limits.
- Privacy page clear control is user-confirmed and reports partial storage/cache failures instead of claiming a complete clear.
- Chromium booking checklist smoke — verified checking one booking leaves another booking's checklist unchecked and the first booking restores its own state.
- Chromium accessibility smoke — verified the reduced-motion control toggles the root setting, persists it, reflects state with `aria-pressed`, and resets to system preference.
- `node --check` passed for shared `site-init.js`, the Ops catalog, and new smoke scripts.
- `package.json` and Firebase JSON configuration parsed successfully.
- `npm run build` — passed on Next.js 14.2.35. Firebase Hosting remains a separate static-root deployment.

## Feature target and current status

The user requested 200 additional mixed features. This change currently delivers **40** distinct capabilities, including account workflows, host templates, repeat posting and cost preview, FAQ and matched-gig accessibility, public profile safety and sharing, app installation and shortcuts, payout detail screen privacy, portable saved-search presets, booking-specific preparation checklists, browser-local privacy controls, travel estimates, cache policy, and portfolio URL safety. The 5,000 generated Ops placeholders and 145 proposed feature concepts were not counted. The remaining target is not complete; the feature roadmap in `docs/FEATURE_AUDIT_200.md` separates the implemented evidence from candidate work and should not be read as a claim that unchecked items ship.

## Deployment and publishing boundary

- Existing Firebase project: `cltch-ntwrk-social` (project number `566614252202`), Hosting site `cltch-ntwrk-social`.
- The CLTCH deploy record identifies `blacklionmediastudio@gmail.com`; read-only project listing under that account confirmed the project is active.
- The existing GitHub subtree is under `cltch-ntwrk` on the `origin/overhead-import` line. Work is isolated on `codex/cltch-modernization-20261016`.
- Deployment and push status are recorded separately after those actions complete. No Functions, Firestore, or Storage deployment is implied by a Hosting deployment.
