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

- [ ] 021. Saved gig templates per host
- [ ] 022. Multi-date event series
- [ ] 023. Budget and fee preview before publishing
- [ ] 024. Venue contact roster with scoped visibility
- [x] 025. Browser-local booking preparation checklist scoped per booking, with explicit private/not-confirmed status — `scripts/platform-components.js`, `booking.html`; Chromium isolation smoke
- [ ] 026. Rider and stage plan attachments with access controls
- [ ] 027. Duplicate gig detection
- [ ] 028. Event change history
- [ ] 029. Cancellation reason and performer notice workflow
- [ ] 030. Venue profile verification with evidence

## Host team and scheduling

- [ ] 031. Host approval roles
- [ ] 032. Venue accessibility and accommodation checklist
- [ ] 033. Recurring venue preferences
- [ ] 034. Booking approval roles for venue teams
- [ ] 035. Venue document expiry reminders
- [ ] 036. Duplicate booking merge flow
- [ ] 037. Host booking analytics export
- [ ] 038. Calendar export with timezone-safe events
- [ ] 039. Venue capacity and equipment details
- [ ] 040. Venue-specific safety checklist

## Performer profile and media

- [ ] 041. Per-field portfolio visibility controls
- [ ] 042. Media upload validation and malware checks
- [ ] 043. Profile preview as a host sees it
- [ ] 044. Rate cards by event type and duration
- [x] 045. Private round-trip travel-fee calculator with validated manual route distance and no location sharing — `musician-profile.html`, `app/travel-fee.js`; `npm run smoke:travel-fee`
- [ ] 046. Recurring availability with timezone support
- [ ] 047. Revocable calendar subscription feed
- [ ] 048. Profile recommendations tied to missing fields
- [ ] 049. Document expiry alerts
- [ ] 050. Work sample rights confirmation

## Performer earnings and teams

- [ ] 051. Multi-role profile types
- [ ] 052. Team representative permissions
- [ ] 053. Earnings history with fee and payout state
- [ ] 054. Tax document vault and annual download
- [ ] 055. Gig preparation checklist
- [ ] 056. Availability pause with resume date
- [x] 057. Safe portfolio URL manager — blocks scripts, credentials, duplicates, and oversized input; caps saved links at 20. Verified in scripts/smoke-portfolio-links.mjs.
- [ ] 058. Review response and correction request
- [ ] 059. Reference request workflow
- [ ] 060. Business profile verification checklist

## Discovery and search

- [x] 061. Export local search presets as JSON for browser-to-browser portability — `site-init.js`; Chromium export smoke
- [x] 062. Import page-scoped search presets with file-size, schema, search-length, filter, sort, duplicate, and count validation — `site-init.js`; Chromium import smoke
- [ ] 063. Distance filter with location precision setting
- [ ] 064. Saved combined filters
- [ ] 065. Accessible map and list view
- [ ] 066. Stale listing suppression reason
- [ ] 067. Availability conflict warning with timezone
- [ ] 068. Search relevance controls and reset
- [ ] 069. Match feedback reason codes
- [x] 070. Clear browser-local CLTCH preferences, drafts, and named caches without removing Firebase auth or account data — `app/local-data.js`, `privacy.html`; `npm run smoke:local-data`

## Matching and marketplace trust

- [ ] 071. Stable paginated search results
- [ ] 072. Manual location override
- [ ] 073. Approximate distance disclosure
- [ ] 074. Blocked-user exclusion from matching
- [ ] 075. Filter-aware empty-state recovery
- [ ] 076. Response speed with sample-size threshold
- [ ] 077. Host reliability with denominator
- [ ] 078. Keyboard and screen-reader search results
- [ ] 079. Accessible performer comparison table
- [ ] 080. Alerts for new matching opportunities

## Booking lifecycle

- [ ] 081. Backend booking state machine validation
- [ ] 082. Idempotent accept, cancel, and check-in actions
- [ ] 083. Booking audit trail with actor and server time
- [ ] 084. Conflict-safe simultaneous acceptance
- [ ] 085. Booking confirmation receipt
- [ ] 086. Optional arrival check-in with consent
- [ ] 087. Offline note conflict resolution
- [ ] 088. Two-party completion sign-off
- [ ] 089. Two-party booking amendment acceptance
- [ ] 090. Cancellation policy calculation before confirmation

## Booking reliability and support

- [ ] 091. Opt-out booking reminders and quiet hours
- [ ] 092. Stale booking recovery panel
- [ ] 093. Bounded booking health dashboard
- [ ] 094. Private booking incident report
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
- [ ] 104. Booking-scoped message search
- [ ] 105. Private host team notes
- [ ] 106. Per-user saved response templates
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

- [ ] 141. WCAG 2.2 AA core-flow audit
- [ ] 142. Screen-reader host gig posting
- [ ] 143. Screen-reader performer acceptance
- [x] 144. Keyboard-managed accessibility dialog: initial focus, Tab trap, Escape close, and focus return — `site-init.js`
- [x] 145. User-selectable, persisted reduced-motion override alongside system preference — `site-init.js`, `cltch-boilerplate.css`; Chromium accessibility smoke
- [ ] 146. Zoom and text resize without overflow
- [ ] 147. Form errors announced and linked
- [ ] 148. Non-color status indicators
- [ ] 149. Accessible date/time picker
- [ ] 150. Mobile safe-area support for account actions

## Mobile and safeguarding

- [ ] 151. Installed-release update guidance and supported-version notice
- [x] 152. Same-origin PWA shortcuts for Post a Gig, Find Gigs, and My Bookings — `manifest.webmanifest`; `npm run smoke:pwa-shortcuts` checks every target exists
- [ ] 153. Safe offline behavior for authenticated workflows
- [ ] 154. Native biometric unlock after review
- [ ] 155. Screen privacy for payout and contact values
- [ ] 156. Abuse report and block flows on mobile
- [ ] 157. CSP nonce migration
- [ ] 158. CSP report endpoint with minimization
- [ ] 159. Accessible emergency support path
- [ ] 160. Supported mobile app version notice

## Developer quality

- [ ] 161. Firebase emulator suite for Auth and Firestore
- [ ] 162. Rules tests for each collection and role transition
- [x] 163. Firebase target and mutable-asset cache policy smoke — scripts/smoke-hosting-policy.mjs
- [x] 164. Explicit ESM scope for shared browser modules and warning-free smoke imports — app/package.json
- [ ] 165. Lighthouse budget for public and account pages
- [ ] 166. Privacy-reviewed real user metrics
- [ ] 167. Error reporting with PII scrubbing
- [ ] 168. Separate deployment preview environment
- [ ] 169. Firebase account/project guard tests
- [ ] 170. Hosting rollback runbook and smoke automation

## Release and supply chain

- [ ] 171. GitHub CI for lint, smoke, build, and security
- [ ] 172. Dependency update policy and automation
- [ ] 173. SBOM generation and vulnerability triage
- [ ] 174. Secret scanning and artifact publication guard
- [ ] 175. Data migration dry-run and verification
- [ ] 176. Production backup and restore drill
- [ ] 177. Custom-claim-backed admin access
- [ ] 178. Authorized live-data operations dashboard
- [ ] 179. Public status page
- [ ] 180. Release manifest linking commit, Hosting version, and smoke evidence

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
- [ ] 193. Accessible currency formatting
- [ ] 194. Referral attribution with consent
- [ ] 195. Invite links with expiry and revocation
- [ ] 196. Onboarding progress saved to account
- [ ] 197. First booking tutorial walkthrough
- [ ] 198. Seasonal marketplace insights using aggregate data
- [ ] 199. Service outage banner with recovery guidance
- [ ] 200. Feature rollout percentage with server-side kill switch

## Count

- Checklist items: 200.
- Implemented and verified in this change: 19.
- Remaining checklist items: 181.
- The requested 200-feature target is not complete. The unchecked list is a work queue, not a claim that these capabilities ship.
