# Service Estimation Update - 2026-06-27

## Summary

- Added a theme-aware `ServiceQuoteBuilder` component for Black Lion Studios.
- Installed the estimator directly on the single public landing page at `/#service-estimation`.
- Installed a compact estimator in the authenticated client dashboard so users can apply an estimate into the service request form.
- Consolidated the quote workflow so `/quote` is a permanent redirect to `/#service-estimation` instead of a separate public quote page.
- Replaced old quick-quote links in the footer, services page, ad expansion page, and service ad landing components with the landing estimator anchor.
- Reduced landing-page redundancy by keeping the public page focused on the hero, Service Estimation, booking, services, FAQ, and conversion. Legal/compliance detail stays on the dedicated legal, privacy, terms, and DMCA pages.
- Updated FAQ, Terms of Use, Privacy Policy, DMCA/Copyright Claims, Government Compliance, disclaimers, and site metadata to explain Service Estimation, multi-service selection, benchmark market-rate references, local estimate storage, 50% deposit expectations, and non-binding estimate limits.

## Estimator Controls

- Main-service multi-select for `Photography`, `Videography`, `Music and events`, `Web and tech`, `Planning`, and `Add-ons`.
- Relevant sub-service checklist generated from all selected main services.
- Expanded sub-service catalog now includes deeper options such as headshots, brand lifestyle, real estate photos, retouching, interview video, music video, recap edits, sound setup, playlist curation, recording support, mixing/mastering, landing pages, form automation, analytics setup, PC tune-ups, hardware upgrade labor, shot lists, content calendars, roadmaps, extra locations, raw file delivery, usage extensions, and second-operator support.
- Usage dropdown for personal/internal, social content, business marketing, and paid campaign/commercial work.
- Timeline dropdown for flexible, standard, priority, and rush work.
- Location dropdown for remote/studio-ready, local on-site, multi-location, and event venue work.
- Market-rate slider for soft, normal, busy, and high-demand pricing.
- Scope, complexity, deliverables, session hours, revision rounds, and travel-distance sliders.
- First-time client discount toggle at 25%.
- Travel under 30 miles is included. Travel over 30 miles is calculated as a separate independent extra charge outside the service subtotal, market multipliers, and first-time discount.
- Required deposit display set to 50% of the estimated total once selected services are requested.

## Market Baselines

Estimator defaults were adjusted using current 2026 public market-rate research for comparable U.S. creative, video, DJ, music production, web, website maintenance, product photography, and PC-support work. The UI shows each sub-service baseline plus a market reference range so users understand the estimate is a planning benchmark, not a final quote.

## Dashboard Workflow

- Dashboard users can build a Service Estimation before submitting a request.
- `Apply to request` copies the service lane, budget range, estimated timing, selected sub-services, usage, timeline, location, market mode, scope, complexity, deliverables, hours, revisions, travel distance, and discount status into the request form.
- The copied request details include that a 50% deposit is warranted and required once selected services are requested, to confirm seriousness, scheduling, and production commitment.
- The request form remains the authenticated submission path through `/api/requests`.
- Estimator resilience was tightened with safe option fallbacks, numeric clamping, stale service filtering, malformed local-storage recovery, capped saved-estimate history, and independent travel-charge calculation so the page does not fail on bad browser state.

## Verification

- `node --check` passed for edited JS/config files.
- `npm run build` passed.
- Local production smoke passed with `BLACK_LION_LIVE_URL=http://localhost:3127 npm run smoke:live`.
- Smoke now verifies `/quote` returns a `308` redirect to `/#service-estimation`, homepage Service Estimation markers render, and `/quote` is absent from the sitemap.
