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
- [ ] 009. Account deletion request with status tracking and identity recheck
- [ ] 010. Full account export including booking history, messages, reviews, and media metadata

## Identity and authentication

- [ ] 011. Passkey registration and sign-in
- [ ] 012. Multi-factor setup and recovery codes
- [ ] 013. Active device list and session revocation
- [ ] 014. New device sign-in notification
- [ ] 015. Recent security events page
- [ ] 016. Email change verification with rollback
- [ ] 017. Reauthentication for payout and account changes
- [ ] 018. Suspicious login challenge and rate limiting
- [ ] 019. Recovery contact setup and verification
- [ ] 020. Sign-in provider linking and unlinking validation

## Host and venue workflows

- [x] 021. Browser-local saved gig templates scoped by host UID (up to 8; not synced across devices) — `host.html`, `app/gig-templates.js`; `npm run smoke:gig-templates`
- [x] 022. Weekly or biweekly repeat-post batch (up to 12 separate gig documents, atomic Firestore write) — `host.html`, `app/gig-series.js`; `npm run smoke:gig-series`
- [x] 023. Per-event and aggregate host cost estimate for repeated gigs — `host.html`, `app/gig-budget.js`; `npm run smoke:gig-budget`
- [ ] 024. Venue contact roster with scoped visibility
- [x] 025. Browser-local booking preparation checklist scoped per booking, with explicit private/not-confirmed status — `scripts/platform-components.js`, `booking.html`; Chromium isolation smoke
- [ ] 026. Rider and stage plan attachments with access controls
- [x] 027. Advisory duplicate gig detection by host, venue, route, date, and time before geocoding/posting — `host.html`, `app/duplicate-gig.js`; `npm run smoke:duplicate-gig`
- [ ] 028. Event change history
- [x] 029. Host-private cancellation reason prompt with bounded storage and explicit no-notification status — `host.html`, `booking.html`, `app/cancellation-reason.js`; `npm run smoke:cancellation-reason`
- [ ] 030. Venue profile verification with evidence

## Host team and scheduling

- [ ] 031. Host approval roles
- [ ] 032. Venue accessibility and accommodation checklist
- [ ] 033. Recurring venue preferences
- [ ] 034. Booking approval roles for venue teams
- [ ] 035. Venue document expiry reminders
- [ ] 036. Duplicate booking merge flow
- [x] 037. Host activity CSV with status/month counts and posted-pay average denominators; explicitly limited to the 200 newest host-owned feed records — `host.html`, `app/host-analytics-export.js`; `npm run smoke:host-analytics-export`
- [x] 038. Filter confirmed bookings by date and export a bounded, escaped .ics file with explicit floating-time and one-hour defaults — `musician-dashboard.html`, `app/performer-agenda.js`; `npm run smoke:performer-agenda`
- [ ] 039. Venue capacity and equipment details
- [x] 040. Venue-specific safety checklist

## Performer profile and media

- [x] 041. Escape stored performer and review strings before public HTML rendering — `performer-view.html`; `npm run smoke:performer-public-profile`
- [x] 042. Bound public-profile review reads to the newest 50 records — `performer-view.html`; `npm run smoke:performer-public-profile`
- [x] 043. Label the review sample accurately and isolate review-load failures from the profile — `performer-view.html`; `npm run smoke:performer-public-profile`
- [x] 044. Encode performer identifiers in the booking return link — `performer-view.html`; `npm run smoke:performer-public-profile`
- [x] 045. Private round-trip travel-fee calculator with validated manual route distance and no location sharing — `musician-profile.html`, `app/travel-fee.js`; `npm run smoke:travel-fee`
- [ ] 046. Recurring availability with timezone support
- [ ] 047. Revocable calendar subscription feed
- [x] 048. Profile recommendations tied to missing fields
- [x] 049. Show a recoverable state when the performer profile cannot load — `performer-view.html`; `npm run smoke:performer-public-profile`
- [x] 050. Share or copy a performer profile link with accessible status feedback — `performer-view.html`; `npm run smoke:performer-public-profile`

## Performer earnings and teams

- [ ] 051. Multi-role profile types
- [ ] 052. Team representative permissions
- [ ] 053. Earnings history with fee and payout state
- [ ] 054. Tax document vault and annual download
- [x] 055. Gig preparation checklist
- [ ] 056. Availability pause with resume date
- [x] 057. Safe portfolio URL manager — blocks scripts, credentials, duplicates, and oversized input; caps saved links at 20. Verified in scripts/smoke-portfolio-links.mjs.
- [ ] 058. Review response and correction request
- [x] 059. Copy a date-filtered upcoming booking itinerary with line-break sanitization — `musician-dashboard.html`, `app/performer-agenda.js`; `npm run smoke:performer-agenda`
- [x] 060. Owner-local self-attested business readiness checklist with explicit non-verification notice — `host-profile.html`, `app/business-profile-checklist.js`; `npm run smoke:business-profile-checklist`

## Discovery and search

- [x] 061. Export local search presets as JSON for browser-to-browser portability — `site-init.js`; Chromium export smoke
- [x] 062. Import page-scoped search presets with file-size, schema, search-length, filter, sort, duplicate, and count validation — `site-init.js`; Chromium import smoke
- [x] 063. Bounded minimum-pay filter with storage fallback, reset control, and accurate empty state — `gig-radar.html`, `app/gig-radar-filters.js`; `npm run smoke:gig-radar-filters`
- [x] 064. Save and restore one account-scoped combined open-gig search, reapplying phrase, performer type, date bounds, and minimum pay to live results — `gig-discovery.html`, `app/gig-discovery.js`, `app/gig-discovery-filters.js`; `npm run smoke:gig-discovery`
- [x] 065. Accessible map and list view
- [x] 066. Stale listing suppression reason
- [ ] 067. Availability conflict warning with timezone
- [x] 068. Search relevance controls and reset
- [x] 069. Match feedback reason codes
- [x] 070. Clear browser-local CLTCH preferences, drafts, and named caches without removing Firebase auth or account data — `app/local-data.js`, `privacy.html`; `npm run smoke:local-data`

## Matching and marketplace trust

- [x] 071. Stable paginated search results
- [x] 072. Explicit Nominatim location resolution and confirmed in-memory coordinate override, preserving the entered location string — `host.html`, `app/gig-location-resolution.js`; `npm run smoke:gig-location-resolution`
- [x] 073. Approximate distance disclosure
- [ ] 074. Blocked-user exclusion from matching
- [x] 075. Filter-aware empty-state recovery
- [ ] 076. Response speed with sample-size threshold
- [ ] 077. Host reliability with denominator
- [x] 078. Keyboard and screen-reader search results
- [ ] 079. Accessible performer comparison table
- [x] 080. Alerts for new matching opportunities

## Booking lifecycle

- [ ] 081. Backend booking state machine validation
- [ ] 082. Idempotent accept, cancel, and check-in actions
- [ ] 083. Booking audit trail with actor and server time
- [ ] 084. Conflict-safe simultaneous acceptance
- [x] 085. Accepted-participant printable booking receipt with sanitized fields, generated timestamp, and explicit payment/event disclaimers — `booking.html`, `app/booking-receipt.js`; `npm run smoke:booking-receipt`
- [x] 086. Optional performer check-in consent panel with a separately confirmed, role/booking-window-guarded arrival timestamp — `booking.html`, `app/checkin-consent.js`; `npm run smoke:checkin-consent`
- [ ] 087. Offline note conflict resolution
- [ ] 088. Two-party completion sign-off
- [ ] 089. Two-party booking amendment acceptance
- [ ] 090. Cancellation policy calculation before confirmation

## Booking reliability and support

- [ ] 091. Opt-out booking reminders and quiet hours
- [x] 092. Bounded past accepted-booking recovery panel, with an isolated retry state and safe details route — `musician-dashboard.html`, `app/stale-booking-recovery.js`; `npm run smoke:stale-booking-recovery`
- [x] 093. Host booking health panel with explicit status/date counts, a 20-record detail bound, and isolated feed-error state — `host.html`, `app/booking-health.js`; `npm run smoke:booking-health`
- [x] 094. Accepted-booking incident report download with allowlisted metadata, bounded notes, and explicit local-only/not-sent status — `host.html`, `app/booking-incident-report.js`; `npm run smoke:booking-incident-report`
- [ ] 095. Evidence attachment retention controls
- [ ] 096. Event-day emergency contact action
- [ ] 097. Assigned performer replacement handoff
- [ ] 098. Duplicate retry protection
- [ ] 099. Server notification retries and delivery log
- [ ] 100. Booking state migration verifier and rollback

## Messaging and collaboration

- [ ] 101. Booking messages protected by Firestore rules
- [ ] 102. Message delivery and read state
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
- [ ] 117. Retry without duplicate message sends
- [ ] 118. Server-consistent unread counts
- [ ] 119. Notification digest scheduling and retry
- [ ] 120. Support escalation with conversation context

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
- [ ] 133. Server-only payment secrets
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
- [x] 153. Booking-details offline guard: connection banner, paused message/check-in actions, preserved drafts, no app-managed replay, and in-flight status guidance — `booking.html`, `app/booking-offline.js`; `npm run smoke:booking-offline`
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
- [x] 173. Deterministic production SBOM and documented vulnerability triage (unknown licenses marked NOASSERTION)
- [x] 174. Secret scanning and Hosting deploy guard (working tree + staged Git index blobs)
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
- [x] 197. Resumable four-step first-booking walkthrough with contextual links, progress, skip/restart, and UID-scoped browser-local state — `musician-dashboard.html`, `app/booking-walkthrough.js`; `npm run smoke:booking-walkthrough`
- [x] 198. Privacy-safe upcoming open-gig supply snapshot by calendar quarter with five-distinct-host suppression, explicit 180-day/120-listing sample coverage, and no historical-seasonality or forecast claim — `gig-radar.html`, `app/marketplace-insights.js`; `npm run smoke:marketplace-insights`
- [ ] 199. Service outage banner with recovery guidance
- [ ] 200. Feature rollout percentage with server-side kill switch

## Count

- Checklist items: 200.
- Implemented and verified in this change: 70.
- Remaining checklist items: 130.
- The requested 200-feature target is not complete. The unchecked list is a work queue, not a claim that these capabilities ship.
