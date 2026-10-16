# EstateHat Compliance Matrix (Research Baseline)

Last updated: 2026-04-11

## Scope and assumptions

This matrix is a legal-ops baseline for EstateHat's current platform scope:

- workflow software for real-estate transactions
- identity, legal, and trust workflow controls
- no direct custody of funds (escrow/title/payment providers handle money movement)
- not positioned as a licensed brokerage, law firm, lender, title insurer, or government agency

This is not legal advice and not a legal opinion. Use this with retained counsel in each operating jurisdiction.

## Federal (U.S.) requirements

| Regulation / authority | Relevance to EstateHat | Trigger for applicability | Required control direction |
|---|---|---|---|
| Fair Housing Act (HUD/DOJ) | Housing-related workflows, listings, and platform conduct | Any housing-related service/decisioning or discriminatory platform behavior | Anti-discrimination policy, moderation/enforcement SOPs, complaint intake, auditable decision records |
| ECOA / Regulation B (12 CFR 1002) | Credit-related actions or workflows touching mortgage/credit decisions | If EstateHat acts in credit decisioning or creditor-like workflows | Anti-discrimination controls in credit flows, adverse-action logic where applicable |
| RESPA / Regulation X (12 CFR 1024) | Settlement-service conduct, referrals, and fee structures | If EstateHat is providing/arranging settlement services or referral structures in that lane | No kickback/unearned-fee patterns, clear fee disclosures, settlement workflow controls |
| FinCEN residential real-estate AML rule and GTO program | AML controls for covered non-financed real-estate transfers | If EstateHat or partners are a covered reporting person | Reporting workflow, beneficial-owner data controls, retention and audit evidence |
| OFAC sanctions obligations | Screening for prohibited parties in financial/high-risk transactions | Any transaction flow that could involve sanctioned parties | OFAC screening checkpoints, watchlist refresh cadence, escalation/block procedures |
| FTC Safeguards Rule (16 CFR 314) | Customer financial information security | If EstateHat is in covered financial activity scope | Written security program, vendor oversight, encryption, access controls, incident response |
| CAN-SPAM (16 CFR 316) | Commercial email campaigns and growth messaging | Any commercial email sent by platform | Identification, unsubscribe compliance, suppression-list governance |
| TCPA / FCC robocall-robotext rules | SMS/telemarketing automation and consent | Marketing calls/texts and lead-generation outbound flows | Prior express written consent, one-to-one consent controls, consent logs |
| E-SIGN Act (15 U.S.C. 7001) | Electronic-record/signature enforceability | E-sign and electronic-disclosure flows | Consumer consent UX, disclosure retention in reproducible form |

## State requirements

### North Carolina (home jurisdiction)

| Regulation / authority | Relevance to EstateHat | Trigger | Required control direction |
|---|---|---|---|
| NC Real Estate License Law (Chapter 93A) | Brokerage-activity boundary | If EstateHat performs licensed brokerage acts for compensation | Keep software-platform posture clear; avoid unlicensed brokerage conduct |
| NC Identity Theft Protection Act (Chapter 75, Article 2A) | PII handling, SSN handling, breach duties | Storage/use of NC residents' personal data | SSN restrictions, encryption/secure transmission controls, breach notice workflow |
| NC Money Transmitters Act (Chapter 53, Article 16B) | Funds transmission regulation | If EstateHat directly transmits funds/value | Avoid direct custody/transmission unless licensed; maintain partner-only money movement model |
| NC UETA (Chapter 66, Article 40) | Electronic contract/signature validity | e-record and e-sign flows | Consent model, record retention, reproducible records |
| NC Notary Act (Chapter 10B) | Notarization workflows | If notarial steps are represented/integrated | Maintain correct notary model and compliance boundaries |

### California

| Regulation / authority | Relevance to EstateHat | Trigger | Required control direction |
|---|---|---|---|
| BPC §10131 (Real Estate Broker definition) | Brokerage boundary risk | If platform or personnel perform acts for compensation matching broker functions | Product/operations guardrails to avoid unlicensed brokerage activity |
| Gov Code §12955 (housing discrimination) | Fair-housing obligations in listings, screening, and advertising | Any housing transaction support touching eligibility, ads, or treatment | Anti-discrimination controls, ad moderation rules, complaint escalation trail |
| Civil Code §1798.100 (CCPA/CPRA rights baseline) | Consumer privacy rights and notice obligations | If thresholds/scope are met for CA consumers | Rights intake/response workflow, privacy notices, retention governance |
| Civil Code §1798.82 (breach notification) | Breach notice timing/content obligations | Security incident involving CA personal information | 30-day breach response clock controls, regulator template workflow |
| Financial Code Division 1.2 / §2030 (Money Transmission Act) | Funds-movement licensing boundary | If EstateHat transmits money directly | Keep funds movement on licensed partners unless independently licensed |
| Civil Code §1633.5 (UETA) | Electronic transaction validity | e-sign/e-record workflows | Explicit e-consent records and reproducible retention |

### New York

| Regulation / authority | Relevance to EstateHat | Trigger | Required control direction |
|---|---|---|---|
| Real Property Law Article 12-A (§440, §442-d) | Brokerage licensing boundary and commission recovery restrictions | If EstateHat staff perform broker acts or seek brokerage compensation | Unlicensed brokerage prohibitions in process design and terms |
| Executive Law §296 (NY Human Rights Law) | Housing discrimination scope (including source of income) | Any NY housing-related process or ad | Anti-discrimination policy, ad filters, case handling and evidence trail |
| GBL §899-bb (SHIELD reasonable safeguards) | Required reasonable data-security program | Owning/licensing private information of NY residents | Administrative/technical/physical safeguards; vendor-contract controls |
| GBL §899-aa (breach notification) | Breach notification content/process | Breach affecting NY residents | Notification workflow to residents and NY authorities as required |
| Banking Law §641 (money transmission licensing) | Money-transmission licensing boundary | If EstateHat receives/transmits money | Keep partner-only flow unless licensed |
| State Technology Law §304 / §305 (ESRA) | E-sign/e-record legal effect | NY e-sign/e-record workflows | Signed-record validity, reproducible access and retention |
| GBL §349 (UDAP) | Consumer-deception risk in product claims/ads | Any NY-facing consumer representations | Plain-language disclosures and claims substantiation controls |

### Florida

| Regulation / authority | Relevance to EstateHat | Trigger | Required control direction |
|---|---|---|---|
| Chapter 475 (real-estate brokers/sales associates) | Brokerage boundary and licensing expectations | If EstateHat personnel perform brokerage functions | Product and staffing boundaries to avoid unlicensed brokerage activity |
| Chapter 760 Part II (Florida Fair Housing Act) | State housing anti-discrimination obligations | Any FL housing support flow | Fair-housing controls in listings, screening, and ad pathways |
| §501.171 (FIPA breach law) | Breach notification and incident duties | Breach affecting FL personal information | Incident-response runbook with FL notice windows and evidence logs |
| §501.059 (telephone solicitation) + Ch. 501 Part IV (telemarketing) | Higher-risk SMS/call outreach compliance | Marketing texts/calls to FL consumers | Express written consent evidence and suppression controls |
| Chapter 560 (money services businesses) | Money transmission/licensing boundary | If EstateHat moves funds directly | Partner-only funds movement unless licensed |
| §668.50 (UETA) | Electronic transaction validity | e-sign/e-record workflows | Consent + durable record retention controls |

## High-enforcement local overlays (county/city/borough/parish equivalents)

These localities are examples of stricter practical enforcement and should be treated as high-baseline launch templates.

| Locality | Why this is stricter in practice | Relevant control direction |
|---|---|---|
| New York City (all five boroughs) | Broad local anti-discrimination regime and explicit source-of-income enforcement for housing ads and screening | Block discriminatory ad language, capture reasons for denials, maintain complaint/audit records |
| Los Angeles County, CA | Strict recorder submission standards and transfer/recording process requirements | Jurisdiction-aware recording packet checks and county-specific document validation |
| San Francisco (city and county), CA | Detailed recording requirements and transfer-tax process handling | APN/situs and format validation; jurisdiction-specific recording checklists |
| Miami-Dade County, FL | Local human-rights enforcement includes housing and source-of-income discrimination | Local protected-class checks and complaint intake/escalation workflow |
| Broward County, FL | County-level human-rights enforcement in housing and public accommodations | County-level protected-class and ad-review compliance controls |

## Aggregation finding (strict-common baseline)

Across NC, CA, NY, FL and high-enforcement local overlays, the core obligations converge on:

1. Unlicensed-practice boundaries (brokerage, settlement, money transmission).
2. Fair-housing and non-discrimination controls (including ad content and source-of-income treatment).
3. Privacy and security governance with breach response and notice timelines.
4. Verifiable consent and record integrity for e-signatures, policies, and marketing outreach.
5. Jurisdiction-specific recording and documentary compliance checks.

## EstateHat current control posture (implemented in code)

- legal components require verification metadata (evidence type, reference, attestation) before completion is valid
- legal hold controls can block sensitive activation states
- compliance state model exists (jurisdiction profile, legal hold, incidents, policy versions, outlier flags, support packet, audit trail)
- Firestore rules enforce legal/compliance schemas and critical constraints server-side

## Remaining gaps requiring legal + operations completion

1. Counsel-reviewed per-jurisdiction matrix by launch market (state + county + city/borough/parish).
2. Formal legal memo defining exact triggers for brokerage, settlement-service, creditor, and money-transmission scope.
3. Subpoena/legal-hold SOP with chain-of-custody, immutable export, and retention controls.
4. Written incident-response and breach-notification runbook mapped to each jurisdiction's deadlines.
5. Marketing consent governance (SMS/call/email), including auditable consent text/version and revocation logs.
6. Vendor due-diligence package for escrow/title/payment/identity subprocessors, with contractual compliance terms.

## Primary sources

Federal
- HUD Fair Housing Act overview: https://www.hud.gov/helping-americans/fair-housing-act-overview
- DOJ Fair Housing Act: https://www.justice.gov/crt/fair-housing-act-1
- CFPB Regulation B (12 CFR 1002): https://www.consumerfinance.gov/rules-policy/regulations/1002/
- CFPB Regulation X (12 CFR 1024): https://www.consumerfinance.gov/rules-policy/regulations/1024/
- FinCEN postponement to March 1, 2026: https://www.fincen.gov/news/news-releases/fincen-announces-postponement-residential-real-estate-reporting-until-march-1
- FinCEN GTO renewal: https://www.fincen.gov/news/news-releases/fincen-renews-residential-real-estate-geographic-targeting-orders-0
- FinCEN 2024 final rule announcement: https://www.fincen.gov/news/news-releases/fincen-issues-final-rules-safeguard-residential-real-estate-investment-adviser
- FTC Safeguards Rule (16 CFR 314): https://www.ftc.gov/legal-library/browse/rules/safeguards-rule
- FTC CAN-SPAM Rule: https://www.ftc.gov/legal-library/browse/rules/can-spam-rule
- FCC one-to-one TCPA consent FAQ (effective Jan 27, 2025): https://docs.fcc.gov/public/attachments/DOC-408396A1.pdf
- E-SIGN Act (15 U.S.C. 7001): https://uscode.house.gov/view.xhtml?edition=prelim&req=granuleid%3AUSC-prelim-title15-section7001

North Carolina
- NC Chapter 93A (Real Estate License Law): https://www.ncleg.gov/Statutes/GeneralStatutes/HTML/ByChapter/Chapter_93A.html
- NC Identity Theft Protection Act (Article 2A): https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/ByArticle/Chapter_75/Article_2A.html
- NC breach statute (G.S. 75-65): https://www.ncleg.gov/enactedlegislation/statutes/html/bysection/chapter_75/gs_75-65.html
- NC Money Transmitters Act (Article 16B): https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/ByArticle/Chapter_53/Article_16B.html
- NC UETA (Article 40): https://www.ncleg.gov/EnactedLegislation/Statutes/HTML/ByArticle/Chapter_66/Article_40.html
- NC Notary Act (Chapter 10B): https://house.ncleg.gov/EnactedLegislation/Statutes/HTML/ByChapter/Chapter_10B.html

California
- BPC §10131 (broker acts): https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=BPC&sectionNum=10131.
- Gov Code §12955 (housing discrimination): https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=GOV&sectionNum=12955
- Civil Code §1798.100 (CCPA/CPRA): https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1798.100
- Civil Code §1798.82 (breach): https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1798.82
- Financial Code Division 1.2 (Money Transmission Act text): https://www.leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?article=&chapter=3.&division=1.2.&lawCode=FIN&part=&title=
- Civil Code §1633.5 (UETA): https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=CIV&sectionNum=1633.5

New York
- RPP §440 (broker definitions): https://www.nysenate.gov/legislation/laws/RPP/440
- RPP §442-d (license prerequisite for commissions): https://www.nysenate.gov/legislation/laws/RPP/442-D
- Executive Law §296 (Human Rights Law): https://www.nysenate.gov/legislation/laws/EXC/296
- GBL §899-aa (breach notice): https://www.nysenate.gov/legislation/laws/GBS/899-AA
- GBL §899-bb (SHIELD safeguards): https://www.nysenate.gov/legislation/laws/GBS/899-BB
- Banking Law §641 (money transmission license): https://www.nysenate.gov/legislation/laws/BNK/641
- STT §304 and §305 (ESRA): https://www.nysenate.gov/legislation/laws/STT/304 and https://www.nysenate.gov/legislation/laws/STT/305
- GBL §349 (UDAP): https://www.nysenate.gov/legislation/laws/GBS/349

Florida
- Chapter 475 (real-estate brokers): https://www.leg.state.fl.us/Statutes/index.cfm?App_mode=Display_Statute&StatuteYear=2025&Title=-%3E2025-%3EChapter+475&URL=0400-0499%2F0475%2F0475ContentsIndex.html
- §475.25 (discipline): https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&Search_String=&URL=0400-0499%2F0475%2FSections%2F0475.25.html
- Chapter 760 Part II (Fair Housing Act): https://www.leg.state.fl.us/Statutes./index.cfm?App_mode=Display_Statute&URL=0700-0799%2F0760%2F0760PARTIIContentsIndex.html
- §501.171 (FIPA breach law): https://www.leg.state.fl.us/Statutes/index.cfm?App_mode=Display_Statute&URL=0500-0599%2F0501%2FSections%2F0501.171.html
- §501.059 (telephone solicitation): https://www.leg.state.fl.us/statutes/index.cfm?App_mode=Display_Statute&URL=0500-0599%2F0501%2FSections%2F0501.059.html
- Chapter 501 Part IV (Florida Telemarketing Act): https://leg.state.fl.us/Statutes./index.cfm?App_mode=Display_Statute&StatuteYear=2025&Title=-%3E2025-%3EChapter+501-%3EPart+IV&URL=0500-0599%2F0501%2F0501PartIVContentsIndex.html
- Chapter 560 (Money Services Businesses): https://leg.state.fl.us/Statutes/index.cfm?App_mode=Display_Statute&StatuteYear=2025&Title=-%3E2025-%3EChapter+560&URL=0500-0599%2F0560%2F0560ContentsIndex.html
- §668.50 (UETA): https://www.leg.state.fl.us/Statutes/index.cfm/Repealed/Ch0458/index.cfm?App_mode=Display_Statute&Search_String=&URL=0600-0699%2F0668%2FSections%2F0668.50.html

Local overlays (county/city)
- NYC fair housing rights and protected classes: https://www.nyc.gov/site/fairhousing/rights-responsibilities/what-do-owners-and-renters-need-to-know.page and https://www.nyc.gov/site/fairhousing/rights-responsibilities/what-are-the-protected-classes.page
- NYC source-of-income discrimination guidance: https://www.nyc.gov/site/cchr/media/source-of-income.page
- NYC ACRIS filing/recording requirements: https://www.nyc.gov/site/finance/property/acris.page
- Los Angeles County recording requirements: https://www.lavote.gov/home/recorder/property-document-recording/recording-requirements
- San Francisco recording requirements: https://www.sf.gov/information--recording-requirements
- Miami-Dade County Commission on Human Rights: https://www.miamidade.gov/global/humanresources/fair-employment/commission-on-human-rights-board.page
- Miami-Dade County recorder role: https://www2.miamidadeclerk.gov/MobilePortal/CountyRecorder.aspx
- Broward County Human Rights jurisdiction: https://www.broward.org/HumanRights/Pages/Default.aspx
