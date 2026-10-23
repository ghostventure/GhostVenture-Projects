# CLTCH.NTWRK 200-Feature Implementation Checklist

Only checked items count as delivered. Unchecked items are candidates that need an audit against existing behavior before implementation; do not count duplicates, labels, or plans. The generated 5,000-record Ops placeholder catalog is not a feature and was removed.

## Account data and privacy

- [x] 001. Account-scoped host profile draft storage — verified in app/profile-drafts.js
- [x] 002. Seven-day profile draft expiry and stale-record removal — verified in app/profile-drafts.js
- [x] 003. Browser storage failure fallback with visible status — verified in app/profile-drafts.js
- [x] 004. Save drafts when the page is hidden or closed — verified in app/profile-drafts.js
- [x] 005. Clear the current account's local draft — verified in both profile pages
- [x] 006. UID-scoped account and profile JSON copy — verified in app/account-export.js
- [x] 007. Confirmation and payout-data disclosure before export — verified in both profile pages
- [x] 008. Firestore timestamp conversion and temporary download URL cleanup — verified in app/account-export.js
- [x] 009. Host and performer profiles save a deletion request after password/Google identity recheck and show its owner-readable status; this does not notify staff or delete data, so support contact and processing are still required — `host-profile.html`, `musician-profile.html`, `firestore.rules`
- [x] 010. Host and performer account export includes account/profile docs, linked gigs, accepted-booking messages, authored/received reviews, and local portfolio metadata; media file contents and inaccessible records are not included — `app/account-export.js`, both profile pages; `npm run smoke:account-export`

## Identity and authentication

- [ ] 011. Passkey registration and sign-in
- [ ] 012. Multi-factor setup and recovery codes
- [ ] 013. Active device list and session revocation
- [ ] 014. New device sign-in notification
- [ ] 015. Recent security events page
- [ ] 016. Email change verification with rollback
- [x] 017. Rechecks password or Google identity before host/performer name, contact, ZIP, and payout edits, Stripe payout onboarding, Plugz membership connection, Business Class/Verified Performer changes, and deletion requests; unsupported sign-in providers cannot proceed — both profile pages; `app/reauthenticate-sensitive.js`; `npm run smoke:reauthenticate-sensitive`
- [ ] 018. Suspicious login challenge and rate limiting
- [ ] 019. Recovery contact setup and verification
- [ ] 020. Sign-in provider linking and unlinking validation

## Host and venue workflows

- [x] 021. Browser-local saved gig templates scoped by host UID (up to 8; not synced across devices) — `host.html`, `app/gig-templates.js`; `npm run smoke:gig-templates`
- [x] 022. Weekly or biweekly repeat-post batch (up to 12 separate gig documents, atomic Firestore write) — `host.html`, `app/gig-series.js`; `npm run smoke:gig-series`
- [x] 023. Per-event and aggregate host cost estimate for repeated gigs — `host.html`, `app/gig-budget.js`; `npm run smoke:gig-budget`
- [x] 024. Host-only browser-local venue contact roster (up to 12; not shared or used for notifications) — `venue-contacts.html`, `app/venue-contact-roster.js`
- [x] 025. Browser-local booking preparation checklist scoped per booking, with explicit private/not-confirmed status — `scripts/platform-components.js`, `booking.html`; Chromium isolation smoke
- [ ] 026. Rider and stage plan attachments with access controls
- [x] 027. Advisory duplicate gig detection by host, venue, route, date, and time before geocoding/posting — `host.html`, `app/duplicate-gig.js`; `npm run smoke:duplicate-gig`
- [ ] 028. Event change history
- [x] 029. Host-private cancellation reason prompt with bounded storage and explicit no-notification status — `host.html`, `booking.html`, `app/cancellation-reason.js`; `npm run smoke:cancellation-reason`
- [ ] 030. Venue profile verification with evidence

## Host team and scheduling

- [ ] 031. Host approval roles
- [x] 032. Host-gated browser-local venue accessibility checklist; avoids storing diagnoses or private accommodation details — `venue-accessibility.html`, `app/venue-accessibility-checklist.js`
- [x] 033. Host-scoped browser-local weekly/biweekly venue schedules applied to existing repeat-date and batch-post controls — `host.html`, `app/venue-preferences.js`
- [ ] 034. Booking approval roles for venue teams
- [ ] 035. Venue document expiry reminders
- [ ] 036. Duplicate booking merge flow
- [ ] 037. Host booking analytics export
- [x] 038. Filter confirmed bookings by date and export a bounded, escaped .ics file with explicit floating-time and one-hour defaults — `musician-dashboard.html`, `app/performer-agenda.js`; `npm run smoke:performer-agenda`
- [x] 039. Host-gated browser-local venue capacity and equipment reference (not published or shared) — `venue-details.html`, `app/venue-details.js`
- [x] 040. Venue-specific safety checklist

## Performer profile and media

- [x] 041. Escape stored performer and review strings before public HTML rendering — `performer-view.html`; `npm run smoke:performer-public-profile`
- [x] 042. Bound public-profile review reads to the newest 50 records — `performer-view.html`; `npm run smoke:performer-public-profile`
- [x] 043. Label the review sample accurately and isolate review-load failures from the profile — `performer-view.html`; `npm run smoke:performer-public-profile`
- [x] 044. Encode performer identifiers in the booking return link — `performer-view.html`; `npm run smoke:performer-public-profile`
- [x] 045. Private round-trip travel-fee calculator with validated manual route distance and no location sharing — `musician-profile.html`, `app/travel-fee.js`; `npm run smoke:travel-fee`
- [x] 046. Weekly all-day availability in an IANA timezone, checked against event-local instants; exact-date blackout exceptions and accepted same-local-date bookings take priority; DST gaps/overlaps and legacy gigs without event timezone show a fallback and remain date-only — `musician-profile.html`, `gig-radar.html`, `musician-dashboard.html`, `host.html`, `app/recurring-availability.js`, `firestore.rules`; `npm run smoke:recurring-availability`
- [ ] 047. Revocable calendar subscription feed
- [x] 048. Profile recommendations tied to missing fields
- [x] 049. Show a recoverable state when the performer profile cannot load — `performer-view.html`; `npm run smoke:performer-public-profile`
- [x] 050. Share or copy a performer profile link with accessible status feedback — `performer-view.html`; `npm run smoke:performer-public-profile`

## Performer earnings and teams

- [x] 051. One UID can create and use independent host and musician profiles; mode switch checks each profile independently, routes to the matching onboarding when missing, and server role authorization falls back to the corresponding existing profile — `app/mode-switch.js`, `app/user-db.js`, `host-profile.html`, `musician-profile.html`, `functions/index.js`, `firestore.rules`; `npm run smoke:multi-role-profiles`
- [ ] 052. Team representative permissions
- [ ] 053. Earnings history with fee and payout state
- [ ] 054. Tax document vault and annual download
- [x] 055. Gig preparation checklist
- [x] 056. Performer availability pause with optional local-date resume; resumed profiles re-enter Gig Radar and Matched Gigs — `musician-profile.html`, `app/availability-pause.js`, `firestore.rules`
- [x] 057. Safe portfolio URL manager — blocks scripts, credentials, duplicates, and oversized input; caps saved links at 20. Verified in scripts/smoke-portfolio-links.mjs.
- [x] 058. Performer review response and correction request — owner-only, one immutable response or correction request per review, publicly displayed with validated text; `performer-view.html`, `firestore.rules`; `npm run smoke:review-response`
- [x] 059. Copy a date-filtered upcoming booking itinerary with line-break sanitization — `musician-dashboard.html`, `app/performer-agenda.js`; `npm run smoke:performer-agenda`
- [ ] 060. Business profile verification checklist

## Discovery and search

- [x] 061. Export local search presets as JSON for browser-to-browser portability — `site-init.js`; Chromium export smoke
- [x] 062. Import page-scoped search presets with file-size, schema, search-length, filter, sort, duplicate, and count validation — `site-init.js`; Chromium import smoke
- [x] 063. Bounded minimum-pay filter with storage fallback, reset control, and accurate empty state — `gig-radar.html`, `app/gig-radar-filters.js`; `npm run smoke:gig-radar-filters`
- [x] 064. Save and restore one account-scoped combined open-gig search, reapplying phrase, performer type, date bounds, and minimum pay to live results — `gig-discovery.html`, `app/gig-discovery.js`, `app/gig-discovery-filters.js`; `npm run smoke:gig-discovery`
- [x] 065. Accessible map and list view — `gig-radar.html`, `app/gig-radar-map.js`; `npm run smoke:gig-radar-map-list`
- [x] 066. Stale listing suppression reason
- [x] 067. Same-date conflict advisory displays device timezone and states that event-time overlap is not verified — `musician-matched-gigs.html`
- [x] 068. Search relevance controls and reset
- [x] 069. Match feedback reason codes
- [x] 070. Clear browser-local CLTCH preferences, drafts, and named caches without removing Firebase auth or account data — `app/local-data.js`, `privacy.html`; `npm run smoke:local-data`

## Matching and marketplace trust

- [x] 071. Stable paginated search results
- [x] 072. Manual location substring filter over loaded Gig Discovery results; does not use device location or alter profile location — `gig-discovery.html`, `app/gig-discovery-filters.js`
- [x] 073. Approximate distance disclosure
- [x] 074. Persistent performer block of a host removes that host's open gigs from matching and prevents acceptance; owners can unblock from Gig Radar — `gig-radar.html`, `firestore.rules`; `npm run smoke:blocked-hosts`
- [x] 075. Filter-aware empty-state recovery
- [x] 076. Private median post-to-accept time from up to 50 accepted gigs, shown after five timestamped acceptances; excludes passes/declines — `musician-dashboard.html`, `firestore.indexes.json`
- [x] 077. Forward-only host cancellation record with explicit denominator — immutable server transaction counts host-initiated cancellations after a tracked acceptance out of server-recorded accepted booking transitions; performer cards show the tracked-since date and exclude earlier bookings; aggregate exposes counts only, not an overall reputation score — `functions/index.js`, `functions/host-reliability.js`, `firestore.rules`, `gig-radar.html`, `app/host-reliability.mjs`; `npm run smoke:host-reliability`
- [x] 078. Keyboard and screen-reader search results
- [x] 079. Accessible post-match performer comparison table — compares up to eight available, nearby, matching performers with labeled columns for role, genres, rate, and approximate distance; links to each public profile; `host.html`; `npm run smoke:performer-comparison`
- [x] 080. Alerts for new matching opportunities

## Booking lifecycle

- [x] 081. Server-only accept, cancel, reopen, and check-in transitions with participant authorization, one-way block checks, profile availability, IANA/DST-safe recurring weekdays, blackout, and performer-local date-conflict validation — `functions/index.js`, `functions/booking-policy.js`, `firestore.rules`; `npm run smoke:booking-server-policy`, `npm run smoke:booking-action`
- [x] 082. Idempotent accept, host/performer cancel, reopen, and check-in calls using transaction receipts plus stable same-payload retry IDs — `functions/index.js`, `app/booking-action.js`; `npm run smoke:booking-action`
- [x] 083. Booking action audit records store actor ID and server time in the same transaction as each status transition — `functions/index.js`, `firestore.rules`, `booking.html`; `npm run smoke:booking-action`
- [x] 084. Transactional acceptance checks and updates the performer booking-date cache with the gig, so concurrent acceptance retries revalidate availability and date conflicts — `functions/index.js`, `functions/booking-policy.js`; `npm run smoke:booking-server-policy`
- [x] 085. Accepted-participant printable booking receipt with sanitized fields, generated timestamp, and explicit payment/event disclaimers — `booking.html`, `app/booking-receipt.js`; `npm run smoke:booking-receipt`
- [x] 086. Performer check-in asks for consent and records the check-in through the authorized server action — `booking.html`, `musician-dashboard.html`, `musician-matched-gigs.html`, `gig-radar.html`, `functions/index.js`; `npm run smoke:booking-action`
- [x] 087. Account- and booking-scoped private note drafts auto-save in per-tab storage and recover after reload while offline; compare-before-overwrite resolves stale same-tab/cross-tab versions, with both local copies retained until the user chooses — browser-only, not synced; `scripts/platform-components.js`, `booking.html`; `npm run smoke:private-note-conflicts`
- [ ] 088. Two-party completion sign-off
- [x] 089. Two-party booking amendment proposals with explicit accept/decline by the other booking participant — `booking.html`, `functions/index.js`; `npm run smoke:booking-action`
- [ ] 090. Cancellation policy calculation before confirmation
  - Blocked pending an approved cancellation policy contract: current gig records contain pay and processing-fee amounts but no notice windows, party-specific liability rules, refund terms, or policy version. Do not infer cancellation costs from those amounts.

## Booking reliability and support

- [ ] 091. Opt-out booking reminders and quiet hours
- [x] 092. Bounded past accepted-booking recovery panel, with an isolated retry state and safe details route — `musician-dashboard.html`, `app/stale-booking-recovery.js`; `npm run smoke:stale-booking-recovery`
- [x] 093. Host booking health panel with explicit status/date counts, a 20-record detail bound, and isolated feed-error state — `host.html`, `app/booking-health.js`; `npm run smoke:booking-health`
- [x] 094. Accepted-booking incident report download with allowlisted metadata, bounded notes, and explicit local-only/not-sent status — `host.html`, `app/booking-incident-report.js`; `npm run smoke:booking-incident-report`
- [ ] 095. Evidence attachment retention controls
- [x] 096. Event-day participant contact actions: performer can call the host's saved phone after confirmation; host can open a prefilled urgent booking message — `booking.html`; `npm run smoke:booking-action`
- [x] 097. Host replacement offer to an available performer, recipient accept/decline, and transactional assignment/cache handoff — `booking.html`, `functions/index.js`, `firestore.rules`; `npm run smoke:booking-action`
- [ ] 098. Duplicate retry protection
- [ ] 099. Server notification retries and delivery log
- [ ] 100. Booking state migration verifier and rollback

## Messaging and collaboration

- [x] 101. Firestore rules restrict message access to verified host/accepted performer on accepted bookings and bound sender writes — `firestore.rules` (rules are in source; emulator authorization not exercised)
- [x] 102. Booking messages show Firestore-confirmed delivery and a per-user last-read message cursor after the other participant opens the thread; this is not a push notification — `booking.html`, `firestore.rules`
- [ ] 103. Attachment scanning and short-lived links
- [x] 104. Booking messages and metadata render untrusted text safely; history loads only latest 100 — `booking.html`; `npm run smoke:quick-replies`
- [ ] 105. Private host team notes
- [x] 106. Per-user quick replies stored locally and inserted only after user selection — `booking.html`, `app/quick-replies.js`; `npm run smoke:quick-replies`
- [ ] 107. Per-channel notification preferences
- [ ] 108. Quiet hours by account timezone
- [ ] 109. Email preference center
- [ ] 110. SMS reminders with opt-in and STOP handling

## Communication delivery

- [ ] 111. Push enrollment and device revocation
- [ ] 112. Communication history in account copy
- [ ] 113. Translation aid preserving original text
- [ ] 114. Message abuse report and block
- [ ] 115. Contact detail reveal by booking state
- [ ] 116. Team booking conversations
- [x] 117. A failed booking-message retry reuses its client-generated message ID and checks for an existing matching message before writing, preventing duplicate retries in the same page session — `booking.html`, `firestore.rules`
- [x] 118. Server-computed unread total across up to 25 accepted booking threads and 1,000 unread messages per thread; returns no count when bounds/read markers prevent an exact result. Requires Functions, rules, and index deployment — `functions/unread-message-count.js`, `booking.html`, `host.html`, `musician-dashboard.html`, `app/unread-message-count.js`; `npm run smoke:unread-message-count`, `npm run smoke:unread-message-ui`
- [ ] 119. Notification digest scheduling and retry
- [ ] 120. Partial: accepted booking participants can save a bounded, optional conversation snapshot and view saved status; records are account-private and must be copied into email because staff inbox access/processing is not connected — `booking.html`, `app/support-ticket-context.js`, `firestore.rules`, `firestore.indexes.json`; `npm run smoke:support-ticket-context`

## Payments and finance

- [ ] 121. Live provider status before payment actions
- [ ] 122. Server-side payment intent creation and confirmation
- [ ] 123. Payout onboarding status
- [ ] 124. Booking fee and tax breakdown
- [ ] 125. Receipt with stable transaction identifiers
- [ ] 126. Refund request and approval workflow
- [ ] 127. Chargeback evidence collection controls
- [ ] 128. Payout failure recovery
- [ ] 129. Invoice generation and PDF
- [ ] 130. Tax reporting download

## Payment reliability

- [ ] 131. Provider webhook reconciliation
- [ ] 132. Idempotency for financial mutations
- [x] 133. Stripe/Plaid secrets are read by Functions only; client responses expose readiness/public key, not secret keys — `functions/index.js`
- [ ] 134. Immutable financial audit log
- [ ] 135. Two-party manual payment confirmation
- [ ] 136. Cancellation fee by policy version
- [ ] 137. Currency and locale-aware amounts
- [ ] 138. Host cost and performer earnings reconciliation
- [ ] 139. Failed payment notification and retry
- [ ] 140. Permission-checked finance export

## Accessibility and safety

- [x] 141. Public FAQ skip link and focusable main landmark — `faq.html`; `npm run smoke:faq-accessibility`
- [x] 142. FAQ accordion uses native keyboard buttons and announces expanded state — `scripts/legal-components.js`; `npm run smoke:faq-accessibility`
- [x] 143. FAQ search matches question and answer content — `scripts/legal-components.js`; `npm run smoke:faq-accessibility`
- [x] 144. Keyboard-managed accessibility dialog: initial focus, Tab trap, Escape close, and focus return — `site-init.js`
- [x] 145. User-selectable, persisted reduced-motion override alongside system preference — `site-init.js`, `cltch-boilerplate.css`; Chromium accessibility smoke
- [x] 146. FAQ search announces match counts and an empty-result state — `scripts/legal-components.js`; `npm run smoke:faq-accessibility`
- [x] 147. FAQ expand-all and collapse-all controls — `scripts/legal-components.js`; `npm run smoke:faq-accessibility`
- [x] 148. FAQ controls reflow for mobile and honor reduced-motion preference — `faq.html`; `npm run smoke:faq-accessibility`
- [x] 149. Keyboard-operable performer availability calendar with day/week/month navigation, announced date states, and non-toggleable past/booked days — `musician-profile.html`; `npm run smoke:profile-calendar-a11y`
- [x] 150. Visible keyboard focus and mobile clear-search target on Matched Gigs — `musician-matched-gigs.html`; `npm run smoke:matched-gigs-accessibility`

## Mobile and safeguarding

- [x] 151. Android install fallback replaces the dead APK link with accessible PWA setup guidance and an accurate native-package-unavailable notice — `android-app.html`; `npm run smoke:android-install-guidance`
- [x] 152. Same-origin PWA shortcuts for Post a Gig, Find Gigs, and My Bookings — `manifest.webmanifest`; `npm run smoke:pwa-shortcuts` checks every target exists
- [ ] 153. Safe offline behavior for authenticated workflows
- [ ] 154. Native biometric unlock after review
- [x] 155. Payout handles masked by default and re-masked when the document is hidden or window loses focus — `app/sensitive-fields.js`, both profile pages; `npm run smoke:sensitive-fields`
- [x] 156. Matched Gigs filters expose pressed state and live result updates — `app/matched-gigs-accessibility.js`; `npm run smoke:matched-gigs-accessibility`
- [ ] 157. CSP nonce migration
- [ ] 158. CSP report endpoint with minimization
- [x] 159. Matched Gigs search is named and supports a keyboard shortcut — `app/matched-gigs-accessibility.js`; `npm run smoke:matched-gigs-accessibility`
- [x] 160. Matched Gigs search clears with Escape and restores focus after clear — `app/matched-gigs-accessibility.js`; `npm run smoke:matched-gigs-accessibility`

## Developer quality

- [ ] 161. Firebase emulator suite for Auth and Firestore
- [ ] 162. Rules tests for each collection and role transition
- [x] 163. Firebase target and mutable-asset cache policy smoke — scripts/smoke-hosting-policy.mjs
- [x] 164. Explicit ESM scope for shared browser modules and warning-free smoke imports — app/package.json
- [ ] 165. Lighthouse budget for public and account pages
- [ ] 166. Privacy-reviewed real user metrics
- [ ] 167. Error reporting with PII scrubbing
- [ ] 168. Separate deployment preview environment
- [x] 169. Firebase Hosting guard regression tests reject the wrong working directory, package identity, and Hosting site — `scripts/smoke-deploy-guard.mjs`; `npm run smoke:deploy-guard`
- [x] 170. Hosting rollback runbook and smoke automation

## Release and supply chain

- [ ] 171. GitHub CI for lint, smoke, build, and security
- [x] 172. Weekly Dependabot updates scoped to the Cltch npm workspace and GitHub Actions, with a review and vulnerability-triage policy — `.github/dependabot.yml`, `docs/DEPENDENCY_POLICY.md`
- [ ] 173. SBOM generation and vulnerability triage
- [ ] 174. Secret scanning and artifact publication guard
- [ ] 175. Data migration dry-run and verification
- [ ] 176. Production backup and restore drill
- [ ] 177. Custom-claim-backed admin access
- [ ] 178. Authorized live-data operations dashboard
- [ ] 179. Public status page
- [x] 180. Release manifest linking source commit, finalized Hosting version, and live smoke evidence — `scripts/release-manifest.mjs`; `npm run smoke:release-manifest`

## Payments compliance and communication

- [ ] 181. Connected account readiness checks
- [ ] 182. Provider webhook signature verification
- [ ] 183. Payment disputes with evidence checklist
- [ ] 184. Payment method removal and replace flow
- [ ] 185. Payout destination change reauthentication
- [ ] 186. Receipt resend workflow
- [ ] 187. Chargeback timeline reminders
- [ ] 188. Refund status history
- [ ] 189. Payment state support export
- [ ] 190. Financial permission audit

## Growth, localization, and resilience

- [ ] 191. Per-account language selection
- [ ] 192. Timezone discovery and override
- [x] 193. Accessible currency formatting
- [ ] 194. Referral attribution with consent
- [ ] 195. Invite links with expiry and revocation
- [ ] 196. Onboarding progress saved to account
- [ ] 197. First booking tutorial walkthrough
- [ ] 198. Seasonal marketplace insights using aggregate data
- [ ] 199. Service outage banner with recovery guidance
- [ ] 200. Feature rollout percentage with server-side kill switch

## Count

- Checklist items: 200.
- Implemented and verified in this change: 69.
- Remaining checklist items: 131.
- The requested 200-feature target is not complete. The unchecked list is a work queue, not a claim that these capabilities ship.
