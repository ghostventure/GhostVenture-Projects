# EstateHat County Priority Registry (Strongest First)

Last updated: 2026-04-11

## Method

This registry starts with high-enforcement counties/county-equivalents and local jurisdictions, then maps similarity clusters for the rest.

Practical rule:

1. Apply `strict_us_51` baseline everywhere.
2. If county/city is in Tier A or Tier B, treat as outlier and require counsel-reviewed support packet.
3. If not in outlier tiers, use baseline + state-level overlay.

## Tier A (highest practical enforcement / complexity)

These are first-priority counties/county-equivalents to model deeply.

1. New York County, NY (Manhattan)
2. Kings County, NY (Brooklyn)
3. Queens County, NY
4. Bronx County, NY
5. Richmond County, NY (Staten Island)
6. Los Angeles County, CA
7. San Francisco County, CA
8. Cook County, IL
9. King County, WA
10. Miami-Dade County, FL

Why Tier A:

- strict fair-housing / source-of-income enforcement posture
- high-volume recording/tax form requirements
- larger litigation and regulatory exposure footprint

## Tier B (strong local overlays, evaluate before Tier C)

1. Broward County, FL
2. Montgomery County, MD
3. Alameda County, CA
4. Santa Clara County, CA
5. San Diego County, CA
6. San Juan (municipality/county-equivalent), PR
7. Guam (county-equivalent), GU
8. St. Thomas / St. Croix / St. John (district equivalents), VI

## Tier C (majority pattern)

Most other counties can follow this aggregated model unless local counsel flags unique ordinance risk:

- county recording/fee/form rules
- state fair-housing + consumer protection + privacy/breach laws
- federal fair-housing/consumer/AML/e-sign baseline

## Similarity aggregation result

Across U.S. counties, obligations are mostly similar by family:

1. Recording process details vary, but recording-control category is consistent.
2. Fair-housing category is universal; protected classes and enforcement intensity vary.
3. Support/legal-hold/evidence production expectations are broadly similar.

This means you do not need 1:1 product logic for all 3,000+ counties. You need:

- robust baseline controls,
- county/city outlier flags,
- counsel review on flagged jurisdictions.

Territory note:

- Puerto Rico, Guam, and U.S. Virgin Islands are treated as automatic outlier jurisdictions and require counsel review before sensitive activation.

## EstateHat implementation mapping

- Backend derives outlier flags from state + county + city.
- Compliance UI exposes outlier status and support packet generation.
- Firestore rules enforce support packet and legal gating requirements.

## Primary local sources

- NYC fair housing rights and source of income context:
  - https://www.nyc.gov/site/fairhousing/rights-responsibilities/what-do-owners-and-renters-need-to-know.page
  - https://www.nyc.gov/site/cchr/media/source-of-income.page
- NYC recording / ACRIS requirements:
  - https://www.nyc.gov/site/finance/property/acris.page
- Los Angeles County recording requirements:
  - https://www.lavote.gov/home/recorder/property-document-recording/recording-requirements
- San Francisco recording requirements:
  - https://www.sf.gov/information--recording-requirements
- Cook County Commission on Human Rights and Just Housing Amendment:
  - https://www.cookcountyil.gov/agency/commission-human-rights
  - https://www.cookcountyil.gov/content/just-housing-amendment-human-rights-ordinance
- Seattle fair housing and source-of-income protections (King County anchor city):
  - https://www.seattle.gov/rentinginseattle/renters/are-you-ready-to-rent/fair-housing
- Miami-Dade recorder role and official records:
  - https://www2.miamidadeclerk.gov/MobilePortal/CountyRecorder.aspx
- Broward County Human Rights:
  - https://www.broward.org/HumanRights/Pages/Default.aspx
- Montgomery County Office of Human Rights / fair housing:
  - https://www.montgomerycountymd.gov/humanrights/about.html
  - https://www.montgomerycountymd.gov/humanrights/fairhousing.html

## Operating note

This registry is a compliance engineering prioritization tool, not legal advice.
