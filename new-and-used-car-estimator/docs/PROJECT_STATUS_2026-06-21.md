# New and Used Car Estimator - 2026-06-21

## Summary

Built and deployed a single-page Firebase Hosting site for the `new-and-used-car-estimator` project. The page presents benchmark planning prices for new and used vehicles with controlled make/model selection, non-antique model-year bounds, real-time client-side recalculation, and category filtering.

Live URL: `https://new-and-used-car-estimator.web.app`

## Files

- `index.html`: single-page benchmark price experience.
- `styles.css`: responsive visual system, grouped estimator controls, and result-card layout.
- `estimator.js`: controlled vehicle catalog, category metadata, and client-side calculation model.
- `scripts/smoke-estimator.mjs`: Chromium smoke test that verifies every estimator control changes the visible price.
- `firebase.json`: static Firebase Hosting configuration for site `new-and-used-car-estimator`.
- `database.rules.json`: Realtime Database rules for the aggregate site visit counter.
- `.firebaserc`: default Firebase project `new-and-used-car-estimator`.
- `package.json`: check, smoke, and deploy scripts.

## Current Feature Set

- Controlled Brand category, Make, and Model dropdowns.
- No freeform make/model/trim entry.
- Category filter includes Mass-Market, Mid-Market, Lux, Niche, Muscle, Sport, Rugged, SUVs only, Crossovers, Commercial, Motorcycle, Tuner, Exotic, EV, and International.
- Mass-Market classification now uses a practical site rule: generally at least five active mainstream auto model lines plus broad everyday-buyer coverage. Brands below that active-line threshold, paused/discontinued legacy brands, motorcycle-only brands, specialty brands, and underrepresented international brands are classified under more specific categories such as Niche, Mid-Market, Rugged, Sport, Motorcycle, or International.
- SUVs only is a segment-based lane for compact and midsize SUV profiles so sedans, pickups, vans, motorcycles, and box trucks do not appear in that view.
- Crossovers is a separate SUV-style lane that keeps common crossover profiles visible while excluding truck-based, rugged SUV, minivan, and commercial-van names from that view.
- Commercial covers cargo/work vans, chassis-cab work platforms, cutaway box trucks, low-cab-forward box trucks, and medium-duty box trucks.
- Motorcycle covers cruiser, sport, touring, adventure, dual-sport, scooter/mini, electric, and off-road profiles.
- Catalog now contains 1,125 selectable benchmark profiles across 108 makes.
- Antique mode adds 198 collector/antique profiles across 36 antique makes.
- International category includes relevant Canada, EU, Mexico, Russia, China, and Africa-origin makes where available.
- Model-year slider is constrained to the modern non-antique range, currently 2002-2027.
- New vehicle mode constrains the year slider to current/next model year.
- Read-only profile panel displays make, model, segment, trim class, brand category, and model lane.
- Read-only profile panel displays production status for current and discontinued models.
- Vehicle type affects catalog availability:
  - `New` means the model is currently available new from the manufacturer.
  - `Used` includes current and discontinued models inside the modern non-antique window.
  - `Antique` includes 25+ model-year collector vehicles from 1900 through the antique cut-off year.
  - If the manufacturer stopped making the model, it is discontinued and belongs in the used workflow only.
- Current-new catalog refreshed with missing 2026/newly available profiles, including additional EV, hybrid, luxury, and truck profiles.
- Dodge/Ram split corrected:
  - Dodge no longer owns Ram 1500/2500/3500 profiles after the 2009 brand split.
  - Ram owns 1500, 2500, 3500, Chassis Cab, ProMaster, ProMaster City, 1500 REV, and 1500 Ramcharger.
- Dodge brand classification corrected from Mass-Market to Muscle, Sport, and Niche because the current Dodge lineup is narrow and performance-focused around Charger and Durango, while paused/discontinued models remain used-only where applicable.
- Additional Mass-Market cleanup removed the label from catalog brands with fewer than five active represented model lines or no active new-model presence, reducing confusion between legacy mainstream status and current active-market breadth.
- Result card displays benchmark price, comparison range, confidence, and net adjustment from profile base.
- Result card now includes an explicit price confidence meter, deal quality label, regional adjustment readout, depreciation snapshot, transmission impact, and compact print/export/report tools.
- Result card now includes a Historical dollar value card with a slider from 1886 through the current runtime year.
- Footer includes a Realtime Database-backed aggregate site visit counter.
- Estimator controls recalculate immediately on input/change.
- Estimator card includes a three-way Market price mode control: Soft market, Normal, and Inflation.
- Day/Night theme toggle added with local preference persistence and system dark-mode awareness.
- Added sophistication components:
  - Catalog summary bar
  - Hero catalog metrics
  - Estimated out-the-door price
  - Estimated monthly payment
  - Taxes/fees reserve
  - Cost-per-mile estimate
  - Market pressure signal
  - Age/mileage fit signal
  - Demand/history/market-mode signal strip
  - Decision-support panel
  - Negotiation lane
  - Documentation hint
  - Category scope summary
  - Reset action
  - Copy summary action
  - Estimate quality score and explanation
  - Dynamic "what this gives you" summary
  - Production signal in the result card
  - Owner-count slider
  - Prior fleet/company vehicle toggle
- Added footer boilerplate sections:
  - FAQ
  - Legal
  - DMCA
  - Governance
  - Terms of Use
  - Privacy
  - Scope of Support

## GUI And Workflow Improvements

- Grouped the estimator into Vehicle, Core facts, and Market adjustments sections.
- Added live catalog counts for the selected category.
- Added year-range helper text so users can see the active year bounds.
- Added mileage tick labels.
- Reworded the live status from "Live pricing" to "Instant recalculation" to avoid implying live market-feed pricing.
- Replaced the prior inflation-only toggle with a three-way Market price mode slider so users can test Soft market, Normal, or Inflation conditions.
- Added theme-aware color tokens for day mode, night mode, and system preference.
- Added a manual theme toggle in the top control bar.
- Added richer result-card and decision-support components without adding another page.
- Added ownership-history adjustments because prior owner count and fleet/company use materially affect used-vehicle confidence and pricing.
- Added cargo/work van support for windowless commercial vans and related work platforms:
  - Current/new examples: Ford Transit Cargo Van, Ford E-Transit Cargo Van, Ford E-Series Cutaway E-350, Chevrolet Express Cargo Van, GMC Savana Cargo Van, Mercedes-Benz Sprinter Cargo Van, Mercedes-Benz eSprinter Cargo Van, Ram ProMaster Cargo Van, and Ram ProMaster EV Cargo Van.
  - Used-only examples: Ford E-150/E-250/E-350 Cargo Van, Ford Transit Connect Cargo Van, Chevrolet Astro Cargo Van, Dodge Sprinter Cargo Van, Freightliner Sprinter Cargo Van, Mercedes-Benz Metris Cargo Van, Nissan NV Cargo Van, and Nissan NV200 Compact Cargo Van.
- Added box truck support under Commercial:
  - Current/new examples: Ford E-Series Cutaway Box Truck, Ford F-650 Box Truck, Chevrolet Low Cab Forward 4500 Box Truck, Chevrolet Silverado 5500HD Box Truck, GMC Savana Cutaway Box Truck, Ram ProMaster Cutaway Box Truck, Freightliner M2 106 Box Truck, International CV/MV Series Box Truck, Isuzu NPR-HD/NQR Box Truck, Hino L6/L7 Box Truck, and Mitsubishi Fuso Canter Box Truck.
  - Box truck guidance is documented on `support.html` with notes for body length, liftgate, refrigeration, shelving, payload, wheelbase, and duty cycle.
- Added motorcycle support:
  - Controlled makes include Harley-Davidson, Honda Powersports, Yamaha, Kawasaki, Ducati, BMW Motorrad, Indian Motorcycle, Triumph, KTM, Royal Enfield, Suzuki, Vespa, Zero Motorcycles, Can-Am, and related motorcycle lines.
  - Motorcycle types include cruiser, sport, touring, adventure, dual-sport, scooter/mini, electric, and off-road.
  - Motorcycle estimates use lower annual mileage, motorcycle-specific depreciation behavior, motorcycle maintenance/fuel signals, and transmission handling for manual/sequential and EV direct-drive use cases.
- Added antique/collector workflow:
  - Antique appears as a third vehicle type beside New and Used.
  - Antique profiles are kept in a separate catalog pool so they do not pollute New or modern Used model lists.
  - Antique year bounds use the 25+ model-year collector threshold and currently cover 1900-2001.
  - Antique estimates use wider collector ranges and collector-specific copy for originality, provenance, restoration, auction reserve, transport reserve, and storage reserve.
  - Added page-level Antique support components for era guidance, value drivers, collector costs, antique threshold, and antique catalog count.
- Added resilience and operations layer:
  - Added 20 live GUI operation components: system status, catalog integrity, calculation guard, input guard, tamper status, fail-safe mode, snapshot state, recovery state, data freshness, catalog signature, model guard, duplicate guard, segment guard, year guard, range guard, price guard, render guard, copy guard, theme guard, and smoke status.
  - Added 3 estimate-context GUI components: value volatility, buyer liquidity, and ownership risk.
  - Added internal data/calculation guard functions for number clamping, select recovery, safe profile resolution, catalog signatures, duplicate ID checks, segment validation, year-bound validation, catalog integrity validation, input audits, and fail-safe result generation.
  - Added operational functions for data freshness, volatility, buyer liquidity, ownership risk, operation-event tracking, last-estimate snapshot persistence, snapshot recovery, tamper-status checks, health formatting, safe text rendering, and the operations panel update cycle.
  - Added tamper-resistant checks using a deterministic catalog signature, frozen catalog arrays, duplicate checks, segment checks, year-bound checks, and live signature verification.
  - Added fail-safe behavior that clamps out-of-range range controls, recovers invalid select values, produces a conservative fallback result if an input audit fails, and surfaces the failure state in the UI.
- Added buyer-decision and site support components, excluding VIN history by request:
  - Asking price input
  - Deal quality badge
  - Suggested first offer
  - Walk-away point
  - Fair midpoint
  - 12-month ownership preview
  - Fuel/energy selector
  - Fuel sensitivity signal
  - Maintenance risk meter
  - Depreciation preview
  - Comparable listing checklist
  - Regional note component
  - Confidence explainer
  - Saved comparison tray
  - Clear saved comparisons action
  - Print/PDF action
  - Export JSON action
  - Catalog issue report stub
  - Result-card print estimate action
  - Result-card export JSON action
  - Result-card report data issue action
  - Historical dollar value slider
  - Vehicle value converted into selected-year dollars
  - Selected-year dollar purchasing power in current dollars
  - Current dollar value in selected-year dollars
  - Data methodology panel
  - Inspection reminder panel
  - Accessibility help panel
  - Commercial van upfit checklist
  - Collector originality checklist
  - Scope reminder
- Added categorized price-impact factor controls:
  - Equipment and powertrain: drivetrain, engine/powertrain, transmission, options package, exterior/interior color demand, and warranty status.
  - Condition and records: service records, tires/brakes, open recalls, title brand, rust/corrosion, repair quality, keys/accessories, and prior rental use.
  - Market and transaction: dealer add-ons, incentives/rebates, days on market, local inventory supply, seasonality, and shipping distance.
  - Specialty factors: commercial-use intensity, EV battery health, tax-credit eligibility, import/gray-market status, originality/modifications, aftermarket quality, rarity/production numbers, and matching numbers/provenance.
  - Added four impact-summary components: equipment impact, history impact, market leverage, and specialty impact.
  - Factor math is contextual so specialty items affect the estimate only where relevant, such as EV battery health on EVs, commercial intensity on cargo/work vehicles, and matching/provenance on antique or performance-oriented models.
- Condensed the main estimator page:
  - Main page now focuses on the headliner, estimator, result card, and simple footer.
  - Decision Support, Operations, Antique Support, Homework, and tool guidance moved to `support.html`.
  - FAQ, Legal, DMCA, Governance, Terms of Use, Privacy, Scope of Support, methodology, and inspection reminders moved to `docs.html`.
  - Footer was simplified to links only plus `Webmaster: Black Lion Studios`.
  - Added a footer site visit counter using Firebase Realtime Database.
- Removed redundant "what it is / what it is not / best next step" cards and consolidated the same guidance into the result quality layer and verification section.
- Removed the starter-data benchmark table from the public UI.
- Capped the adjustment list height so the sticky result card remains usable.
- Added an Operations panel so users and maintainers can see live guardrail state without opening developer tools.
- Added a local last-safe-estimate snapshot so the client can detect whether recovery state is available.

## Data Notes

The benchmark values are static planning baselines, not live market-feed prices or appraisals. They should be replaced or calibrated with a trusted valuation feed, internal transaction dataset, or updated market-comparable data before representing values as current market pricing.

Market price mode uses current 2026 context rather than a one-size inflation switch. Inflation mode uses a 4.2% broad CPI-U planning factor from the Bureau of Labor Statistics May 2026 CPI release. Soft market mode applies a modest negative planning factor because May 2026 vehicle data is mixed: BLS reported CPI-U all-items at 335.123, new vehicles down 0.3% month over month, and used cars/trucks up 0.1% month over month; Kelley Blue Book/Cox reported May new-vehicle ATP at $49,220, down from April but up 1.2% year over year; Manheim/Cox reported the May used wholesale index at 212.6 and still up 3.6% year over year; Edmunds reported Q1 2026 three-year residual values at 66%. The user-facing label is Soft market rather than Depressed because the current evidence supports moderating/softening pockets, not a broad depressed-price market.

Historical dollar value starts at 1886, the Benz Patent-Motorwagen production era. Official U.S. CPI data starts in 1913, so 1886-1912 values are marked as estimated purchasing-power context. From 1913 forward the card uses CPI-ratio math. The current CPI anchor was refreshed to the May 2026 CPI-U all-items index of 335.123. The 1937 example is handled in both directions: one 1937 dollar is roughly $23.27 in current purchasing power using May 2026 CPI, while one current dollar is roughly $0.04 in 1937 purchasing power.

Production-status metadata was refreshed through May 2026. Discontinued models are retained for used estimates only when their production years overlap the 2002-2026 non-antique planning window. Models that ended before that window are filtered out. New estimates only show current-production profiles.

Commercial cargo-van and box-truck metadata separates current work platforms from discontinued used-only lines. Ford E-Series cargo vans remain used-only, while the current E-Series Cutaway work platform is available in the new Commercial workflow. Box truck entries were cross-checked against current manufacturer/commercial references for Ford E-Series Cutaway, Chevrolet Low Cab Forward, GMC Savana Cutaway, Ram ProMaster cutaway, Freightliner M2 106, Isuzu N-Series, Hino L-Series, and Mitsubishi Fuso Canter support.

Motorcycle metadata was expanded after checking current manufacturer/dealer-facing lineup references for Harley-Davidson, Honda Powersports, Yamaha, Kawasaki, Ducati, Indian Motorcycle, BMW Motorrad, Triumph, KTM, Royal Enfield, Suzuki, Zero Motorcycles, Vespa, and Can-Am coverage. Motorcycle pricing remains a planning baseline and should be calibrated against motorcycle-specific comparable listings, mileage, title, modifications, service records, tire/brake condition, and seasonal demand.

Antique metadata uses a broad 25+ model-year collector threshold. Actual antique, historic, collector, classic, or vintage registration rules vary by state, insurer, and collector organization; the site treats Antique as an estimator workflow, not registration or title advice.

## Compliance Notes

The page states that benchmark prices are estimates only. It does not present numbers as guaranteed offers, appraisals, insurance values, lender values, tax values, wholesale bids, or final sale prices. User-facing copy points shoppers toward VIN history, inspection results, current listings, and written out-the-door pricing before buying.

The site visit counter stores only an aggregate count and update timestamp at `siteStats/visits`. It does not collect names, emails, IP addresses, user agents, device IDs, or page-level behavior. Rules allow public reads of that aggregate only and restrict writes to one-count increments.

Footer boilerplates were added as a starting point, not final legal documents. The DMCA section notes that a provider relying on DMCA safe-harbor treatment generally needs public designated-agent contact information and matching registration with the U.S. Copyright Office. The Privacy section follows a data-minimization posture: do not request, store, or retain personal information unless there is a legitimate operational need. The Legal/FAQ language keeps value claims framed as estimate-only and evidence-checkable.

## Verification

- `npm run check` passed.
- Catalog audit passed:
  - 1,125 total profiles
  - 108 makes
  - 927 modern new/used profiles
  - 198 antique profiles
  - 588 current-production profiles
  - 339 discontinued profiles retained for used estimates
  - 19 explicit commercial cargo/work-van profiles
  - no duplicate profile IDs
  - no missing brand categories
  - no category-only makes without selectable models
  - no unknown segment keys
  - no models with a final production year before the 2002 floor
  - no Dodge-owned Ram truck profiles remain
  - Ram current-new profiles include 1500, 2500, 3500, Chassis Cab, ProMaster, ProMaster City, 1500 REV, and 1500 Ramcharger
- `npm run smoke` passed in Chromium.
- Smoke verified visible price changes for:
  - Vehicle type
  - Model year
  - Mileage
  - Condition
  - Trim/options
  - Region
  - Transaction context
  - History/title
  - Current demand
  - Market price mode: Inflation
  - Market price mode: Soft market
  - Category/make/model changes
- Smoke verified the theme toggle changes the active theme.
- Smoke verified the new result and decision-support components render text.
- Smoke verified quality-score and value-summary components render text.
- Smoke verified owner-count and fleet/company-use controls change the visible benchmark price.
- Smoke verified Commercial cargo/work vans are selectable, including used-only Ford E-350 Cargo Van and current/new cargo van lines.
- Smoke verified SUVs only is selectable, includes SUV makes/models, and excludes non-SUV segment labels.
- Smoke verified Crossovers is selectable, includes representative crossover makes/models, and excludes rugged/truck-based SUV, minivan, and work-van labels.
- Smoke verified Commercial box trucks are selectable in the Commercial category, including Ford E-Series Cutaway Box Truck, Ford F-650 Box Truck, and multi-make box-truck support.
- Smoke verified Motorcycle is selectable, current motorcycle makes render, Yamaha sport/adventure profiles render, motorcycle segment/lane labels render, and transmission changes affect the visible benchmark price.
- Smoke verified result-card confidence band, regional adjustment, depreciation snapshot, transmission impact, print/export/report statuses, and updated deal-quality labels render.
- Smoke verified the Historical dollar value card renders, the 1937 dollar conversion is in the expected range, pre-1913 years are labeled as estimates, and changing the slider changes the selected-year vehicle value.
- Smoke verified Antique is selectable, antique profiles render, antique model-year bounds stay at or below 2001, collector components render, and antique year changes affect benchmark price.
- Smoke verified all Operations panel components render text.
- Smoke verified value volatility, buyer liquidity, and ownership risk components render text.
- Smoke verified an out-of-range mileage input is clamped back into the supported range.
- Smoke verified live tamper status remains clean and catalog signature renders.
- Smoke verified newly installed buyer-decision/site-support components render text.
- Smoke verified asking-price comparison marks an above-range price and saved comparisons persist locally.
- Smoke verified representative added price-impact factors affect price: drivetrain, title brand, inventory supply, and rarity.
- Smoke verified equipment, history, market, and specialty impact summary components render text.
- Smoke verified footer policy sections render text.
- Smoke verified `support.html` contains Decision Support, Operations, Tools, Antique Support, and Homework content.
- Smoke verified `docs.html` contains FAQ, Methodology, Legal, DMCA, Privacy, and Webmaster text.
- Smoke verified the simplified footer links to Support and documentation pages.
- Smoke verified the footer visit counter renders a count/status without breaking the page.
- Smoke verified a discontinued model is removed from the `New` catalog after switching vehicle type.

## Deployment

- Deploy command: `npm run deploy:hosting`
- Target account: `solidartentertainment@gmail.com`
- Target project/site: `new-and-used-car-estimator`
- Deployment completed successfully on 2026-06-21.
- Live homepage returned HTTP 200.
- Live content checks confirmed:
  - Brand category selector is present.
  - International category is present.
  - Instant recalculation status is present.
  - International catalog entries are present in `estimator.js`.
  - Removed starter-data table is not present in the live HTML.

## 2026-06-25 GitHub Upload Note

- Uploaded the New and Used Car Estimator to GitHub repository `https://github.com/PlugzTech/AdventureCode-Projects`.
- Repository subfolder: `new-and-used-car-estimator/`.
- Upload commit: `0af21cc Add new and used car estimator project`.
- The GitHub copy is source-focused. It intentionally excludes Firebase cache, dependency folders, generated/build output, environment files, local databases, keys, and archives.
- The GitHub repository is currently public, so do not commit credentials, private user data, unpublished valuation feeds, or operational secrets.
