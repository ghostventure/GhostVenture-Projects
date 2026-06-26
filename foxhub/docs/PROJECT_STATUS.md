# FoxHub Project Status

Last updated: 2026-06-12

## Current state

FoxHub is currently an interactive FoxHub alpha with a Next.js web/backend foundation and a Vite-built static Hosting bundle.

It includes:

- desktop-web local fallback persistence
- optional Firebase-backed runtime
- native mobile lock mode when Firebase is not configured
- lazy-loaded React app shell
- lazy-loaded Firebase repository path
- deployed Firebase Hosting target
- preferred public domain setting for `FoxHub.com`
- Android debug APK output for direct testing

The project is not production-ready, but it is no longer a static mock.

## 2026-06-12 foxhub-superapp Hosting undeploy

The prior `foxhub-superapp` Firebase Hosting site was disabled after the copy to `foxhub-c984b`.

- Disabled Hosting site `foxhub-superapp`.
- Verified `https://foxhub-superapp.web.app/` returns `404 Not Found`.
- Verified the active copied site `https://foxhub-c984b.web.app` still passes live smoke.
- Detailed record: `docs/FOXHUB_SUPERAPP_UNDEPLOY_2026-06-12.md`

## 2026-06-12 foxhub-superapp redirect

The prior `foxhub-superapp` Firebase Hosting site now redirects old traffic to the active `foxhub-c984b` site.

- Deployed a redirect-only Hosting config to `foxhub-superapp`.
- Old paths return `301` to `https://foxhub-c984b.web.app`.
- Verified `https://foxhub-c984b.web.app` still passes live smoke.
- Detailed record: `docs/FOXHUB_SUPERAPP_REDIRECT_2026-06-12.md`

## 2026-06-12 foxhub-c984b project copy

FoxHub was copied to Firebase project `foxhub-c984b`.

- Created a `FoxHub` Web App in `foxhub-c984b`.
- Built and deployed the static Hosting bundle with `foxhub-c984b` Firebase runtime config.
- Deployed Firestore rules after the default Firestore database was enabled.
- Live URL: `https://foxhub-c984b.web.app`
- Live smoke passed on `/`, `/signin`, `/management`, and `/feedback`.
- Latest verified copied Hosting timestamp: `Fri, 12 Jun 2026 13:32:14 GMT`.
- Detailed record: `docs/FOXHUB_C984B_PROJECT_COPY_2026-06-12.md`

## 2026-06-12 Runtime reliability hardening

FoxHub now has stronger client-side recovery for launch traffic.

- Added runtime error boundaries around the app and the authenticated shell.
- Added retry and one-time reload behavior for lazy chunk failures after deploys.
- Added local runtime event logging for browser errors and unhandled rejections.
- Added `npm run smoke:live` for live route and bundle-marker verification after deploy.
- Deployed to Firebase Hosting and verified live `/`, `/signin`, `/management`, and `/feedback` at `Fri, 12 Jun 2026 13:12:14 GMT`.
- Detailed record: `docs/RUNTIME_RELIABILITY_HARDENING_2026-06-12.md`

## 2026-06-12 Member profile photos

Members can now add, replace, and remove a profile photo from the profile editor.

- Profile photo upload uses the shared JPG/JPEG/PNG/GIF/SVG image pipeline.
- Raster images still use the existing client-side optimization path; SVGs still pass through sanitizer handling.
- Profile photos render in the live OneID preview and public profile modal.
- Local and Firebase profile persistence now include profile photo fields.
- A regression assertion confirms local profile photos survive save, sign-out, and sign-in.
- Detailed record: `docs/PROFILE_PHOTO_UPLOAD_2026-06-12.md`

## 2026-06-12 Windows browser Management gate

Staff Management access now has an extra browser-side credential gate.

- Clicking `Management` opens a Management credentials pop-up before the staff dashboard renders.
- The pop-up is available only from browser sessions that identify as Windows.
- The gate uses Windows Hello / platform security-key verification so the sensitive prompt is outside the React page.
- Management now requests a server-issued WebAuthn challenge and requires backend verification before unlocking when the Next API backend is deployed.
- Static Hosting keeps a Windows Hello fallback only when the backend challenge route is unavailable, because Next API deployment is still blocked until Blaze is enabled.
- Android and iOS browser sessions are blocked from opening the Management dashboard.
- Desktop nav, bottom nav, header Management entry, and quick menu paths share the same gate.
- Detailed record: `docs/WINDOWS_BROWSER_MANAGEMENT_GATE_2026-06-12.md`

## 2026-06-11 Local people and merchant application

Member local discovery and merchant intake now have first-pass production surfaces.

- Added ZIP/postal persistence to member signup, profile editing, local storage, and Firebase profile storage.
- Replaced the Home nearby list with `People local to you`, using exact ZIP matches first and prompting members to add a ZIP when missing.
- Added a Services form to apply to become a merchant from inside the app.
- Merchant applications now enter the existing staff merchant onboarding queue with audit, notification, profile status, and risk signal records.
- Once approved/active, the member view switches to a merchant dashboard with inventory, orders, storefront settings, fulfillment, returns, and payout cadence controls.
- Detailed record: `docs/LOCAL_PEOPLE_AND_MERCHANT_APPLICATION_2026-06-11.md`

## 2026-06-11 Launch support feedback context

Signup support is now more useful for paid-traffic launch issues.

- Added a `Launch support is open` note to the landing page.
- Added feedback categories for captcha, signup readiness, and ad-link issues.
- Feedback now captures campaign, URL, referrer, viewport, time zone, and user agent context.
- Feedback submit requires contact email and issue details before preparing the support email.
- Detailed record: `docs/LAUNCH_SUPPORT_FEEDBACK_CONTEXT_2026-06-11.md`

## 2026-06-11 Signup workflow GUI hardening

Member signup has been tightened to reduce avoidable user-facing hiccups.

- Fixed the `/signin` route-mode reset that could switch users back to sign-in after opening sign-up.
- Added a `Signup readiness` panel covering credentials, access path, profile basics, 18+ DOB, and robot check.
- Added DOB handling to the onboarding auth signup path and capped DOB fields at the latest 18+ date.
- Signup submit buttons now wait for readiness checks before sending requests.
- Strong password validation now applies to all member signup paths.
- Detailed record: `docs/SIGNUP_WORKFLOW_GUI_HARDENING_2026-06-11.md`

## 2026-06-11 Android APK refresh

Refreshed the Android debug APK from the current FoxHub web bundle.

- Ran `npm run package:android:debug`.
- Fresh output: `release/FoxHub-Android-Debug-0.1.0.apk`.
- APK size: `6,347,588` bytes, about 6.1 MB.
- APK contains the current `index-DKpyfyTK.js`, `index-CFbtPTaO.css`, `FoxHubShell-CibUg65P.js`, media upload, repository, and compression assets.
- File check confirms Android package with APK Signing Block.
- iOS was not refreshed in this pass.
- Detailed record: `docs/ANDROID_APK_REFRESH_2026-06-11.md`

## 2026-06-11 Captcha robot guard

Member signup now has a first-party robot-check gate.

- Added a reusable captcha challenge and validation helper.
- Member signup surfaces show a `Robot check` with a visible answer and hidden honeypot field.
- Local and Firebase signup paths reject bypassed signup payloads without a valid captcha proof.
- Added tests for valid, missing, wrong, stale, and honeypot-filled captcha submissions.
- Detailed record: `docs/CAPTCHA_ROBOT_GUARD_2026-06-11.md`

## 2026-06-11 Photo upload and performance optimization

Photo attachments are now faster, clearer, and stricter about accepted formats.

- Added shared image upload handling for JPG, JPEG, PNG, GIF, and SVG vector images.
- Raster uploads are compressed client-side when useful; GIFs are preserved; SVGs are sanitized before storage.
- Chat attachments now support click upload and drag/drop with a visible accepted-format hint.
- Repository persistence now keeps only supported `data:image` attachment URLs.
- Added async/lazy image decoding and CSS content-visibility guards for heavier repeated workspace panels.
- Detailed record: `docs/PHOTO_UPLOAD_PERFORMANCE_OPTIMIZATION_2026-06-11.md`

## 2026-06-11 Staff improvement roadmap expansion

The staff improvement roadmap now covers 120 staff-side controls across eight agent workstreams in Management.

- Added four staff improvement packs: Core Ops, Workflow Intel, Risk Quality, and Resilience Governance.
- Added four expansion packs: Case Support Expansion, Fraud Commerce Expansion, Trust Privacy Expansion, and Platform Governance Expansion.
- Added a normalizing pack index under `src/staffImprovementPacks/index.js`.
- Management now shows `Staff improvement roadmap` with 120 controls, approval-required count, high-risk count, workstream cards, and the next-control preview.
- The roadmap covers permissions, case management, approval flows, audit search, evidence, timelines, SLAs, escalation, QA, policy versioning, fraud graphs, support routing, commerce risk, trust/privacy review, platform operations, release controls, on-call, emergency lockdown, and staff feedback.
- Detailed record: `docs/STAFF_IMPROVEMENT_ROADMAP_2026-06-11.md`

## 2026-06-11 Footer boilerplate optimization

Footer boilerplates now reflect the latest FoxHub controls and provide quicker access to important public information.

- Added footer quick-access links for Privacy Policy, Complaint Prevention, Staff Controls, Safety Center, System Status, and Contact Support.
- Updated footer groups with current member controls, staff controls, complaint-zero, complaint help, and staff control update pages.
- Expanded page copy for privacy/account visibility, complaint prevention, staff management, support paths, trust standards, release notes, and status.
- Footer info pages now show a quick-access rail.
- Detailed record: `docs/FOOTER_BOILERPLATE_OPTIMIZATION_2026-06-11.md`

## 2026-06-11 Complaint-zero controls

FoxHub now has controls for the eight highest-risk social-media complaint categories.

- Installed member-facing `Complaint prevention controls` in Account controls.
- Installed staff-facing `Complaint-zero dashboard` and `Complaint-zero staff controls` in Management.
- Categories cover Feed Control, Commercial Boundaries, Safety and Moderation, Trust and Anti-Spam, Privacy and Account Control, Attention and Notification Health, Support and Dispute Resolution, and Product Guardrails.
- Member actions route to feed, market, profile/privacy, notification, support, safety, spam/scam, and product-concern paths.
- Staff actions route to copilot review, commerce audit, safety incident, fraud/risk review, privacy review, digest/quiet policy, support SLA review, and product drift review.
- Detailed record: `docs/COMPLAINT_ZERO_CONTROLS_2026-06-11.md`

## 2026-06-11 Add staff member control

Management now has a populated staff invite/setup card.

- Added `Add new FoxHub Staff Member` to the Management workspace.
- The card is prefilled with a support operations staff profile and scopes.
- Added 12 staff role templates covering support, trust and safety, fraud/risk, disputes, compliance, moderation, merchant ops, security, customer success, operations management, admin, and audit.
- Added loaded staff controls for access review, permission audit, application sweep, fraud hold, security incident, dispute intake, compliance review, merchant risk, settlement approval, and device recovery.
- Submitting the card stages a pending staff member, matching `operatorAccess` record, audit event, and staff notification.
- Management now shows a `Staff setup queue` for pending staff and staged operator access.
- Detailed record: `docs/ADD_STAFF_MEMBER_CONTROL_2026-06-11.md`

## 2026-06-11 Member and staff controls expansion

Members now have a clear self-service control surface, and staff have deeper support/operations controls.

- Added member `Account controls` on the Home workspace.
- Member controls cover profile/account settings, connection requests, trusted contacts, messaging/blocking path, notifications, support/dispute help, security concern reporting, and device-session revocation.
- Expanded Management with support operations, support case creation, fraud/security escalation, support priority mode, support macros, support alerts, dispute queue, fraud hold queue, security concerns, and device/account recovery review.
- Staff-only management controls from the previous pass remain in place.
- Verified with `npm run release:check`.
- Detailed record: `docs/MEMBER_STAFF_CONTROLS_EXPANSION_2026-06-11.md`

## 2026-06-11 Staff management console separation

Staff and management accounts now stay in operator mode instead of seeing member-side workspace content.

- Management users get a staff-only nav set: Management, Staff Tools, and Control Library.
- Member tabs such as Home, Social, Rapport, Communal, Pay, Goodies, and member marketplace/service surfaces are removed for staff accounts.
- Management route guarding redirects staff users away from member tabs unless they are opening Staff Tools or Control Library.
- Management now includes operator controls for trust recalculation, copilot triage, priority alerts, notification digest, audit, merchant risk, settlements, and compliance.
- Existing member application, verification, moderation, and applicant email-notice queues remain in the Management workspace.
- Verified with `npm run release:check`.
- Detailed record: `docs/STAFF_MANAGEMENT_CONSOLE_2026-06-11.md`

## 2026-06-10 Ad traffic prep

The public ad entry is ready for small traffic tests.

- Updated the static Vite HTML metadata used by paid/social crawlers before React loads.
- Added canonical URL, Open Graph title/description/image, and Twitter large-card metadata for the public Hosting URL.
- Updated the Next metadata contract to match the static public bundle.
- Added release-smoke assertions for canonical/social-preview metadata.
- Tightened the landing hero copy, changed the main public CTA to `Request early access`, added the early-access flow note, and added a four-step sign-up expectation section.
- Added a self-hosted FoxHub social preview image instead of relying on an external stock-photo URL for social cards.
- Verified locally with `npm run release:check`.
- Detailed record: `docs/AD_TRAFFIC_PREP_2026-06-10.md`

## 2026-06-06 Management login guard

Member and staff sign-in routes now reject the wrong account class.

- Management route sign-in still authenticates through the normal account system.
- Immediately after authentication, the route checks the signed-in profile against FoxHub management access rules.
- If the profile is not permitted, the session is signed back out, the route remains `/management`, and the error message is exactly `Not Permitted.`
- This keeps member credentials from opening the Management dashboard even if the member email/password are valid.
- Member route sign-in now mirrors the guard: if a staff/management profile signs into `/signin`, the session is signed back out, the route remains `/signin`, and the error message is exactly `Not Permitted.`
- This keeps staff credentials out of member login surfaces and reduces internal tampering/manipulation risk.
- Verified with `npm test`, `npm run build`, `npm run smoke:public`, Firebase Hosting deploy, and live `/signin` plus `/management` route render.
- Detailed record: `docs/MANAGEMENT_LOGIN_GUARD_2026-06-06.md`
- Separation record: `docs/STAFF_MEMBER_LOGIN_SEPARATION_2026-06-06.md`

## 2026-06-06 Profile Insert placeholders

New-account and profile-edit fields now use neutral Insert-style placeholder text.

- Removed sample-person placeholders such as `Jordan, Auntie Dee, DJ Nova`, `@jfox`, and `Atlanta` from member account/profile text boxes.
- Replaced founder-flavored role placeholder text with `Insert occupation`.
- Replaced invite label placeholder text with `Insert invite label`.
- Cleared the default profile bio seed so new blank profiles do not inherit `Building a U.S.-born super-app.` as saved text.
- Verified with `npm test`, `npm run build`, `npm run smoke:public`, local browser check, Firebase Hosting deploy, and live browser check.
- Detailed record: `docs/PROFILE_INSERT_PLACEHOLDERS_2026-06-06.md`

## 2026-06-06 Public Display name retention

Public Display name now persists as both the editable profile name and the durable `displayName` alias.

- Current accounts missing `displayName` repair from the saved public `name` on profile load/save.
- Future signups create both `name` and `displayName` immediately.
- Local and Firebase profile writes now include `displayName` in canonical profile fields, profile repair checks, user records, and signup/update paths.
- Stale saved `displayName` values can no longer override a newly typed Public Display name.
- Verified with `npm test`, `npm run build`, `npm run smoke:public`, Firebase Hosting deploy, and live route render.
- Detailed record: `docs/PUBLIC_DISPLAY_NAME_RETENTION_2026-06-06.md`

## 2026-06-06 Founder profile retention fix

Founder/owner profile edits now retain custom public information instead of reverting to the default `@founder` identity.

- Founder access, staff access, and management access remain forced for owner accounts.
- Editable founder identity fields such as name, handle, city, bio, occupation, pronouns, website, availability, and interests are no longer stripped by the founder canonical profile rule.
- Existing founder filler values such as `FoxHub Founder`, `@founder`, `Atlanta`, the founder boilerplate bio, `Founder`, and `FoxHub management` are now treated as blank placeholder defaults.
- Future accounts are covered as well: member optional profile fields start blank, and founder/staff access setup does not seed editable identity fields with founder filler.
- Founder/staff accounts now bypass member setup requirements so a blank editable profile cannot trap the founder at the setup screen.
- Local founder profile rebuilds now merge saved identity fields instead of recreating the default founder profile on each owner sign-in.
- Profile saves now persist immediately after repository update instead of waiting only for the debounced app-state saver.
- Local app-state saves now protect the durable saved profile from stale UI snapshots.
- Added regression coverage for default founder filler cleanup, stale `@founder` snapshots attempting to overwrite a saved custom founder profile, future member accounts starting with blank optional profile fields, and founder/staff setup bypass.
- Verified with `npm test`, `npm run build`, `npm run smoke:public`, local browser render, live Firebase deploy, and live browser render.
- Detailed record: `docs/FOUNDER_PROFILE_RETENTION_FIX_2026-06-06.md`

## 2026-06-06 Sign-up feedback page and default Green Composite theme

Incoming users now have a public help lane if sign-up is not working for them.

- Added `/feedback` as a public sign-up difficulty page.
- Added sign-up help links from the landing page and sign-up surfaces.
- The feedback page collects attempted email, display name, issue type, invite or sponsor context, and the user's description.
- Submissions are saved locally in the visitor browser and prepare an email draft to `support@foxhub.app`.
- Added Green Composite as the default theme for first-time visitors and for returning visitors without a saved valid theme.
- Verified live at `https://foxhub-superapp.web.app/feedback`.
- Detailed record: `docs/SIGNUP_FEEDBACK_PAGE_2026-06-06.md`

## 2026-06-06 Premium theme locks, deploy, and archive refresh

Premium Silver, Premium Gold, and Dark Marble Premium are now paid member themes.

- Member accounts can see the premium themes in the selector, but locked options cannot be selected unless the profile has the matching paid entitlement.
- Accepted entitlement sources include `premiumThemes`, `themeEntitlements`, `premiumThemeAccess`, `activeThemeSubscriptions`, or `paidThemes`; an `all` entitlement unlocks every premium theme.
- FoxHub staff accounts bypass the premium lock when the email domain contains `foxhub`, regardless of suffix.
- The theme cycle skips locked premium themes for member accounts.
- If a member has a locked premium theme saved from an earlier session, the app falls back to Day.
- Verified with `npm test`, `npm run build`, `npm run smoke:public`, local Playwright against `dist`, live Playwright against `https://foxhub-superapp.web.app`, and Firebase Hosting deploy.
- Detailed record: `docs/PREMIUM_THEME_LOCKS_2026-06-06.md`

## 2026-06-05 Solid Art owner privilege repair

`solidartentertainment@gmail.com` is now recognized as a FoxHub founder/owner account.

- Added `solidartentertainment@gmail.com` to the shared owner-email contract.
- Added UID `43caVpuJfHaHEJdsvaGu5vKpttw1` to Firestore founder UID rules.
- Updated Firebase repository bootstrap so the known owner email can create or repair `operatorAccess/{uid}` before custom claims are present.
- Updated Management routing and dashboard founder checks to use the shared owner-email helper.
- Updated Firestore platform-management checks to allow the known founder UID.
- Fixed invite-rule drift for `expired`, `expiredAt`, and `expirationReason`.
- Detailed record: `docs/SOLIDART_OWNER_PRIVILEGE_REPAIR_2026-06-05.md`

## 2026-06-05 Sticky unique account emails

Member email identity is now hardened as a sticky unique account field.

- Local/demo signup rejects an already-registered email.
- Firebase signup normalizes `auth/email-already-in-use` into a clear “sign in or use another email” message.
- Profile edits keep the registered account email instead of allowing a profile payload to change it.
- The user's own profile editor now displays the signed-in account email in the account section.
- Existing disabled email fields remain display-only in onboarding/profile surfaces.
- Detailed record: `docs/MEMBER_EMAIL_PROFILE_RULES_2026-06-04.md`

## 2026-06-06 Profile retention and organization

Profile editing now protects saved user information from accidental resets.

- Local and Firebase profile saves are non-destructive when an incomplete draft is submitted.
- Existing saved profile details are preserved instead of being replaced with defaults or blanks.
- The profile editor keeps a local draft backup while the editor is open and clears it after a successful save or sign-out.
- The profile editor now shows saved-field count, draft backup status, and a Profile memory account row.

## 2026-06-05 Member tab access repair

Member navigation now keeps the Management tab reserved for staff, managers, and founder/owner profiles.

- Normal member sessions cannot restore a saved `staff` tab from browser session storage.
- Normal member clicks or redirects to `/management` are sent back to Home.
- The Management tab is hidden from the member workspace navigation unless the signed-in profile has staff/manager/founder access.

## 2026-06-05 Account emblem

The signed-in app shell now shows a visible account emblem in the header and workspace summary.

- Any profile with `foxhub` anywhere in the email domain shows `FoxHub Staff`; suffix does not matter.
- Approved or active vendor/merchant profiles without a FoxHub-domain email show `Vendor`.
- Everyone else shows `Member`.
- Moderator, admin, management, and C-level controls are gated to the same FoxHub-domain staff rule.

## 2026-06-05 Invite approval auto-connection

Approved invites now establish the inviter/new-member connection automatically.

- Sponsor approval adds the approved applicant to the sponsor's Rapport contacts.
- Firebase sponsor approval writes the sponsor-side contact in the same batch as the invite approval.
- Firebase applicant sign-in after approval adds the sponsor to the applicant's contacts.
- Local/demo mode avoids duplicate connection records.
- Detailed record: `docs/INVITE_APPROVAL_CONNECTION_2026-06-05.md`

## 2026-06-05 Invite code rotation

Invite codes now behave as one-at-a-time active codes per creator.

- Creating a new invite expires older active invite codes from the same creator.
- Sponsor-pending invite codes from the same creator are also expired when a newer invite is generated.
- Redeemed, denied, and already expired invite records remain as history.
- Local/demo mode, Firebase mode, and the visible app state all apply the same rotation rule.
- Added regression coverage proving the previous invite expires and cannot be used for signup.
- Detailed record: `docs/INVITE_CODE_ROTATION_2026-06-05.md`

## 2026-06-05 Signup age verification

Member signup is now 18+ only.

- Signup collects date of birth on the public member signup form.
- Missing, invalid, or under-18 birth dates are rejected.
- Local/demo auth and Firebase-backed auth both enforce the age gate at the repository layer.
- Firebase signup blocks underage attempts before Firebase Auth account creation.
- Successful signup stores only `ageVerified` and `ageVerifiedAt`; raw date of birth is not stored on the member profile.
- Detailed record: `docs/SIGNUP_AGE_VERIFICATION_2026-06-05.md`

## 2026-06-05 Staff-only FoxHub email domains

FoxHub-domain emails are now enforced as staff-only in the open member signup path.

- Blocks `name@foxhub.*` for member signup across local/demo auth and Firebase-backed auth.
- Covers known and future suffixes, including `.com`, `.io`, `.biz`, `.test`, and any other `foxhub.*` suffix.
- Counts repeated blocked attempts per reserved email and returns a stronger management-approval block message after the third attempt.
- Ignores client-supplied staff/manager flags in member signup so a user cannot self-approve a staff email.
- Keeps staff/management FoxHub-domain addresses reserved for the separate staff/management path.
- Detailed record: `docs/MEMBER_EMAIL_PROFILE_RULES_2026-06-04.md`

## 2026-06-05 Home MySpace-style social components

Home now includes four MySpace-inspired social surfaces adapted to FoxHub's feed style.

- Added Friend activity feed.
- Added Bulletin board posts.
- Added Blog and journal posts.
- Added Visitor preview.
- Used existing contacts, official posts, community channels, story highlights, and saved items as source data.
- Added direct public-profile actions from friend activity and visitor preview cards.
- Added responsive CSS and release smoke markers.
- Detailed record: `docs/HOME_MYSPACE_SOCIAL_COMPONENTS_2026-06-05.md`

## 2026-06-05 Theme expansion

FoxHub now has 20 selectable color themes.

- Added Green Composite as the default visitor theme.
- Kept Day, Night, and Matrix.
- Added Forest, Ocean, Ember, Slate, Rose, and High Contrast.
- Added Lavender, Cyberpunk, Mint, Midnight, Solar, Arctic, and Grape in the second expansion pass.
- Added Premium Silver, Premium Gold, and Dark Marble Premium with visible monthly pricing labels.
- Premium themes are locked for member accounts unless the profile has the matching paid theme entitlement; FoxHub staff bypass the lock.
- Added a shared theme registry for theme validation, labels, and cycling.
- Added a direct theme picker in the app header.
- Updated the existing theme toggle to cycle through all installed themes.
- Added high-contrast form/button hardening.
- Detailed record: `docs/THEME_EXPANSION_2026-06-05.md`

## 2026-06-05 Self profile editor upgrade

The user's own profile editor is now a richer management surface instead of a basic stack of inputs.

- Added a live public preview card for the user's OneID profile.
- Added completion, access, and badge status cards.
- Grouped editing into Public identity, Role and community, Account controls, Verified badge, and Invite tools.
- Replaced the Bio input with a multiline textarea.
- Added a sticky save bar with preview identity and completion status.
- Added saved fields for pronouns, website/link, availability, and interests/strengths.
- Extended local and Firebase profile persistence for the added fields.
- Added regression coverage for saving the added profile fields across sign out and sign in.
- Added responsive CSS and release smoke markers.
- Detailed record: `docs/SELF_PROFILE_EDITOR_UPGRADE_2026-06-05.md`

## 2026-06-04 Public profile viewer

FoxHub now has a visible public-profile path for other members.

- Added a public profile modal that shows display name, handle, city, account type, trust tier, presence, peer rating, rapport score, join date, verification summary, and public tags.
- Kept private fields such as email and phone out of the public profile view.
- Added View profile entry points from Home feed people posts, global section feed people cards, Rapport contact surfaces, and Market seller details.
- Added message and Open in Rapport actions from the public profile modal.
- Added responsive public-profile CSS and release smoke markers.
- Upgraded the public profile with a trust lane meter, public-safe trust signal cards, strengths/tags, and a public activity grid.
- Detailed record: `docs/PUBLIC_PROFILE_VIEWER_2026-06-04.md`

## 2026-06-04 Global section feeds

The Home feed pattern now appears across the rest of the main workspaces.

- Added a reusable feed surface above every non-Home tab.
- Converted Social, Rapport, Communal, Services / Merchant, Needs & Offers, Pay, UX / Goodies, Management, Tools, and Organizer data into feed cards.
- Added Hot, New, and Discussed sorting plus All, Trusted, Local, and Open scopes.
- Kept existing section-specific controls underneath the feed surfaces.
- Added visual feed variants and release smoke markers.
- Detailed record: `docs/GLOBAL_SECTION_FEEDS_2026-06-04.md`

## 2026-06-04 Rapport section rework

Rapport now reads as a focused people-and-trust workspace instead of a mixed feed/market/media area.

- Added a Rapport command center with trusted people, introductions, private groups, and review-item summaries.
- Added a high-trust introductions panel with direct message actions.
- Kept contacts, circles, groups, friend requests, trust records, profile reputation, and professional graph tools in the section.
- Removed duplicate Moments, official accounts, local classified, creator dashboard, media tools, demand signals, sentiment, community-channel, and duplicate relationship-graph blocks from Rapport.
- Added release smoke markers for the new Rapport copy and CSS.
- Detailed record: `docs/RAPPORT_SECTION_REWORK_2026-06-04.md`

## 2026-06-04 Member email and profile rules

Member email identity is now separated from public profile naming.

- Member sign-up requires the member's current personal email address.
- Public profile naming uses a custom username/handle plus a public display name.
- Public display name does not need to be a legal first and last name.
- Normal member sign-up rejects `foxhub.*` email domains.
- Staff and management remain the only account class allowed to retain FoxHub-domain addresses.
- Visible non-staff seed/demo user emails were moved away from `@foxhub.test`.
- Added regression coverage for rejecting `member@foxhub.test` and `member@foxhub.io`.
- Detailed record: `docs/MEMBER_EMAIL_PROFILE_RULES_2026-06-04.md`

## 2026-06-04 Home feed rework

Home now has a dedicated front-page feed that behaves like a familiar social stream while using Reddit-style organization.

- Combines Moments, official posts, and local needs into one Home feed.
- Added `Hot`, `New`, and `Discussed` sorting.
- Added `All`, `Local`, `Trusted`, and `People` feed scopes.
- Added vote/score rails, comment actions for Moments, official-thread actions, follow actions, and service-interest actions.
- Added responsive feed styling for phone layouts.
- Detailed record: `docs/HOME_FEED_REWORK_2026-06-04.md`

## 2026-06-04 APK hosting attempt

Built a fresh Android debug APK and attempted to publish it through Firebase Hosting.

- `npm run package:android:debug` passed.
- Fresh APK output: `release/FoxHub-Android-Debug-0.1.0.apk`.
- File check confirmed an Android package with APK Signing Block.
- Firebase Hosting rejected the APK upload because executable files are forbidden on the current Spark billing plan.
- Removed the APK from the Hosting bundle and removed the temporary APK button to avoid a broken public download link.
- Detailed record: `docs/APK_HOSTING_ATTEMPT_2026-06-04.md`

## 2026-06-04 Member / staff database split

FoxHub now separates public member profiles from FoxHub-employed staff profiles.

- Member sign-up/sign-in writes member identity and app state to `users/{uid}`.
- Authorized founder, management, reviewer, admin, or staff accounts can also create or refresh `staffMembers/{uid}`.
- Staff permissions remain in `operatorAccess/{uid}` so staff identity and access scopes are not mixed.
- `/signin` now visibly labels the member database mode.
- `/management` now visibly labels the staff database mode.
- The Management workspace shows the live split between `users/{uid}`, `staffMembers/{uid}`, and `operatorAccess/{uid}`.
- Local fallback mode mirrors the split with a dedicated `foxhub-alpha-staff-members` storage bucket.
- Detailed record: `docs/MEMBER_STAFF_DATABASE_SPLIT_2026-06-04.md`

## 2026-06-03 Auth workflow consolidation

Member sign-in and sign-up are now consolidated on `/signin`.

- Added a sign-in/sign-up switch to the member auth page.
- Landing/footer sign-up actions now open `/signin` in sign-up mode.
- Sign-in stays limited to email, password, password recovery, and Management entry.
- Sign-up now collects credentials, invite-or-review access path, profile basics, and 18+ birth date in one streamlined flow.
- Invite-code sign-ups state that the inviting current user must approve or deny access.
- No-invite sign-ups state that the application goes to FoxHub Management for approval or denial.
- `/management` remains a separate staff/founder/admin sign-in route.
- Detailed record: `docs/AUTH_WORKFLOW_CONSOLIDATION_2026-06-03.md`

## 2026-06-02 Founder management auth hardening

Founder and Management access were hardened after live testing exposed fragile auth, routing, Firestore, and waitlist behavior.

- Added a dedicated `/management` route for managers, founders, and administrators.
- Forced `/management` to render the Management dashboard tab immediately after auth.
- Added founder UID fallback rules for first-time Firestore profile/subtree and operator-access initialization.
- Forced `founder@foxhubapp.com` to remain priority, onboarded, founder-role, and out of monthly review/waitlist.
- Added founder repository smoke coverage for authenticated/priority/onboarded/founder/not-waitlisted assertions.
- Added founder invite smoke coverage that verifies founder accounts can create invites through the live Firebase invite path.
- Latest invite permission streamline and multi-account smoke record: `docs/INVITE_PERMISSION_STREAMLINE_2026-06-18.md`
- Detailed record: `docs/FOUNDER_MANAGEMENT_AUTH_HARDENING_2026-06-02.md`

## 2026-06-01 Local auth registration guard

Static/local sign-in now validates that the email was registered first.

- Unknown emails are rejected on sign-in instead of creating a new account.
- Local sign-up stores a password hash for future sign-in checks.
- Wrong passwords are rejected when a saved password hash exists.
- Live Hosting now builds with Firebase web app config, so hosted sign-in is checked by Firebase Auth/Firestore instead of the local fallback.
- User-facing auth is consolidated to email/password only.
- Added forgot-password recovery with Firebase reset email validation and a new-password page.
- Founder has Firebase owner custom claims and full owner scopes.
- Added `npm run smoke:auth` for repeatable Firebase Auth checks.
- Detailed record: `docs/LOCAL_AUTH_REGISTRATION_GUARD_2026-06-01.md`

## 2026-05-31 Sign-in and Moments enrichment

FoxHub now has a richer hosted sign-in page and expanded Moments interaction support.

- Enriched `/signin` with stronger return context and app-preview cues.
- Expanded Moments with more reactions and photo attachments.
- Detailed record: `docs/SIGNIN_AND_MOMENTS_ENRICHMENT_2026-05-31.md`

## 2026-05-31 Stripe Billing components and docs consolidation

FoxHub now has a visible Stripe Billing component surface in the Tools/API connectors workspace.

- Confirmed existing Stripe packages/webhook scaffolding and added the guarded Stripe Billing panel.
- Added readiness cards, plan cards, setup actions, and a live-billing warning.
- Consolidated the current documentation into `docs/CURRENT_HANDOFF_2026-05-31.md`.

## 2026-05-31 Management dashboard and founder logon

FoxHub now has a consolidated Management dashboard path for staff, managers, moderators, and founder-level review.

- Added the Management sign-in entry and consolidated staff, manager, and moderator queues.
- Added founder manager local sign-in, Management-first routing, and founder profile/operator scope enrichment.
- Current deploy and verification details live in `docs/CURRENT_HANDOFF_2026-05-31.md`.
- Detailed record: `docs/MANAGEMENT_DASHBOARD_FOUNDER_LOGON_2026-05-31.md`

## 2026-05-31 Applicant manager review emails

No-invite FoxHub Member applications now go to Management for approval or denial.

- Updated applicant-facing copy to explain manager review.
- Manager decisions now update applicant access and create approval, denial, or follow-up email notice records.
- Firebase mode queues `transactionalEmailEvents`; static local mode records email notices in app state.
- Current deploy and verification details live in `docs/CURRENT_HANDOFF_2026-05-31.md`.
- Detailed record: `docs/APPLICANT_MANAGER_REVIEW_EMAILS_2026-05-31.md`

## 2026-05-28 Advertising readiness pass

Prepared FoxHub for small advertising tests.

- Added lightweight UTM/campaign-source capture on the public splash route.
- Supports `utm_source`, `utm_campaign`, `utm_medium`, `utm_term`, and `utm_content`.
- Stores the latest campaign source in browser local storage.
- Shows a compact campaign source note on the splash page when a campaign link is used.
- Added a broader privacy line to the splash page without spotlighting specific age groups.
- Added stronger public-ready copy for key footer pages:
  - Privacy Policy
  - Terms of Use
  - Help Center
  - Contact Support
  - Safety Center
  - System Status
  - Mission
  - What's Inside
- Updated release smoke to verify ad/source copy, privacy page copy, footer route lookup, and current Organizer count.
- Detailed record: `docs/ADVERTISING_READINESS_2026-05-28.md`

Verified:

- `npm run release:check` (pass)
- `npm run deploy:hosting` (pass)
- live campaign URL: `https://foxhub-superapp.web.app/?utm_source=facebook&utm_medium=paid-social&utm_campaign=privacy-first-alpha` (HTTP 200)
- live privacy footer route: `https://foxhub-superapp.web.app/footer/legal/privacy-policy` (HTTP 200)
- live mission route: `https://foxhub-superapp.web.app/footer/company/mission` (HTTP 200)
- live `Last-Modified`: `Thu, 28 May 2026 11:26:58 GMT`
- live JS bundle contains `Ad source`, `utm_source`, `Your private activity should stay private`, `literally almost anyone who has had enough with being watched online`, and `What is private stays private`
- live JS bundle contains `private messages or personal images for ad profiles`, `abuse, fraud, security, and illegal activity`, and `feeling watched`
- live CSS bundle contains `landing-campaign-note` and `landing-privacy-note`

## 2026-05-27 Splash privacy copy pass

Updated the splash hero copy.

- Reduced the size of the `A place for your people to stay close.` headline.
- Added a dedicated privacy note:
  - `Unlike platforms built around broad data scanning, FoxHub is designed not to scan your private messages or images. What is private stays private.`
  - This copy was later tightened to avoid spotlighting specific age groups or sounding like ad-script language.
- Added `landing-privacy-note` styling for the new privacy statement.

Verified:

- `npm run release:check` (pass)
- `npm run deploy:hosting` (pass)
- live URL: `https://foxhub-superapp.web.app`
- live `Last-Modified`: `Thu, 28 May 2026 00:58:18 GMT`
- live bundle contains `Unlike platforms built around broad data scanning` and `What is private stays private`

## 2026-05-27 Release readiness install

Installed the missing release-readiness layer identified after the footer/package refresh.

- Added public footer destination routes under `/footer/{section}/{page}`.
- Converted splash/authenticated footer items from visual tags into real links.
- Added a public footer info page for legal, support, trust, business, developer, product, company, and status boilerplates.
- Added `src/footerBoilerplates.js` route helpers for shared footer data and route lookup.
- Added `scripts/release-smoke.mjs`.
- Added package scripts:
  - `npm run smoke:public`
  - `npm run release:check`
  - `npm run package:android:debug`
  - `npm run package:software`
- Added package metadata to reduce Windows build warnings:
  - `description`
  - `author`
- Added release documentation:
  - `docs/RELEASE_CHECKLIST.md`
  - `docs/VERSIONING_AND_PACKAGING.md`
  - `docs/PRODUCTION_BACKEND_READINESS.md`
  - `docs/FOOTER_PUBLIC_ROUTES_2026-05-27.md`

Production gaps still intentionally documented:

- Android release signing is not configured.
- Windows Authenticode signing and custom icon are not configured.
- Server-authoritative backend deployment is not live yet.

Verified:

- `npm run release:check` (pass)
- `npm run deploy:hosting` (pass)
- live `/footer/legal/privacy-policy` (HTTP 200)
- live `Last-Modified`: `Thu, 28 May 2026 00:50:36 GMT`
- Android debug package refreshed at `release/FoxHub-Android-Debug-0.1.0.apk`
- Windows portable package refreshed at `release/FoxHub-0.1.0-x64.exe`
- Android and Windows packages contain current `index-BsADIE4X.js` and `index-Bmm8Z6Vf.css` assets.

## 2026-05-27 Android and Windows refresh

Refreshed the packaged software after the splash footer boilerplate fix.

- `npm run sync:android` passed and copied the current Vite bundle into the Android Capacitor wrapper.
- Android debug APK built successfully with Java 21.
- Fresh Android output copied to `release/FoxHub-Android-Debug-0.1.0.apk`.
- `npm run dist:win` passed and generated the Windows portable executable.
- Windows output: `release/FoxHub-0.1.0-x64.exe`.
- Android assets contain the current `index-BzmgdCRb.js` and `index-CaZ5-3Py.css` splash-footer bundle.
- Windows `app.asar` contains the same current Vite asset names.
- Detailed record: `docs/ANDROID_WINDOWS_REFRESH_2026-05-27.md`

## 2026-05-27 Footer boilerplate upgrade

FoxHub now has an upgraded global footer boilerplate layer.

- Expanded the footer from 3 groups to 8 groups.
- Added Legal, Company, Product, Support, Trust, Business, Developers, and Status sections.
- Added owner and status metadata to each footer section.
- Added footer summary counts and a stronger footer baseline.
- Improved footer styling, responsive grid behavior, metadata chips, and wrapping.
- Added the same footer boilerplate layer to the splash landing page for unauthenticated visitors.
- Moved footer boilerplate data into `src/footerBoilerplates.js` so the splash page and authenticated app share one source.
- Detailed record: `docs/FOOTER_BOILERPLATE_UPGRADE_2026-05-27.md`

Verified:

- `npm test` (pass)
- `npm run vite:build` (pass)
- `npm run build` (pass)
- `npm run deploy:hosting` (pass)
- live URL: `https://foxhub-superapp.web.app`
- live `Last-Modified`: `Wed, 27 May 2026 22:23:24 GMT`
- live splash bundle contains the splash footer copy and `landing-footer` styling

## 2026-05-27 Organizer 120-component expansion

FoxHub now has 120 additional high-priority Organizer components installed in the existing `foxhubExpansionComponents` registry.

- Expanded the Organizer from 100 components to 220 components.
- Added component orders 101 through 220 by most-important-first priority:
  - identity, account security, recovery, and delegated access
  - wallet, bill pay, escrow, payout, and payment risk
  - trust, compliance, safety, privacy, fraud, and appeals
  - operator/admin case, incident, permission, export, and training tools
  - MerchantOS launch, inventory, QR, staff, vendor, and health tools
  - marketplace listing, offer, proof, review, and demand tools
  - messaging, thread safety, transcripts, polls, files, and follow-ups
  - mini-app, service request, booking, route, quote, and provider tools
  - discovery, command search, recommendations, city launch, and intent tools
  - navigation, offline, accessibility, mobile parity, install, release, and readiness tools
- Kept all additions inside the current Organizer room so they inherit search, category tabs, enable, run, open, analytics, and reliable queue behavior.
- Balanced the final registry at 22 components in each of the 10 Organizer rooms.
- Updated visible Organizer copy to use the live component count instead of hard-coded `100` text.
- Detailed record: `docs/ORGANIZER_120_COMPONENT_EXPANSION_2026-05-27.md`

Verified:

- local data validation: 220 components, no duplicate IDs, no order gaps, 22 components per room
- `node --check src/data.js` (pass)
- `npm test` (pass)
- `npm run vite:build` (pass)
- `npm run build` (pass)
- local `dist` smoke on `http://127.0.0.1:4180/` (HTTP 200)
- built bundle contains representative new entries from the 120-item pass

Deploy status:

- Initial `npm run deploy:hosting` attempts rebuilt the static bundle, then Firebase rejected the publish because the CLI account was `blacklionmediastudio@gmail.com`.
- Root cause confirmed: FoxHub deploys should use `solidartentertainment@gmail.com`.
- Recovery path documented in `docs/FIREBASE_SETUP.md`.
- Reauthenticated as `solidartentertainment@gmail.com`.
- `npx firebase-tools projects:list`: `foxhub-superapp` visible.
- `npx firebase-tools hosting:sites:list --project foxhub-superapp`: pass.
- `npm run deploy:hosting`: pass.
- Live URL: `https://foxhub-superapp.web.app`
- Live `Last-Modified`: `Wed, 27 May 2026 10:00:17 GMT`
- Live bundle contains representative new Organizer entries from the 120-item expansion.

## 2026-04-30 Home dashboard layout guard

FoxHub Home now has a hardened shell-aware dashboard layout in the live Vite-hosted app.

- Added a dedicated hub-route shell layout so Home uses the full main content canvas.
- Stacked the tactical panel below Home on the hub route instead of competing beside it.
- Added a guarded dashboard breakpoint model:
  - stacked on smaller screens
  - 2-column intermediate board at `1220px+`
  - 3-column board only at `1520px+`
- Removed the old forced room-panel min-height that left extra dead space.
- Detailed record: `docs/HOME_DASHBOARD_LAYOUT_GUARD_2026-04-30.md`

Verified:

- `npm run vite:build` (pass)
- `npm run deploy:hosting` (pass)
- live Hosting release to `https://foxhub-superapp.web.app` (pass)

## 2026-04-28 Home tab UX enrichment

FoxHub Home now has a richer top-of-workspace experience in the live Vite-hosted shell.

- Added a `Today compass` panel to turn the Home tab into a clearer daily starting point.
- Added a `Momentum` panel for current thread, local city, official signal, and mini-app context.
- Added richer Home support blocks for `Circle anchors`, `Official signals`, and `Wallet shortcuts`.
- Kept the existing social -> rapport -> communal -> services ordering intact while making the Home tab easier to scan and act from.
- Detailed record: `docs/HOME_TAB_UX_ENRICHMENT_2026-04-28.md`

Verified:

- `npm run vite:build` (pass)
- `npm run deploy:hosting` (pass)
- live Hosting release to `https://foxhub-superapp.web.app` (pass)

## 2026-04-23 Universal Bill Pay

FoxHub now includes a Universal Bill Pay product surface in the Pay workspace.

- Added `Utility Bill Pay` to the Money service catalog.
- Added a `Bill Pay` utility card.
- Added seeded electric, water, internet, and mobile billers.
- Added scheduled bill-pay ledger entries.
- Added a `Universal Bill Pay` connector.
- Wired a `utility` wallet action through the existing wallet event and moderation path.
- Persisted `utilityBillPayProviders` and `utilityBillPayPayments` across local, Firebase, and locked native seed state.
- Detailed record: `docs/UNIVERSAL_BILL_PAY_2026-04-23.md`

Verified:

- `node --check src/data.js` (pass)
- `npm run vite:build` (pass)
- `npm test` (pass)
- `npm run deploy:hosting` (pass)
- live Hosting `/` smoke (HTTP `200`)

Production note:

- This is a simulated product surface. Real bill payments still require biller directory integration, verified payment rails, webhook reconciliation, and regulatory/compliance review before live money movement.

## 2026-04-22 smoke test and deploy

FoxHub was smoke-tested locally and deployed to Firebase Hosting after the Next.js foundation, landing page, OneID, rapport/community UX, and wrapping-layout updates.

- Preferred public URL: `https://foxhub.com`
- Current Firebase Hosting fallback: `https://foxhub-superapp.web.app`
- Direct Firebase landing route: `https://foxhub-superapp.web.app/landing`
- Direct Firebase sign-in route: `https://foxhub-superapp.web.app/signin`
- Firebase Hosting still serves the Vite static bundle from `dist`.
- Next.js API routes are build-verified and local-smoke-tested, but are not live on Firebase Hosting until a Next-capable backend host or adapter is added.
- Detailed record: `docs/SMOKE_DEPLOY_2026-04-22.md`

Verified:

- `npm test` (pass)
- `npm run build` (pass)
- `npm run vite:build` (pass)
- local route smoke for `/`, `/landing`, `/signin`, and `/api/health` (pass)
- `npm run deploy:hosting` (pass)
- live route smoke for `/`, `/landing`, and `/signin` (pass)
- live bundle contains the updated social landing copy (pass)

## 2026-04-22 Next Firebase Functions adapter

FoxHub now has an opt-in Firebase Functions adapter for the Next.js app and API routes.

- Added a `nextApp` HTTPS Cloud Function.
- Added `scripts/prepare-next-functions.mjs` to package `.next` into `functions/next-app`.
- Added `firebase.next.json` for Hosting rewrites to the Next function.
- Kept the default `firebase.json` on the static Vite Hosting path so the live site is not pointed at an undeployed function.
- Added `npm run build:next:functions` and `npm run deploy:next`.
- Detailed record: `docs/NEXT_FIREBASE_FUNCTIONS_ADAPTER_2026-04-22.md`

Verified:

- `node --check functions/index.js` (pass)
- `node --check scripts/prepare-next-functions.mjs` (pass)
- `npm run build:next:functions` (pass)
- `npm test` (pass)
- Firebase emulator using `firebase.next.json` routes `/`, `/landing`, and `/api/health` through `nextApp` (pass)

Deploy blocker:

- `npm run deploy:next` is ready, but Firebase rejected the Cloud Functions deploy because `foxhub-superapp` is not on the Blaze pay-as-you-go plan. Upgrade Firebase billing before deploying the Next-backed Hosting adapter.

## 2026-04-22 Android APK refresh

Refreshed the Android debug APK with the latest synced Vite/Capacitor bundle.

- Output: `release/FoxHub-Android-Debug-0.1.0.apk`
- Wrapper bundle: `android/app/src/main/assets/public`
- Current bundle hash: `assets/index-D4eakTuU.js`
- Detailed record: `docs/ANDROID_APK_REFRESH_2026-04-22.md`

Verified:

- `npm run sync:android` (pass)
- Android Gradle `assembleDebug` with Java 21 (pass)
- APK file check confirms Android package with APK Signing Block (pass)
- APK contains the current synced web bundle (pass)

## 2026-04-22 Matrix theme install

FoxHub now includes a third GUI theme: Matrix.

- Theme cycle is now Day -> Night -> Matrix -> Day.
- Matrix theme uses a dark green/black base, neon green accents, grid texture, and panel glow treatments.
- Detailed record: `docs/MATRIX_THEME_INSTALL_2026-04-22.md`

Verified:

- `npm test` (pass)
- `npm run build` (pass)
- `npm run vite:build` (pass)

## 2026-04-19 OneID rollout

FoxHub now presents accounts as OneID: one sign-in and account marker across chats, people, money, services, local commerce, support, and profile surfaces.

- Added `oneId` to profile state and self user-record snapshots.
- Added `src/identity.js` for deterministic `FOX-...` OneID generation.
- Local fallback profiles and Firebase profiles now preserve or generate OneID.
- Firestore rules validate and allow the OneID field on `users/{uid}`.
- The sign-in/onboarding page and profile panel now show OneID copy.
- Synced the updated web bundle into Android and iOS wrappers.
- Deployed Hosting and Firestore rules to `foxhub-superapp`.
- Detailed record: `docs/ONEID_ROLLOUT_2026-04-19.md`

Verified:

- `node --check src/identity.js` (pass)
- `npm test` (pass)
- `npm run build` (pass)
- `npm run sync:android` (pass)
- `npm run sync:ios` (pass)
- `npx firebase-tools deploy --only hosting,firestore:rules --project foxhub-superapp` (pass)

## 2026-04-19 100-service catalog

FoxHub Services now includes a larger service catalog and merchant-side access to the same useful services.

- Expanded Services from 5 starter services to 100 services.
- Organized services into 10 categories with 10 services each: Identity, Money, Market, Food, Events, Work, Housing, Mobility, Business, and Community.
- Added a searchable/filterable `Catalog` tab under Services.
- Added `Merchant service catalog` inside the Shops/MerchantOS side so merchants can access business-ready service flows.
- Kept special behavior for QR scan, merchant pay, MerchantOS, RideGrid, and FoxTickets.
- Added generic routing for all other service cards.
- Synced Android and iOS wrappers.
- Deployed Hosting to `foxhub-superapp`.
- Detailed record: `docs/SERVICES_100_CATALOG_2026-04-19.md`

Verified:

- service count check: 100 total, 10 per category
- `npm test` (pass)
- `npm run build` (pass)
- `npm run sync:android` (pass)
- `npm run sync:ios` (pass)
- `npx firebase-tools deploy --only hosting --project foxhub-superapp` (pass)

## 2026-04-19 blue-collar service categories

FoxHub now has a simple category/subcategory layer for blue-collar services on both the user and merchant sides.

- Added 10 plain-language categories.
- Added 147 subcategories across home repair, construction, outdoor care, cleaning, moving, auto/equipment, food/events, business/facilities, safety/remediation, and local task help.
- Added 40 lightweight support components for quote, scope, scheduling, proof, payment, trust, compliance, and follow-up needs.
- Added the category panel to the user Services `Catalog` tab.
- Added the same category panel to the merchant `Shops` view with merchant-facing labels.
- Kept the GUI simple with category chips, selected subcategory chips, and short component chips.
- Synced Android and iOS wrappers.
- Deployed Hosting to `foxhub-superapp`.
- Detailed record: `docs/BLUE_COLLAR_SERVICE_CATS_2026-04-19.md`

Verified:

- category count check: 10 categories, 147 subcategories, 40 components
- `npm test` (pass)
- `npm run build` (pass)
- `npm run sync:android` (pass)
- `npm run sync:ios` (pass)
- `npx firebase-tools deploy --only hosting --project foxhub-superapp` (pass)

## 2026-04-19 white-collar service categories

FoxHub now has a matching category/subcategory layer for professional services on both the user and merchant sides.

- Added 10 white-collar categories.
- Added 140 subcategories across business admin, finance/accounting, legal/compliance, marketing/growth, creative/content, tech/digital, sales/customer, HR/talent, real estate professional, and education/consulting.
- Added 40 lightweight support components for intake, documents, approvals, reporting, campaigns, creative briefs, access, lead pipeline, hiring, property files, and training outcomes.
- Reused the same simple category panel used by blue-collar services.
- Added the section to the user Services `Catalog` tab.
- Added the section to the merchant `Shops` view with merchant-facing labels.
- Synced Android and iOS wrappers.
- Deployed Hosting to `foxhub-superapp`.
- Detailed record: `docs/WHITE_COLLAR_SERVICE_CATS_2026-04-19.md`

Verified:

- white-collar count check: 10 categories, 140 subcategories, 40 components
- blue-collar count check still passes: 10 categories, 147 subcategories, 40 components
- `npm test` (pass)
- `npm run build` (pass)
- `npm run sync:android` (pass)
- `npm run sync:ios` (pass)
- `npx firebase-tools deploy --only hosting --project foxhub-superapp` (pass)

## 2026-04-19 black-collar service categories

FoxHub now has a matching category/subcategory layer for heavy, dirty, hazardous, industrial, energy, waste, field, transport, and infrastructure services on both the user and merchant sides.

- Added 10 black-collar categories.
- Added 140 subcategories across industrial maintenance, waste/environmental, energy/utilities, oil/gas/field, mining/materials, demolition/salvage, heavy transport, marine/rail/aviation, hazard/confined space, and infrastructure/civil.
- Added 40 lightweight support components for site access, safety checks, work orders, manifests, dispatch, permits, service logs, disposal proof, load details, inspection notes, and completion photos.
- Reused the same simple category panel used by blue-collar and white-collar services.
- Added the section to the user Services `Catalog` tab.
- Added the section to the merchant `Shops` view with merchant-facing labels.
- Synced Android and iOS wrappers.
- Deployed Hosting to `foxhub-superapp`.
- Detailed record: `docs/BLACK_COLLAR_SERVICE_CATS_2026-04-19.md`

Verified:

- black-collar count check: 10 categories, 140 subcategories, 40 components
- blue-collar count check still passes: 10 categories, 147 subcategories, 40 components
- white-collar count check still passes: 10 categories, 140 subcategories, 40 components
- `npm test` (pass)
- `npm run build` (pass)
- `npm run sync:android` (pass)
- `npm run sync:ios` (pass)
- `npx firebase-tools deploy --only hosting --project foxhub-superapp` (pass)

## 2026-04-19 expanded collar service categories

FoxHub now includes yellow, green, pink, brown, and purple collar category/subcategory layers on both the user and merchant sides.

- Added yellow-collar creative/media/design/production categories: 10 categories, 140 subcategories, 40 components.
- Added green-collar environmental/sustainability categories: 10 categories, 140 subcategories, 40 components.
- Added pink-collar care/service/education/hospitality categories: 10 categories, 140 subcategories, 40 components.
- Added brown-collar civic/public-works/field-operations categories: 10 categories, 140 subcategories, 40 components.
- Added purple-collar hybrid technical/operations categories: 10 categories, 140 subcategories, 40 components.
- Reused the same simple category panel for user Services `Catalog` and merchant `Shops`.
- Synced Android and iOS wrappers.
- Deployed Hosting to `foxhub-superapp`.
- Detailed record: `docs/EXPANDED_COLLAR_SERVICE_CATS_2026-04-19.md`

Verified:

- collar count check: blue 10/147/40; white, black, yellow, green, pink, brown, and purple each 10/140/40
- `npm test` (pass)
- `npm run build` (pass)
- `npm run sync:android` (pass)
- `npm run sync:ios` (pass)
- `npx firebase-tools deploy --only hosting --project foxhub-superapp` (pass)
- live Hosting bundle contains the added collar labels and representative category data (pass)

## 2026-04-19 WeChat non-video parity install

FoxHub Services now includes a simple `Parity` tab for remaining WeChat-style gaps, excluding Channels/short-video.

- Added 11 installed workflow packs.
- Added 118 checklist items.
- Covered messaging/media readiness, social/group privacy, official accounts, mini-program platform, payments, commerce, search, ads, trust/safety, notifications, and platform/developer/enterprise.
- Kept the install simple: no extra enhancement pass and no claim that external payment, bank, call, SMS, or native push rails are live.
- Detailed record: `docs/WECHAT_NON_VIDEO_PARITY_INSTALL_2026-04-19.md`

Verified:

- parity count check: 11 packs, 118 checklist items
- `npm test` (pass)
- `npm run build` (pass)
- `npm run sync:android` (pass)
- `npm run sync:ios` (pass)
- `npx firebase-tools deploy --only hosting --project foxhub-superapp` (pass)
- live Hosting bundle contains the Parity tab label and representative pack names (pass)

## 2026-04-19 Android APK refresh

Refreshed the Android debug APK after the WeChat non-video parity install.

- Synced the current Vite build into the Capacitor Android wrapper.
- Built the Android debug APK with Java 21.
- Copied the fresh output to `release/FoxHub-Android-Debug-0.1.0.apk`.
- Confirmed the APK contains the current web bundle `assets/index-BYEhnIsh.js`.

Verified:

- `npm run sync:android` (pass)
- `JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64 ./gradlew --no-daemon assembleDebug -Djava.net.preferIPv4Stack=true` from `android/` (pass)
- `file release/FoxHub-Android-Debug-0.1.0.apk` confirms Android package with APK signing block
- APK index.html references the current bundle (pass)

## 2026-04-18 Android APK build

Built a direct-install Android debug APK for FoxHub.

- Synced the latest Vite build into the Capacitor Android wrapper.
- Added local Android SDK path configuration for this machine.
- Built with Java 21 because the current Android/Capacitor stack expects source release 21.
- Output:
  - `release/FoxHub-Android-Debug-0.1.0.apk`
  - `android/app/build/outputs/apk/debug/app-debug.apk`
- Verified:
  - `npm run sync:android` (pass)
  - `JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64 ./gradlew assembleDebug` (pass)
  - APK file check confirms Android package with APK signing block
- Detailed record: `docs/ANDROID_APK_BUILD_2026-04-18.md`

## 2026-04-17 green color pass

Changed FoxHub's solid blue accent and shading system to solid green.

- Updated `src/styles.css` accent variables, selected states, focus rings, tabs, buttons, cool cards, borders, and light background shading.
- Removed the old solid blue accent values from the built web bundle and synced mobile wrapper bundles.
- Deployed Firebase Hosting after the color change.
- Synced iOS and Android wrappers after the new bundle was built.
- Current built assets include:
  - `index-B8uw8eJG.js`
  - `FoxHubShell-DOqL22oz.js`
  - `index-Qsw34WaC.css`
- Verified:
  - `npm test` (pass)
  - `npm run build` (pass)
  - Firebase Hosting deploy (pass)
  - `npm run sync:ios` (pass)
  - `npm run sync:android` (pass)

## 2026-04-17 fox-head logo pass

Replaced the visible FoxHub `F` brand mark with a vector fox-head mark.

- Added a shared `FoxHeadMark` SVG component.
- Replaced the header brand mark, landing-page brand mark, and Fox Board navigation glyph.
- Kept the mark color-driven so it follows the green accent system and active navigation states.
- Deployed Firebase Hosting after the logo change.
- Synced iOS and Android wrappers after the new bundle was built.
- Current built assets include:
  - `index-DZas8ITg.js`
  - `FoxHubShell-hQOOj-3N.js`
  - `index-C0hlL3G_.css`
- Verified:
  - `npm test` (pass)
  - `npm run build` (pass)
  - Firebase Hosting deploy (pass)
  - `npm run sync:ios` (pass)
  - `npm run sync:android` (pass)
  - live Hosting page references the latest bundle (pass)

## 2026-04-17 Start Near Me pass

Installed the plain-language beginner path and location-based entry component in Fox Board.

- Added a `Start Here` area that asks `What do you want to do today?`
- Added city entry and save behavior using the existing profile city field.
- Added browser location permission handling with a manual city fallback.
- Added local preview counts for listings, people, and tools.
- Added simple next-step buttons:
  - Find help near me
  - Buy or sell nearby
  - Meet local people
  - Find work or gigs
  - Post what I need
  - Manage my business
- Kept the component tied to existing rooms instead of adding a new backend shape.
- Deployed Firebase Hosting after the install.
- Synced iOS and Android wrappers after the new bundle was built.
- Current built assets include:
  - `index-CzRbhwGh.js`
  - `FoxHubShell-99D-rYT7.js`
  - `index-DdWcRVPM.css`
- Verified:
  - `npm test` (pass)
  - `npm run build` (pass)
  - Firebase Hosting deploy (pass)
  - `npm run sync:ios` (pass)
  - `npm run sync:android` (pass)
  - live Hosting page references the latest bundle (pass)

## 2026-04-17 security smoke pass

Ran a focused security smoke against Firebase rules, client operator handling, webhook behavior, hosted headers, build, and tests.

- Patched Firestore operator authority so platform-wide operator access now requires the `platformOperator` custom claim instead of trusting an email address.
- Patched invite creation rules so only onboarded `active` or `priority` users can create active invite codes.
- Split the large profile rule validator into smaller rule functions so Firestore rules compile and deploy cleanly.
- Patched client-side operator access seeding to require the same `platformOperator` custom claim before creating an operator access document.
- Patched Functions ops-secret verification to fail closed when `FOXHUB_OPS_WEBHOOK_SECRET` is not configured.
- Deployed Firestore rules and Hosting.
- Functions deployment is blocked until the Firebase project is upgraded to Blaze, so the fail-closed Functions patch is committed locally but not live yet.
- Verified:
  - `node --check functions/index.js` (pass)
  - `npm test` (pass)
  - `npm run build` (pass)
  - hosted security headers present on `/`
  - hosted `/signin` renders

## 2026-04-17 social wording pass

Reworked visible FoxHub wording so the product feels less technical and more approachable for everyday users.

- Renamed visible rooms and proof points:
  - `Growth OS` became `Grow Locally`
  - `UX/UI` became `Goodies`
  - `Blueprint` became `Organizer`
  - `Production` became `Back Room`
- Replaced user-facing phrases such as `backend`, `runtime`, `boilerplates`, `production components`, and `platform components` with friendlier language like live connection, mini app session, helpful links, helpers, and organizer rooms.
- Reworded sign-in, loading, landing-page proof points, Grow Locally, Goodies, Back Room, Organizer, Footer, and Mini Apps copy.
- Kept internal code names and documentation identifiers stable where changing them would risk behavior.
- Verified:
  - `npm test` (pass)
  - `npm run build` (pass)

## 2026-04-17 mobile wrapper refresh

Synced the latest FoxHub web bundle into the iOS and Android Capacitor wrappers.

- `npm run sync:ios` passed.
- `npm run sync:android` passed.
- iOS wrapper assets now point at the latest built files, including `index-B0uogFlE.js` and `FoxHubShell-CPGpm9Es.js`.
- Android wrapper assets now point at the latest built files, including `index-B0uogFlE.js` and `FoxHubShell-CPGpm9Es.js`.
- Verified the synced wrapper bundles contain the new `Grow Locally`, `Goodies`, `Organizer`, `Back Room`, and landing proof-point wording.
- Android native `assembleDebug` was attempted but is blocked by the host Java version:
  - current JVM: Java 25 early access
  - Gradle/Groovy error: `Unsupported class file major version 69`
  - use JDK 17 before rerunning the native Android build
- iOS native build is blocked in this environment because `xcodebuild` is not installed.

## 2026-04-17 Growth OS 17-category pass

Installed all 17 requested enrichment categories as a first-class `Growth OS` workspace.

- Added `Growth OS` to primary navigation.
- Grouped the 17 categories by relevance:
  - Entry And Identity
  - Local Commerce
  - Community And Creators
  - Trust And Money
  - Operations And Intelligence
  - Public Growth And Sales
- Added 17 visible categories:
  - Clear FoxHub Story
  - Role-Based Onboarding Wizard
  - Fox Pass Profile
  - Local Services Marketplace
  - Booking And Request Flows
  - Business Mini-Stores
  - Deals Near Me
  - Neighborhood Rooms
  - Trust And Safety Layer
  - Fox Wallet Money Path
  - Creator And Influencer Tools
  - Operator Dashboard
  - Better Search
  - Smart Recommendations
  - Public Directory And SEO
  - Demo Data Mode
  - Build My Platform Showcase
- Added Activate, Run, Open, Activate all 17, Run all 17, Activate visible group, and Run visible group controls.
- Added Growth OS event and output records.
- Added group labels to Growth OS categories, outputs, and event records.
- Added a visible payment friction guard covering pricing, fee disclosure, holds, receipts, refunds, payout setup, disputes, and setup warnings before checkout.
- Added Firebase persistence and Firestore rule allowances for Growth OS state.

Detailed implementation notes:

- `docs/GROWTH_OS_17_INSTALL_2026-04-17.md`

## 2026-04-17 responsive optimization pass

Optimized the FoxHub shell for phone and desktop use.

- Added safer phone spacing with safe-area bottom padding.
- Converted phone bottom navigation to a fixed thumb-reachable bar.
- Added stronger single-column fallbacks for dense panels, cards, forms, listings, and Blueprint rows.
- Tightened phone header actions and touch targets.
- Added overflow guards for cards, panels, images, action rows, and long text.
- Expanded desktop workspace sizing for wide monitors.
- Improved desktop rail and multi-column workspace proportions across mid-size and wide screens.
- Verified:
  - `npm test` (pass)

## 2026-04-17 landing page pass

Added a dedicated unauthenticated landing page at `/`.

- Landing page uses photo-led community, local business, and deal-flow imagery.
- Incentive copy introduces the value of chats, commerce, services, payments, saved context, invites, and trust systems.
- `Sign in` routes to the existing focused `/signin` page.
- `/landing` is available as an explicit public landing route, including for browsers that already have an active session.
- `Sign up` opens the existing account creation overlay without replacing the sign-in page.
- Verified:
  - `npm test` (pass)
  - `npm run build` (pass)

## 2026-04-17 production components pass

Installed and functionalized the next production-readiness component set.

- Added `@capacitor/push-notifications`.
- Added a `Production` tab inside Services.
- Added 12 actionable production components:
  - server-owned backend
  - native push delivery
  - media and document storage
  - phone and identity hardening
  - custom claims and RBAC
  - payment webhook controls
  - backend search indexing
  - mini-app sandbox SDK
  - maps and local commerce
  - moderation pipeline
  - analytics warehouse export
  - regression smoke pack
- Added `Activate` and `Run` controls for every component.
- Added operational output records for every run.
- Added Firebase persistence and Firestore rule allowances for production-readiness state.
- Added Functions endpoints:
  - `productionOpsWebhook`
  - `pushDeliveryRequest`
- Verified:
  - `node --check functions/index.js` (pass)
  - `npm run build` (pass)

Detailed implementation notes:

- `docs/PRODUCTION_COMPONENTS_INSTALL_2026-04-17.md`

## 2026-04-17 UX/UI features pass

Installed and functionalized the 20 requested UX/UI features in the requested order.

- Added a first-class `UX/UI` navigation room.
- Added an ordered 20-feature UX/UI registry.
- Added `Activate`, `Run`, `Activate all 20`, and `Run all in order` controls.
- Expanded the command overlay so UX/UI features can be run directly.
- Added a global guided `Create` button.
- Added visible panels for:
  - Today dashboard
  - context-aware rail
  - inbox modes
  - trust badges
  - onboarding progress
  - payment stepper
  - operator review console
  - latest UX output
- Added UX/UI store state and feature-specific output records.
- Added Firebase persistence and Firestore rule allowances for the UX/UI state arrays.
- Verified:
  - `npm test` (pass)
  - `npm run build` (pass)

Detailed implementation notes:

- `docs/UX_UI_FEATURES_INSTALL_2026-04-17.md`
- `docs/HANDOFF_2026-04-17.md`

## 2026-04-12 Blueprint functionalization pass

Implemented the 100-component Blueprint room and made the registry actionable.

- Added `Blueprint` as a primary left-rail room.
- Exposed the 100 installed structural components by category.
- Added search, enabled counts, recent Blueprint analytics, and reliability queue output.
- Added per-component `Enable`, category action, and `Open` controls.
- Wired category actions into existing runtime mechanics:
  - feature flags
  - analytics
  - reliability queue
  - unified search
  - trust engine
  - reputation graph
  - MerchantOS risk checks
  - wallet risk checks
  - compliance control review
  - operator copilot
  - mini-program runtime registration
  - smart matchmaking
- Verified:
  - `npm run build` (pass)
- Deployed:
  - `npm run deploy:hosting` (pass)
  - live URL: `https://foxhub-superapp.web.app`

Detailed implementation notes:

- `docs/BLUEPRINT_FUNCTIONALIZATION_2026-04-12.md`

## 2026-04-13 profile persistence fix

Fixed the Profile modal save path for Firebase-backed sessions.

- `src/repository-firebase.js` now returns the persisted signed-in user document during initial `loadState()` instead of returning only the seeded shell and waiting for snapshots to catch up.
- Profile writes now include `mechanicsUpdatedAt`, which Firestore rules require on every user document update.
- `firestore.rules` now accepts the full current profile shape, including:
  - `verifiedPerformerSubscribed`
  - `verifiedPerformerStatus`
  - `verifiedPerformerPlan`
  - `verifiedPerformerSince`
- `firestore.rules` now permits state-only merges to keep `updatedAt` unchanged as long as profile identity fields are unchanged.
- `src/App.jsx` now surfaces profile save errors instead of leaving failed saves unclear.
- `src/repository-local.js` now keeps a local profile registry keyed by email in `foxhub-alpha-profiles`.
- Local fallback sign-in now restores the saved profile for that email instead of rebuilding a blank profile from the sign-in form.
- Local fallback sign-out now preserves the last profile and marks the session unauthenticated instead of replacing storage with a seed profile.
- Added `tests/local-profile-persistence.test.mjs` to guard the exact local save/sign-out/sign-in regression.
- Added `npm test` as the project test command.
- Verified:
  - `npm test` (pass)
  - `npm run build` (pass)
  - local repository save/sign-out/sign-in simulation (pass)
- Deployed:
  - Firebase Hosting and Firestore rules (pass)
  - Firebase Hosting redeploy after regression test addition (pass)
  - live URL: `https://foxhub-superapp.web.app`

## 2026-04-12 mobile wrapper sync

Synced the latest Blueprint-functionalized web bundle into both Capacitor native wrappers.

- iOS:
  - `npm run sync:ios` (pass)
  - copied web assets to `ios/App/App/public`
  - updated Capacitor iOS plugin metadata
- Android:
  - `npm run sync:android` (pass)
  - copied web assets to `android/app/src/main/assets/public`
  - updated Capacitor Android plugin metadata

Detailed sync notes:

- `docs/MOBILE_WRAPPER_SYNC_2026-04-12.md`

## 2026-04-10 platform component pass

Implemented and wired all requested platform component families:

- unified search + action
- trust score engine
- escrow + dispute center
- reputation graph + endorsements
- smart matchmaking
- operator copilot
- notification intelligence
- creator/business conversion stack
- mini-app runtime controls
- reliability queue + flush path
- analytics + feature flags + experiments
- wallet fraud/risk checks

This pass includes store APIs, normalized state shape, and a Home workspace command surface for operational use.
Detailed implementation notes:

- `docs/PLATFORM_COMPONENTS_AND_OPTIMIZATION_2026-04-10.md`

## 2026-04-10 optimization, validation, and deploy

- Removed static local-repository import from `src/useFoxHubStore.js` so repository loading follows dynamic split paths.
- Exported newly added feature-pack handlers from the store return object to ensure complete app-level availability.
- Verified:
  - `npm run build` (pass)
  - `npm run preview -- --host 127.0.0.1 --port 4174` with route checks
    - `/` -> `200`
    - `/signin` -> `200`
- Deployed:
  - `npm run deploy:hosting` (pass)
  - live URL: `https://foxhub-superapp.web.app`

## What is working now

- day/night theme toggle with persisted preference
- invite-backed priority access during signup
- monthly verification review path for non-invited accounts
- onboarding lock while access is still under review
- context rail and visible-count toolbar UX
- chat filters and pinned-thread strip
- official hub cards on Home
- recent mini-program strip in Services
- filtered empty-state guidance
- onboarding shell with local identity entry
- email/password sign-up and sign-in in Firebase mode
- session-based Firebase auth persistence
- sign-out flow
- profile edit modal
- profile invite creation
- first-run tutorial assistant with persisted dismissal
- profile demographic and occupation fields
- chat thread selection
- message composition
- thread unread counts
- thread/contact presence indicators
- per-message send/delivered/seen status progression for local outbound messages
- contacts list and direct-thread creation
- circles list
- wallet activity actions
- channels surface
- moments-style feed with posting
- discover surface and mini-app launcher shell
- QR-style service shortcuts
- official-account posts layered onto the broadcast surface
- first-class saved items alongside favorites
- mini-app permission history
- QR actions that mutate app state instead of only acting as placeholders
- deeper user database records with identity, trust, wallet, lifecycle, security, and business fields
- chat-first default navigation
- official account subscriptions and service-channel threads
- QR history and service continuity state
- mini-app ranking informed by continuity, recency, thread, and circle context
- relationship-score strengthening on direct contact usage
- 10-minute inactivity sign-out
- persistent footer-level Legal / Company / Product sections
- visible shell-level sign-out controls
- FAQ surface inside Services
- expanded footer boilerplate content for FAQ / legal / company / product
- broader API connector registry including mainstream commerce, CRM, AI, and finance providers
- premium visual refinement pass across the shell
- Windows desktop wrapper path via Electron
- operator queue for verification follow-up and trust review
- notification center and audit trail surfaces in Services
- device-session tracking with revoke actions
- durable rating records, moderation queue entries, and reputation snapshots
- document vault and operator action log
- verification follow-up automatically created from listing review, listing flag, merchant payment hold, and cash-out hold flows
- Google sign-in in Firebase mode
- email-link sign-in initiation in Firebase mode
- durable profile presence tracking with `presenceState`, `lastSeenAt`, and `lastActiveAt`
- durable `threadReadState` records instead of only UI unread clearing
- browser notification registration and permission tracking
- synced self `userRecords` in the Firebase-backed profile state
- server-owned `/operatorAccess/{uid}` records for platform operator access
- shell-level GUI surfaces for `threadReadState`, `userRecords`, `notificationSubscriptions`, and `operatorAccessRecords`
- clearer feature placement: chat state in `Chats`, member records in `Network`, and account/access controls in `Services`

## Backend behavior now

### Local mode

- active when Firebase env vars are absent
- stores state in browser local storage
- keeps the app usable for rapid product iteration

### Firebase mode

- active when Vite Firebase env vars are present
- initializes Firebase app, auth, and Firestore
- uses email/password sign-up and sign-in
- supports Google popup sign-in
- supports email-link sign-in initiation
- seeds Firestore documents for a fresh user
- restores state through Firestore snapshot subscriptions
- restores the signed-in profile document directly on initial load before live snapshots update the shell

### Locked native mode

- active when FoxHub runs inside Capacitor and Firebase env vars are absent
- disables the writable local repository on iOS and Android
- exposes a secure setup message instead of allowing local mobile sign-in
- forces native releases toward the Firebase-backed path

## Current super-app mechanics

- chat is the default landing surface
- QR flows now create persistent operational state, not just placeholder actions
- wallet and merchant flows now leave thread-linked traces
- official accounts now map into seeded service-channel threads
- service launches now write continuity state so recent context can be recovered
- discovery ranking now reflects continuity and recency instead of only static list order

## Current frontend baseline

- phone and desktop now use distinct but shared-brand shells
- boilerplates are rendered as footnotes, not primary feature blocks
- the header includes a live day/night toggle
- the toolbar includes visible-result context plus density controls
- Home, Chats, and Services now have stronger quick-entry UX instead of relying on raw lists only
- shared if/then display rules are now centralized in `src/rules.js`

## Current access model

- invited users get `Priority access`
- non-invited users enter `Monthly verification review`
- waitlisted users cannot finish onboarding until the review window clears
- access metadata is persisted in both local and Firebase repository paths
- invite creation and redemption state is persisted

## Important files

- `src/main.jsx`
- `src/App.jsx`
- `src/FoxHubShell.jsx`
- `src/useFoxHubStore.js`
- `src/repository.js`
- `src/repository-local.js`
- `src/repository-firebase.js`
- `src/firebase.js`
- `src/data.js`
- `src/styles.css`

## Build status

Verified on 2026-04-13:

- `npm run build`
- Firebase Hosting deploy to `foxhub-superapp`
- Firestore rules deploy to `foxhub-superapp`

The build currently succeeds.

## Live deployment

- Hosting URL: `https://foxhub-superapp.web.app`
- Firebase project: `foxhub-superapp`

## Current performance note

The app previously bundled too much into the main entry chunk. That was reduced by code-splitting.

Current approximate build output:

- main entry chunk: `50 kB`
- authenticated shell chunk: `37 kB`
- Firebase repository coordinator chunk: `11 kB`
- Firebase auth chunk: `167 kB`
- Firebase Firestore chunk: `306 kB`

The Firebase path is now split into smaller chunks, so the backend code no longer rides in one oversized slab on the first-load path.

## Mobile hardening now in place

- native iOS and Android builds no longer fall back to the writable local repository
- iOS now explicitly disables arbitrary loads and file sharing in `Info.plist`
- Android now explicitly disables backup extraction and cleartext traffic in `AndroidManifest.xml`
- `capacitor.config.json` keeps secure transport defaults for native builds

## Current known limitations

- Firebase auth does not yet support phone sign-in
- operator roles are still seeded by repo-side email rules and Firestore docs, not custom auth claims
- unread counts are still thread-level UI state in places even though `threadReadState` is now persisted
- presence is persisted, but there is still no dedicated realtime presence backend outside the app state flow
- no media uploads
- no native push delivery for iOS or Android
- no payment processor integration
- no production-grade server-owned moderation backend
- Windows installer packaging is not yet fully reliable from this Linux host, though the unpacked Windows app is generated successfully

## Latest documented expansion

- `docs/PLATFORM_EXPANSION_AND_SECURITY_2026-04-03.md`
- `docs/OPS_TRUST_AND_EVIDENCE_2026-04-03.md`
- `docs/AUTH_PRESENCE_AND_OPERATOR_ACCESS_2026-04-03.md`
- `docs/GUI_FEATURE_WIRING_2026-04-03.md`

## Recommended next steps

- move document and media handling to real storage-backed objects instead of client-seeded records
- add server-trusted operator and admin authorization beyond client/runtime logic
- add push delivery infrastructure for notifications and operational events
- keep building official-account subscriptions, QR history, and service continuity as durable cross-device state

## Runtime issues fixed

### 2026-04-02: stale local state shape after feature expansion

Observed behavior:

- the live site could still break for returning local-mode users
- builds and fresh sessions still looked healthy

Root cause:

- older browser `localStorage` snapshots did not include newly added arrays such as `officialAccounts`, `searchScopes`, `utilityCards`, `favorites`, and `miniAppRecents`
- newer UI code expected those arrays to exist

Fix applied:

- changed `src/repository-local.js` to merge stored state onto fresh defaults instead of trusting the saved snapshot shape
- rebuilt and redeployed the corrected Hosting bundle

### 2026-04-02: React hook-order failure in `src/App.jsx`

Observed behavior:

- app built successfully
- live site still failed to load correctly at runtime

Root cause:

- `src/App.jsx` returned early while `state` was `null`
- several `useMemo` hooks were declared after that early return
- once state loaded, React saw a different hook order across renders

Fix applied:

- moved the memoized derived state above the loading return
- rebuilt and redeployed the corrected Hosting bundle

### 2026-04-03: blank Hosting page caused by missing store destructure in `src/App.jsx`

Observed behavior:

- `https://foxhub-superapp.web.app` rendered a blank page
- the live DOM kept an empty `#root`
- build output still looked healthy

Actual root cause:

- `src/App.jsx` passed `resolveLocalListing`, `updateCreatorOrder`, and `logDemandSignal` into `FoxHubShell`
- those identifiers were not actually destructured from `useFoxHubStore()`
- the live site threw a top-level `ReferenceError` before React mounted

Fix applied:

- added the missing store action destructures in `src/App.jsx`
- rebuilt and redeployed
- documented the incident in `docs/RUNTIME_BLANK_SCREEN_2026-04-03.md`

### 2026-04-03: Home tab appeared empty because `FoxHubShell` did not fully wire Home actions

Observed behavior:

- the app loaded
- `Chats`, `Market`, and other tabs worked
- `Home` appeared empty

Actual root cause:

- `HomeWorkspace` used action props that were not fully passed through the shell
- the `HomeWorkspace` invocation in `src/FoxHubShell.jsx` was missing `openCommunityChannel`, `resolveLocalListing`, `updateCreatorOrder`, and `logDemandSignal`
- `src/App.jsx` also passed `startShakeMatch` and `logFileTransfer` into `FoxHubShell`, but `FoxHubShell` did not accept them in its own top-level signature
- the live site reproduced a Home-only runtime exception:
  - `ReferenceError: startShakeMatch is not defined`

Fix applied:

- updated `src/FoxHubShell.jsx` to pass the missing Home props into `HomeWorkspace`
- updated the top-level `FoxHubShell` signature to accept `startShakeMatch` and `logFileTransfer`
- rebuilt, redeployed, and verified the live `Home` tab in Chromium

- `docs/HOME_WIDGET_RUNTIME_FIX_2026-04-03.md`

## Latest documented expansion

The combined late-session expansion work is documented in:

- `docs/PLATFORM_EXPANSION_AND_SECURITY_2026-04-03.md`

## Recommended next steps

1. add real auth methods
2. persist `userRecords`, saved items, and mini-app permissions in Firebase mode
3. add Firestore security rules for the new collections before they become durable
4. add editable profile, merchant, and trust workflows on top of the deeper user schema
5. add presence and unread counters as true backend state
6. add media attachments and notifications
7. persist official-account subscriptions, QR history, and service continuity as durable backend state

## 2026-06-13 Expo React Native mobile migration

FoxHub's active mobile build path moved from Capacitor wrappers to an Expo/React Native app in `mobile/`.

Changed:

- added `mobile/App.js` with a native FoxHub mobile shell
- added `mobile/src/foxhubMobileCore.js` for mobile auth/profile rules
- added `mobile/scripts/mobile-smoke.mjs`
- removed root Capacitor dependencies and generated `ios/`, `android/`, and `capacitor.config.json`
- replaced root mobile scripts with Expo commands

Verification passed:

- `npm test`
- `npm run smoke:public`
- `npm run mobile:smoke`

Detailed migration note:

- `docs/EXPO_REACT_NATIVE_MIGRATION_2026-06-13.md`

## Related recovery docs

- `docs/IOS_WRAPPER_SETUP_2026-04-02.md`
- `docs/ANDROID_WRAPPER_SETUP_2026-04-02.md`
- `docs/MOBILE_TAMPER_RESISTANCE_2026-04-02.md`
- `docs/SUPERAPP_MECHANICS_2026-04-02.md`
- `docs/FRONTEND_AUDIT_AND_ACCESS_2026-04-02.md`

## 2026-06-25 GitHub Upload Note

- Uploaded FoxHub to GitHub repository `https://github.com/PlugzTech/AdventureCode-Projects`.
- Repository subfolder: `foxhub/`.
- Upload commit: `65920a4 Add FoxHub CLTCH EstateHat and ExcelBolt projects`.
- The GitHub copy is source-focused. It intentionally excludes local dependencies, build output, Firebase cache, release packages, environment files, local databases, and generated wrapper assets.
- The GitHub repository is currently public, so do not commit credentials, private user data, local Firebase smoke credentials, or unpublished operational secrets.
