import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  serverTimestamp,
  query,
  setDoc,
} from "firebase/firestore";
import { db } from "./firebase.js";

export const USER_PROFILE_SCHEMA_VERSION = 14;
export const LISTING_SUBMISSION_SCHEMA_VERSION = 1;

const ALLOWED_ACCOUNT_TYPES = new Set([
  "buyer",
  "seller",
  "corp_buyer",
  "corp_seller",
  "attorney",
  "agent",
  "inspector",
  "lender",
  "admin",
  "webmaster",
  "gov_municipality",
  "gov_township",
  "gov_county",
  "gov_borough",
  "gov_parish",
  "gov_state",
  "gov_territory",
  "gov_federal",
]);

const SELF_SERVICE_ACCOUNT_TYPES = new Set([
  "buyer",
  "seller",
  "corp_buyer",
  "corp_seller",
]);

const BUY_SELL_ACCOUNT_TYPES = new Set(["buyer", "seller"]);
const CORP_BUY_SELL_ACCOUNT_TYPES = new Set(["corp_buyer", "corp_seller"]);
const LOCKED_ACCOUNT_TYPES = new Set([
  "attorney",
  "agent",
  "inspector",
  "lender",
  "admin",
  "webmaster",
  "gov_municipality",
  "gov_township",
  "gov_county",
  "gov_borough",
  "gov_parish",
  "gov_state",
  "gov_territory",
  "gov_federal",
]);

const INDIVIDUAL_VERIFICATION_STEP_KEYS = [
  "identity",
  "selfie",
  "address",
  "citizenship",
  "ssn",
  "homeowner",
  "license",
  "background",
];

const CORPORATE_VERIFICATION_STEP_KEYS = [
  "entity_docs",
  "ein",
  "domestic_entity",
  "good_standing",
  "operating_agreement",
  "auth_resolution",
  "auth_signer_id",
  "auth_signer_selfie",
  "signer_citizenship",
  "registered_agent",
  "background_entity",
  "background_signers",
  "proof_of_funds",
];

const VERIFICATION_STEP_KEYS = [
  ...INDIVIDUAL_VERIFICATION_STEP_KEYS,
  ...CORPORATE_VERIFICATION_STEP_KEYS,
];

const LEGAL_COMPONENT_KEYS = new Set([
  "terms_ack",
  "privacy_ack",
  "disclosures_ack",
  "electronic_records_consent",
  "non_brokerage_ack",
  "fair_housing_attestation",
  "support_scope_attestation",
  "marketing_consent_attestation",
  "platform_fee_disclosure_ack",
  "funds_custody_boundary_ack",
  "identity_attestation",
  "sanctions_screening",
  "anti_fraud_ack",
  "license_in_good_standing",
  "entity_authority",
  "funds_source_attestation",
  "property_disclosure_ack",
  "aml_policy_ack",
  "government_authority",
  "records_officer_attestation",
  "ethics_attestation",
]);

const LEGAL_REVIEW_STATUSES = new Set([
  "in_progress",
  "ready",
  "needs_info",
  "approved",
  "rejected",
]);

const INCIDENT_ESCALATION_LEVELS = new Set(["none", "watch", "critical"]);
const REPUTATION_GRADES = new Set(["AA", "A", "B", "C", "D", "F"]);

const CURRENT_POLICY_VERSIONS = {
  terms: "2026-04-11",
  privacy: "2026-04-11",
  disclosures: "2026-04-11",
};

const STRICT_PRIVACY_OUTLIER_STATES = new Set([
  "CA",
  "CO",
  "CT",
  "DE",
  "IA",
  "IN",
  "KY",
  "MD",
  "MN",
  "MT",
  "NE",
  "NH",
  "NJ",
  "NY",
  "OR",
  "RI",
  "TN",
  "TX",
  "UT",
  "VA",
]);

const US_TERRITORY_CODES = new Set(["PR", "GU", "VI"]);

const STRONG_MARKETING_CONSENT_STATES = new Set(["FL"]);

const STRICT_COUNTY_KEYS = new Set([
  "NY|NEW YORK",
  "NY|KINGS",
  "NY|QUEENS",
  "NY|BRONX",
  "NY|RICHMOND",
  "CA|LOS ANGELES",
  "CA|SAN FRANCISCO",
  "CA|ALAMEDA",
  "CA|SANTA CLARA",
  "CA|SAN DIEGO",
  "IL|COOK",
  "WA|KING",
  "MD|MONTGOMERY",
  "FL|MIAMI-DADE",
  "FL|BROWARD",
  "PR|SAN JUAN",
  "GU|GUAM",
  "VI|ST. THOMAS",
  "VI|ST. CROIX",
  "VI|ST. JOHN",
]);

const STRICT_CITY_KEYS = new Set([
  "NY|NEW YORK",
  "CA|LOS ANGELES",
  "CA|SAN FRANCISCO",
  "IL|CHICAGO",
  "WA|SEATTLE",
  "MD|ROCKVILLE",
  "FL|MIAMI",
  "FL|FORT LAUDERDALE",
]);

function cleanString(value, maxLength = 120) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function sanitizeEmail(value) {
  return cleanString(value, 160).toLowerCase();
}

function sanitizePhone(value) {
  return cleanString(value, 30).replace(/[^0-9()+\-\s]/g, "");
}

function sanitizeBoolean(value, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function sanitizeInteger(value, fallback, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.round(numeric)));
}

function scoreFromGrade(grade) {
  const normalized = cleanString(grade || "B", 2).toUpperCase();
  if (normalized === "AA") return 98;
  if (normalized === "A") return 90;
  if (normalized === "B") return 80;
  if (normalized === "C") return 70;
  if (normalized === "D") return 55;
  return 25;
}

function gradeFromScore(score) {
  const value = sanitizeInteger(score, 80, 0, 100);
  if (value >= 95) return "AA";
  if (value >= 85) return "A";
  if (value >= 75) return "B";
  if (value >= 65) return "C";
  if (value >= 50) return "D";
  return "F";
}

function sanitizeStringArray(values, maxItems = 12, maxLength = 40) {
  if (!Array.isArray(values)) return [];
  return values
    .map((item) => cleanString(item, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

function normalizeJurisdictionToken(value, maxLength = 80) {
  return cleanString(value, maxLength).toUpperCase();
}

function deriveOutlierFlags(jurisdiction = {}) {
  const state = normalizeJurisdictionToken(jurisdiction.state, 60);
  const county = normalizeJurisdictionToken(jurisdiction.county, 80);
  const city = normalizeJurisdictionToken(jurisdiction.city, 80);
  const countyKey = `${state}|${county}`;
  const cityKey = `${state}|${city}`;

  const privacyOutlier = STRICT_PRIVACY_OUTLIER_STATES.has(state);
  const marketingOutlier = STRONG_MARKETING_CONSENT_STATES.has(state);
  const strictLocality = STRICT_COUNTY_KEYS.has(countyKey) || STRICT_CITY_KEYS.has(cityKey);
  const isTerritory = US_TERRITORY_CODES.has(state);
  const fairHousingOutlier = state === "NY" || state === "CA" || strictLocality;
  const recordingOutlier = strictLocality;
  const federalOutlier = true;
  const counselReviewRequired = isTerritory || privacyOutlier || marketingOutlier || fairHousingOutlier || recordingOutlier;

  return {
    territoryOutlier: isTerritory,
    privacyOutlier,
    marketingOutlier,
    fairHousingOutlier,
    recordingOutlier,
    federalOutlier,
    counselReviewRequired,
  };
}

function buildSecuritySettings(security = {}) {
  return {
    twoFactorEnabled: sanitizeBoolean(security.twoFactorEnabled, false),
    loginAlerts: sanitizeBoolean(security.loginAlerts, true),
    trustedDevice: sanitizeBoolean(security.trustedDevice, false),
    documentShield: sanitizeBoolean(security.documentShield, true),
    sessionTimeoutMinutes: sanitizeInteger(security.sessionTimeoutMinutes, 30, 15, 240),
  };
}

function buildVerificationState(verification = {}) {
  const rawStepStatus = verification.stepStatus && typeof verification.stepStatus === "object" ? verification.stepStatus : {};
  const rawStepDocuments = verification.stepDocuments && typeof verification.stepDocuments === "object" ? verification.stepDocuments : {};
  const stepDocuments = VERIFICATION_STEP_KEYS.reduce((acc, key) => {
    const docs = Array.isArray(rawStepDocuments[key]) ? rawStepDocuments[key] : [];
    acc[key] = docs.slice(0, 12).map((doc) => ({
      name: cleanString(doc?.name || "", 180),
      size: cleanString(doc?.size || "", 40),
      type: cleanString(doc?.type || "", 120),
      time: cleanString(doc?.time || "", 40),
      status: cleanString(doc?.status || "uploaded", 20) || "uploaded",
      uploadedAt: doc?.uploadedAt || null,
    })).filter((doc) => doc.name);
    return acc;
  }, {});
  const stepStatus = VERIFICATION_STEP_KEYS.reduce((acc, key) => {
    const isBackgroundOnlyStep =
      key === "background" || key === "background_entity" || key === "background_signers";
    const requestedTrue = sanitizeBoolean(rawStepStatus[key], false);
    const hasEvidence = (stepDocuments[key] || []).length > 0;
    acc[key] = requestedTrue && (isBackgroundOnlyStep || hasEvidence);
    return acc;
  }, {});
  const review = verification.review && typeof verification.review === "object" ? verification.review : {};
  const homeownerVerified = sanitizeBoolean(verification.homeownerVerified, false) && stepStatus.homeowner;

  return {
    stepStatus,
    stepDocuments,
    citizenshipStatus: cleanString(verification.citizenshipStatus || "unverified", 40) || "unverified",
    homeownerVerified,
    review: {
      status: cleanString(review.status || "in_progress", 40) || "in_progress",
      lastSubmittedAt: review.lastSubmittedAt || null,
      lastReviewedAt: review.lastReviewedAt || null,
      queueLabel: cleanString(review.queueLabel || "Standard review queue", 80),
      notes: cleanString(review.notes || "Complete your required items to move from profile setup into live transaction use.", 240),
    },
  };
}

function buildTrustState(trust = {}) {
  const active = sanitizeBoolean(trust.verifiedProfileActive, false);
  const visibility = sanitizeBoolean(trust.verifiedProfileVisibility, true);

  return {
    verifiedProfileActive: active,
    verifiedProfileVisibility: visibility,
    verifiedProfilePlan:
      cleanString(trust.verifiedProfilePlan || "verified_profile_monthly_20", 64) ||
      "verified_profile_monthly_20",
    verifiedProfilePriceCents: sanitizeInteger(trust.verifiedProfilePriceCents, 2000, 2000, 2000),
    verifiedProfileBadgeColor:
      cleanString(trust.verifiedProfileBadgeColor || "green", 20) || "green",
    verifiedProfileSince: active ? trust.verifiedProfileSince || null : null,
  };
}

function buildReputationState(reputation = {}) {
  const rawFeedback = Array.isArray(reputation.feedback) ? reputation.feedback : [];
  const feedback = rawFeedback
    .slice(0, 20)
    .map((entry = {}) => {
      const grade = cleanString(entry.grade || "B", 2).toUpperCase();
      const safeGrade = REPUTATION_GRADES.has(grade) ? grade : "B";
      const score = sanitizeInteger(entry.score, scoreFromGrade(safeGrade), 0, 100);
      return {
        id: cleanString(entry.id || `REP-${Date.now()}`, 48),
        grade: gradeFromScore(score),
        score,
        authorName: cleanString(entry.authorName || "Verified EstateHat user", 80),
        authorRole: cleanString(entry.authorRole || "buyer", 40),
        transactionRef: cleanString(entry.transactionRef || "", 80),
        testimonial: cleanString(entry.testimonial || "", 360),
        status: ["published", "pending", "hidden", "flagged"].includes(cleanString(entry.status || "", 24))
          ? cleanString(entry.status, 24)
          : "published",
        createdAt: entry.createdAt || null,
      };
    });
  const published = feedback.filter((entry) => entry.status === "published");
  const averageScore = published.length
    ? Math.round(published.reduce((sum, entry) => sum + entry.score, 0) / published.length)
    : sanitizeInteger(reputation.score, 80, 0, 100);
  const grade = gradeFromScore(averageScore);

  return {
    grade,
    score: averageScore,
    reviewCount: published.length,
    testimonialCount: published.filter((entry) => entry.testimonial).length,
    visibility: sanitizeBoolean(reputation.visibility, true),
    lastReviewedAt: reputation.lastReviewedAt || null,
    summary: cleanString(reputation.summary || "", 220),
    feedback,
  };
}

function buildUserDatabaseState(userDatabase = {}) {
  const allowedStatus = new Set(["lead", "onboarding", "active", "transacting", "closed", "dormant"]);
  const allowedContact = new Set(["email", "phone", "sms", "in_app"]);
  const allowedTier = new Set(["standard", "priority", "white_glove"]);
  const allowedRisk = new Set(["low", "medium", "high"]);
  const allowedIntent = new Set(["buy", "sell", "buy_sell", "invest", "browse", "service"]);
  const allowedBudgetBand = new Set(["under_250k", "250k_500k", "500k_1m", "1m_2m", "2m_plus", "undisclosed"]);
  const allowedTimelineBand = new Set(["immediate", "30_days", "90_days", "6_months", "12_months_plus", "undisclosed"]);

  const status = cleanString(userDatabase.status || "onboarding", 24) || "onboarding";
  const preferredContact = cleanString(userDatabase.preferredContact || "email", 24) || "email";
  const supportTier = cleanString(userDatabase.supportTier || "standard", 24) || "standard";
  const riskLevel = cleanString(userDatabase.riskLevel || "low", 16) || "low";
  const transactionIntent = cleanString(userDatabase.transactionIntent || "browse", 24) || "browse";
  const budgetBand = cleanString(userDatabase.budgetBand || "undisclosed", 24) || "undisclosed";
  const timelineBand = cleanString(userDatabase.timelineBand || "undisclosed", 24) || "undisclosed";

  const marketingOptIn = sanitizeBoolean(userDatabase.marketingOptIn, false);
  const marketingConsentMethod =
    cleanString(userDatabase.marketingConsentMethod || "", 40) || "";
  const marketingConsentVersion =
    cleanString(userDatabase.marketingConsentVersion || "", 40) || "";

  return {
    status: allowedStatus.has(status) ? status : "onboarding",
    leadSource: cleanString(userDatabase.leadSource || "direct", 60) || "direct",
    preferredContact: allowedContact.has(preferredContact) ? preferredContact : "email",
    preferredLanguage: cleanString(userDatabase.preferredLanguage || "English", 40) || "English",
    timezone: cleanString(userDatabase.timezone || "America/New_York", 60) || "America/New_York",
    supportTier: allowedTier.has(supportTier) ? supportTier : "standard",
    riskLevel: allowedRisk.has(riskLevel) ? riskLevel : "low",
    transactionIntent: allowedIntent.has(transactionIntent) ? transactionIntent : "browse",
    stageOwner: cleanString(userDatabase.stageOwner || "", 60),
    targetMarket: cleanString(userDatabase.targetMarket || "", 80),
    budgetBand: allowedBudgetBand.has(budgetBand) ? budgetBand : "undisclosed",
    timelineBand: allowedTimelineBand.has(timelineBand) ? timelineBand : "undisclosed",
    fraudWatch: sanitizeBoolean(userDatabase.fraudWatch, false),
    marketingOptIn,
    marketingConsentAt: marketingOptIn ? userDatabase.marketingConsentAt || null : null,
    marketingConsentMethod: marketingOptIn ? marketingConsentMethod : "",
    marketingConsentVersion: marketingOptIn ? marketingConsentVersion : "",
    marketingConsentIpHash: marketingOptIn ? cleanString(userDatabase.marketingConsentIpHash || "", 96) : "",
    marketingRevokedAt: marketingOptIn ? null : userDatabase.marketingRevokedAt || null,
    tags: sanitizeStringArray(userDatabase.tags, 14, 32),
    notes: cleanString(userDatabase.notes || "", 400),
    profileDepthScore: sanitizeInteger(userDatabase.profileDepthScore, 0, 0, 100),
    lastKycAt: userDatabase.lastKycAt || null,
    lastContactAt: userDatabase.lastContactAt || null,
  };
}

function buildLegalState(legal = {}) {
  const components = legal.components && typeof legal.components === "object" ? legal.components : {};
  const review = legal.review && typeof legal.review === "object" ? legal.review : {};
  const reviewStatus = cleanString(review.status || "in_progress", 40) || "in_progress";

  const normalizedComponents = Object.entries(components).reduce((acc, [key, value]) => {
    const safeKey = cleanString(key, 80);
    if (!safeKey) return acc;
    if (!LEGAL_COMPONENT_KEYS.has(safeKey)) return acc;

    if (value && typeof value === "object") {
      const evidenceType = cleanString(value.evidenceType || "", 80);
      const notes = cleanString(value.notes || "", 180);
      const attested = sanitizeBoolean(value.attested, false);
      const canVerify = evidenceType.length > 0 && notes.length >= 8 && attested;
      const complete = sanitizeBoolean(value.complete, false) && canVerify;
      acc[safeKey] = {
        complete,
        completedAt: complete ? value.completedAt || null : null,
        evidenceType,
        notes,
        attested,
        attestedAt: attested ? value.attestedAt || null : null,
      };
      return acc;
    }

    acc[safeKey] = {
      complete: sanitizeBoolean(value, false),
      completedAt: null,
      evidenceType: "",
      notes: "",
      attested: false,
      attestedAt: null,
    };
    return acc;
  }, {});

  const termsComplete = !!normalizedComponents.terms_ack?.complete;
  const privacyComplete = !!normalizedComponents.privacy_ack?.complete;
  const disclosuresComplete = !!normalizedComponents.disclosures_ack?.complete;

  return {
    components: normalizedComponents,
    acceptedTermsAt: termsComplete ? legal.acceptedTermsAt || null : null,
    acceptedPrivacyAt: privacyComplete ? legal.acceptedPrivacyAt || null : null,
    acceptedLegalDisclosuresAt: disclosuresComplete ? legal.acceptedLegalDisclosuresAt || null : null,
    review: {
      status: LEGAL_REVIEW_STATUSES.has(reviewStatus) ? reviewStatus : "in_progress",
      lastReviewedAt: review.lastReviewedAt || null,
      notes: cleanString(review.notes || "", 240),
    },
  };
}

function buildComplianceState(compliance = {}, legalState = {}, existingCompliance = {}) {
  const jurisdiction = compliance.jurisdiction && typeof compliance.jurisdiction === "object" ? compliance.jurisdiction : {};
  const regulatoryProfile = compliance.regulatoryProfile && typeof compliance.regulatoryProfile === "object" ? compliance.regulatoryProfile : {};
  const legalHold = compliance.legalHold && typeof compliance.legalHold === "object" ? compliance.legalHold : {};
  const incidents = compliance.incidents && typeof compliance.incidents === "object" ? compliance.incidents : {};
  const policy = compliance.policy && typeof compliance.policy === "object" ? compliance.policy : {};
  const outlierFlagsRaw = compliance.outlierFlags && typeof compliance.outlierFlags === "object" ? compliance.outlierFlags : {};
  const supportPacket = compliance.supportPacket && typeof compliance.supportPacket === "object" ? compliance.supportPacket : {};
  const existingAuditTrail = Array.isArray(existingCompliance.auditTrail) ? existingCompliance.auditTrail : [];

  const escalationLevel = cleanString(incidents.escalationLevel || "none", 20) || "none";
  const termsVersion = cleanString(policy.termsVersion || "", 40);
  const privacyVersion = cleanString(policy.privacyVersion || "", 40);
  const disclosuresVersion = cleanString(policy.disclosuresVersion || "", 40);

  const nextTermsVersion = legalState?.acceptedTermsAt ? (termsVersion || CURRENT_POLICY_VERSIONS.terms) : "";
  const nextPrivacyVersion = legalState?.acceptedPrivacyAt ? (privacyVersion || CURRENT_POLICY_VERSIONS.privacy) : "";
  const nextDisclosuresVersion = legalState?.acceptedLegalDisclosuresAt ? (disclosuresVersion || CURRENT_POLICY_VERSIONS.disclosures) : "";

  const normalizedJurisdiction = {
    country: cleanString(jurisdiction.country || "US", 40) || "US",
    state: cleanString(jurisdiction.state || "NC", 60) || "NC",
    county: cleanString(jurisdiction.county || "Wake", 80) || "Wake",
    city: cleanString(jurisdiction.city || "Raleigh", 80) || "Raleigh",
    municipality: cleanString(jurisdiction.municipality || "", 120),
  };

  const derivedOutlierFlags = deriveOutlierFlags(normalizedJurisdiction);
  const supportPacketReadyRequested = sanitizeBoolean(supportPacket.ready, false);
  const supportPacketReady =
    supportPacketReadyRequested
    && !!supportPacket.generatedAt
    && cleanString(supportPacket.generatedBy || "", 160).length >= 6
    && cleanString(supportPacket.jurisdictionSummary || "", 360).length >= 20;

  return {
    jurisdiction: {
      ...normalizedJurisdiction,
    },
    regulatoryProfile: {
      federalEnabled: sanitizeBoolean(regulatoryProfile.federalEnabled, true),
      stateEnabled: sanitizeBoolean(regulatoryProfile.stateEnabled, true),
      countyEnabled: sanitizeBoolean(regulatoryProfile.countyEnabled, true),
      cityEnabled: sanitizeBoolean(regulatoryProfile.cityEnabled, true),
      baselineProfile: cleanString(regulatoryProfile.baselineProfile || "strict_us_51", 40) || "strict_us_51",
      outlierReviewRequired: derivedOutlierFlags.counselReviewRequired,
      outlierLastReviewedAt: regulatoryProfile.outlierLastReviewedAt || null,
      lastJurisdictionReviewAt: regulatoryProfile.lastJurisdictionReviewAt || null,
    },
    legalHold: {
      active: sanitizeBoolean(legalHold.active, false),
      matterId: cleanString(legalHold.matterId || "", 80),
      reason: cleanString(legalHold.reason || "", 240),
      initiatedAt: legalHold.initiatedAt || null,
      releasedAt: legalHold.releasedAt || null,
    },
    incidents: {
      openCount: sanitizeInteger(incidents.openCount, 0, 0, 999),
      lastIncidentAt: incidents.lastIncidentAt || null,
      escalationLevel: INCIDENT_ESCALATION_LEVELS.has(escalationLevel) ? escalationLevel : "none",
    },
    policy: {
      termsVersion: nextTermsVersion,
      privacyVersion: nextPrivacyVersion,
      disclosuresVersion: nextDisclosuresVersion,
      lastPolicyReviewAt: policy.lastPolicyReviewAt || null,
    },
    outlierFlags: {
      territoryOutlier: sanitizeBoolean(outlierFlagsRaw.territoryOutlier, derivedOutlierFlags.territoryOutlier),
      privacyOutlier: sanitizeBoolean(outlierFlagsRaw.privacyOutlier, derivedOutlierFlags.privacyOutlier),
      marketingOutlier: sanitizeBoolean(outlierFlagsRaw.marketingOutlier, derivedOutlierFlags.marketingOutlier),
      fairHousingOutlier: sanitizeBoolean(outlierFlagsRaw.fairHousingOutlier, derivedOutlierFlags.fairHousingOutlier),
      recordingOutlier: sanitizeBoolean(outlierFlagsRaw.recordingOutlier, derivedOutlierFlags.recordingOutlier),
      federalOutlier: sanitizeBoolean(outlierFlagsRaw.federalOutlier, true),
      counselReviewRequired: sanitizeBoolean(outlierFlagsRaw.counselReviewRequired, derivedOutlierFlags.counselReviewRequired),
    },
    supportPacket: {
      ready: supportPacketReady,
      generatedAt: supportPacketReady ? supportPacket.generatedAt || null : null,
      generatedBy: supportPacketReady ? sanitizeEmail(supportPacket.generatedBy || "") : "",
      packetVersion: cleanString(supportPacket.packetVersion || "us51-baseline-2026-04-11", 40) || "us51-baseline-2026-04-11",
      jurisdictionSummary: supportPacketReady ? cleanString(supportPacket.jurisdictionSummary || "", 360) : "",
      notes: cleanString(supportPacket.notes || "", 600),
    },
    auditTrail: existingAuditTrail.slice(0, 200).map((entry) => ({
      id: cleanString(entry?.id || "", 48),
      at: entry?.at || null,
      actorUid: cleanString(entry?.actorUid || "", 128),
      actorEmail: sanitizeEmail(entry?.actorEmail || ""),
      eventType: cleanString(entry?.eventType || "profile_update", 40) || "profile_update",
      field: cleanString(entry?.field || "", 60),
      summary: cleanString(entry?.summary || "", 220),
    })).filter((entry) => entry.id && entry.at),
  };
}

function buildPayoutFrameworkState(payoutFramework = {}) {
  const allowedProviders = new Set(["stripe_connect", "square", "paypal", "adyen", "none"]);
  const allowedMethods = new Set(["ach_standard", "ach_same_day", "instant_card"]);
  const allowedSchedules = new Set(["manual", "daily", "weekly", "biweekly", "monthly"]);
  const allowedStatus = new Set(["setup", "ready", "active", "paused"]);
  const compliance = payoutFramework.compliance && typeof payoutFramework.compliance === "object" ? payoutFramework.compliance : {};
  const accounts = payoutFramework.accounts && typeof payoutFramework.accounts === "object" ? payoutFramework.accounts : {};
  const queue = Array.isArray(payoutFramework.queue) ? payoutFramework.queue : [];

  const providerPrimary = cleanString(payoutFramework.providerPrimary || "stripe_connect", 40) || "stripe_connect";
  const providerFallback = cleanString(payoutFramework.providerFallback || "none", 40) || "none";
  const payoutMethod = cleanString(payoutFramework.payoutMethod || "ach_standard", 32) || "ach_standard";
  const payoutSchedule = cleanString(payoutFramework.payoutSchedule || "weekly", 24) || "weekly";
  const status = cleanString(payoutFramework.status || "setup", 24) || "setup";

  return {
    providerPrimary: allowedProviders.has(providerPrimary) ? providerPrimary : "stripe_connect",
    providerFallback: allowedProviders.has(providerFallback) ? providerFallback : "none",
    payoutMethod: allowedMethods.has(payoutMethod) ? payoutMethod : "ach_standard",
    payoutSchedule: allowedSchedules.has(payoutSchedule) ? payoutSchedule : "weekly",
    minimumPayoutCents: sanitizeInteger(payoutFramework.minimumPayoutCents, 2500, 500, 100000000),
    reserveRateBps: sanitizeInteger(payoutFramework.reserveRateBps, 250, 0, 2000),
    instantPayoutEnabled: sanitizeBoolean(payoutFramework.instantPayoutEnabled, false),
    status: allowedStatus.has(status) ? status : "setup",
    lastPayoutAt: payoutFramework.lastPayoutAt || null,
    nextPayoutAt: payoutFramework.nextPayoutAt || null,
    compliance: {
      kycComplete: sanitizeBoolean(compliance.kycComplete, false),
      tosAccepted: sanitizeBoolean(compliance.tosAccepted, false),
      bankAccountLinked: sanitizeBoolean(compliance.bankAccountLinked, false),
      riskReviewComplete: sanitizeBoolean(compliance.riskReviewComplete, false),
      profileEligible: sanitizeBoolean(compliance.profileEligible, false),
      lastCheckedAt: compliance.lastCheckedAt || null,
    },
    accounts: {
      stripeConnectAccountId: cleanString(accounts.stripeConnectAccountId || "", 64),
      stripeOnboardingComplete: sanitizeBoolean(accounts.stripeOnboardingComplete, false),
      squareMerchantId: cleanString(accounts.squareMerchantId || "", 64),
      paypalPayoutsEmail: sanitizeEmail(accounts.paypalPayoutsEmail || ""),
      adyenAccountCode: cleanString(accounts.adyenAccountCode || "", 64),
    },
    queue: queue
      .slice(0, 20)
      .map((item) => ({
        id: cleanString(item?.id || "", 40),
        amountCents: sanitizeInteger(item?.amountCents, 0, 0, 1000000000),
        destinationLabel: cleanString(item?.destinationLabel || "", 80),
        status: cleanString(item?.status || "pending", 24) || "pending",
        createdAt: item?.createdAt || null,
      }))
      .filter((item) => item.id),
  };
}

function buildVerifiedBillingState(verifiedBilling = {}) {
  const allowedProviders = new Set(["stripe_connect", "square", "paypal", "adyen", "none"]);
  const allowedIntervals = new Set(["monthly", "yearly"]);
  const allowedStatus = new Set(["setup", "ready", "active", "paused"]);
  const compliance = verifiedBilling.compliance && typeof verifiedBilling.compliance === "object" ? verifiedBilling.compliance : {};
  const referralIncentive = verifiedBilling.referralIncentive && typeof verifiedBilling.referralIncentive === "object" ? verifiedBilling.referralIncentive : {};
  const referralCredits = Array.isArray(referralIncentive.credits) ? referralIncentive.credits : [];

  const provider = cleanString(verifiedBilling.provider || "stripe_connect", 40) || "stripe_connect";
  const interval = cleanString(verifiedBilling.interval || "monthly", 24) || "monthly";
  const status = cleanString(verifiedBilling.status || "setup", 24) || "setup";

  return {
    provider: allowedProviders.has(provider) ? provider : "stripe_connect",
    interval: allowedIntervals.has(interval) ? interval : "monthly",
    planId: cleanString(verifiedBilling.planId || "verified_profile_monthly_20", 80) || "verified_profile_monthly_20",
    priceCents: sanitizeInteger(verifiedBilling.priceCents, 2000, 2000, 2000),
    status: allowedStatus.has(status) ? status : "setup",
    autoRenew: sanitizeBoolean(verifiedBilling.autoRenew, true),
    customerId: cleanString(verifiedBilling.customerId || "", 80),
    subscriptionId: cleanString(verifiedBilling.subscriptionId || "", 80),
    lastChargeAt: verifiedBilling.lastChargeAt || null,
    nextChargeAt: verifiedBilling.nextChargeAt || null,
    referralIncentive: {
      status: cleanString(referralIncentive.status || "available", 24) || "available",
      maxFreeMonths: 12,
      earnedFreeMonths: sanitizeInteger(referralIncentive.earnedFreeMonths, 0, 0, 12),
      appliedFreeMonths: sanitizeInteger(referralIncentive.appliedFreeMonths, 0, 0, 12),
      referralCode: cleanString(referralIncentive.referralCode || "", 80),
      credits: referralCredits
        .slice(0, 12)
        .map((credit) => ({
          id: cleanString(credit?.id || "", 80),
          friendEmail: sanitizeEmail(credit?.friendEmail || ""),
          friendName: cleanString(credit?.friendName || "", 120),
          status: cleanString(credit?.status || "pending", 24) || "pending",
          freeMonths: sanitizeInteger(credit?.freeMonths, 1, 1, 1),
          createdAt: credit?.createdAt || null,
          creditedAt: credit?.creditedAt || null,
        }))
        .filter((credit) => credit.id),
    },
    compliance: {
      profileEligible: sanitizeBoolean(compliance.profileEligible, false),
      legalReady: sanitizeBoolean(compliance.legalReady, false),
      paymentMethodSaved: sanitizeBoolean(compliance.paymentMethodSaved, false),
      fraudReviewClear: sanitizeBoolean(compliance.fraudReviewClear, false),
      lastCheckedAt: compliance.lastCheckedAt || null,
    },
  };
}

function sanitizeAccountType(accountType, email, { allowPrivileged = false, existingAccountType = "" } = {}) {
  const normalizedEmail = sanitizeEmail(email);
  const reservedProfile = SPECIAL_ACCOUNT_PROFILES[normalizedEmail];
  if (reservedProfile?.accountType) return reservedProfile.accountType;

  const normalizedAccountType = cleanString(accountType, 40);
  const normalizedExistingAccountType = cleanString(existingAccountType, 40);

  if (ALLOWED_ACCOUNT_TYPES.has(normalizedExistingAccountType)) {
    if (LOCKED_ACCOUNT_TYPES.has(normalizedExistingAccountType)) return normalizedExistingAccountType;
    if (BUY_SELL_ACCOUNT_TYPES.has(normalizedExistingAccountType)) {
      return BUY_SELL_ACCOUNT_TYPES.has(normalizedAccountType)
        ? normalizedAccountType
        : normalizedExistingAccountType;
    }
    if (CORP_BUY_SELL_ACCOUNT_TYPES.has(normalizedExistingAccountType)) {
      return CORP_BUY_SELL_ACCOUNT_TYPES.has(normalizedAccountType)
        ? normalizedAccountType
        : normalizedExistingAccountType;
    }
  }

  if (!ALLOWED_ACCOUNT_TYPES.has(normalizedAccountType)) return "buyer";
  if (allowPrivileged) return normalizedAccountType;
  return SELF_SERVICE_ACCOUNT_TYPES.has(normalizedAccountType) ? normalizedAccountType : "buyer";
}

function authEmail(firebaseUser) {
  return sanitizeEmail(firebaseUser?.email || "");
}

function authUid(firebaseUser) {
  return cleanString(firebaseUser?.uid || "", 128);
}

export function buildOneEstateHatId(uid) {
  const cleanUid = cleanString(uid, 128).replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  return cleanUid ? `EH-${cleanUid.slice(0, 10)}` : "";
}

function buildBaseProfile(profile = {}, firebaseUser = null) {
  const normalizedEmail = authEmail(firebaseUser) || sanitizeEmail(profile.email || "");
  const reservedProfile = SPECIAL_ACCOUNT_PROFILES[normalizedEmail] || {};
  const existingAccountType = cleanString(profile._existingAccountType || "", 40);
  const uid = authUid(firebaseUser) || cleanString(profile.uid || "", 128);

  const security = buildSecuritySettings(profile.security);
  const verification = buildVerificationState(profile.verification);
  const legal = buildLegalState(profile.legal);
  const trust = buildTrustState(profile.trust);
  const reputation = buildReputationState(profile.reputation);
  const payoutFramework = buildPayoutFrameworkState(profile.payoutFramework);
  const verifiedBilling = buildVerifiedBillingState(profile.verifiedBilling);
  const compliance = buildComplianceState(profile.compliance, legal, profile.compliance);
  const legalHoldActive = !!compliance?.legalHold?.active;
  const legalComponents = legal.components || {};
  const marketingConsentVerified = !!legalComponents.marketing_consent_attestation?.complete;

  const hardenedTrust = legalHoldActive
    ? {
        ...trust,
        verifiedProfileActive: false,
        verifiedProfileVisibility: false,
        verifiedProfileSince: null,
      }
    : trust;

  const hardenedPayoutFramework = legalHoldActive
    ? {
        ...payoutFramework,
        status: "paused",
      }
    : payoutFramework;

  const hardenedVerifiedBilling = legalHoldActive
    ? {
        ...verifiedBilling,
        status: "paused",
      }
    : verifiedBilling;

  const userDatabase = buildUserDatabaseState(profile.userDatabase || profile.customerRecord);
  const hardenedUserDatabase =
    userDatabase.marketingOptIn && !marketingConsentVerified
      ? {
          ...userDatabase,
          marketingOptIn: false,
          marketingConsentAt: null,
          marketingConsentMethod: "",
          marketingConsentVersion: "",
          marketingConsentIpHash: "",
        }
      : userDatabase;

  return {
    uid,
    oneEstateHatId: cleanString(profile.oneEstateHatId, 32) || buildOneEstateHatId(uid),
    name: cleanString(
      profile.name ||
        reservedProfile.name ||
        firebaseUser?.displayName ||
        firebaseUser?.email?.split("@")[0] ||
        "User",
      80
    ),
    email: normalizedEmail,
    phone: sanitizePhone(profile.phone || reservedProfile.phone || ""),
    address: cleanString(profile.address || reservedProfile.address || "", 180),
    accountType: sanitizeAccountType(
      profile.accountType || reservedProfile.accountType || "buyer",
      normalizedEmail,
      { existingAccountType }
    ),
    security,
    verification,
    trust: hardenedTrust,
    reputation,
    legal,
    compliance,
    userDatabase: hardenedUserDatabase,
    payoutFramework: hardenedPayoutFramework,
    verifiedBilling: hardenedVerifiedBilling,
    schemaVersion:
      Number(profile.schemaVersion) === USER_PROFILE_SCHEMA_VERSION
        ? USER_PROFILE_SCHEMA_VERSION
        : USER_PROFILE_SCHEMA_VERSION,
  };
}

function buildProfileWrite(profile = {}, firebaseUser = null, existingProfile = null) {
  const nextBaseProfile = buildBaseProfile(
    { ...profile, _existingAccountType: existingProfile?.accountType || "" },
    firebaseUser
  );

  const changedManagedFields = existingProfile
    ? ["accountType", "security", "verification", "trust", "reputation", "legal", "payoutFramework", "verifiedBilling"]
      .filter((field) => !isSameManagedField(existingProfile[field], nextBaseProfile[field]))
    : [];

  const existingCompliance = existingProfile?.compliance && typeof existingProfile.compliance === "object"
    ? existingProfile.compliance
    : {};

  const incomingCompliance = profile.compliance && typeof profile.compliance === "object"
    ? profile.compliance
    : {};

  const baseCompliance = buildComplianceState(
    { ...existingCompliance, ...incomingCompliance },
    nextBaseProfile.legal,
    existingCompliance
  );

  const auditEntries = changedManagedFields.map((field) => ({
    id: cleanString(`${Date.now()}_${field}_${Math.random().toString(36).slice(2, 8)}`, 48),
    at: serverTimestamp(),
    actorUid: authUid(firebaseUser),
    actorEmail: authEmail(firebaseUser),
    eventType: "profile_update",
    field,
    summary: cleanString(`Updated ${field} via authenticated profile workflow.`, 220),
  }));

  const auditTrail = [...auditEntries, ...(Array.isArray(baseCompliance.auditTrail) ? baseCompliance.auditTrail : [])]
    .slice(0, 200);

  const compliance = {
    ...baseCompliance,
    auditTrail,
  };

  const userDatabase = {
    ...nextBaseProfile.userDatabase,
    marketingConsentAt:
      nextBaseProfile.userDatabase.marketingOptIn
        ? (nextBaseProfile.userDatabase.marketingConsentAt || serverTimestamp())
        : null,
    marketingRevokedAt:
      nextBaseProfile.userDatabase.marketingOptIn
        ? null
        : (nextBaseProfile.userDatabase.marketingRevokedAt || serverTimestamp()),
  };

  return {
    ...nextBaseProfile,
    userDatabase,
    compliance,
    createdAt: existingProfile?.createdAt || serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
}

function stableSerialize(value) {
  if (value === null || value === undefined) return String(value);
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function isSameManagedField(left, right) {
  if (left === right) return true;
  if (typeof left !== "object" || typeof right !== "object" || left === null || right === null) return false;
  return stableSerialize(left) === stableSerialize(right);
}

function profileNeedsRepair(existingProfile, nextProfile) {
  if (!existingProfile) return true;

  const managedFields = [
    "uid",
    "oneEstateHatId",
    "name",
    "email",
    "phone",
    "address",
    "accountType",
    "security",
    "verification",
    "trust",
    "reputation",
    "legal",
    "compliance",
    "userDatabase",
    "payoutFramework",
    "verifiedBilling",
    "schemaVersion",
  ];

  if (!existingProfile.createdAt) return true;

  return managedFields.some((field) => !isSameManagedField(existingProfile[field], nextProfile[field]));
}

export const SPECIAL_ACCOUNT_PROFILES = {
  "webmaster@estatehat.com": {
    name: "EstateHat Webmaster",
    accountType: "webmaster",
    phone: "(919) 555-0111",
    address: "421 Fayetteville Street, Suite 1100, Raleigh, NC 27601",
  },
  "webmaster.login@estatehat.com": {
    name: "EstateHat Webmaster",
    accountType: "webmaster",
    phone: "(919) 555-0111",
    address: "421 Fayetteville Street, Suite 1100, Raleigh, NC 27601",
  },
  "administrator@estatehat.com": {
    name: "EstateHat Administrator",
    accountType: "admin",
    phone: "(919) 555-0101",
    address: "421 Fayetteville Street, Suite 1100, Raleigh, NC 27601",
  },
};

export function defaultProfile(firebaseUser, overrides = {}) {
  return buildBaseProfile(overrides, firebaseUser);
}

export function sanitizeUserProfile(profile = {}, firebaseUser = null) {
  return {
    ...buildBaseProfile({ ...profile, _existingAccountType: profile?.accountType || "" }, firebaseUser),
    createdAt: profile?.createdAt || null,
    updatedAt: profile?.updatedAt || null,
  };
}

export async function loadUserProfile(firebaseUser) {
  if (!firebaseUser?.uid) return null;
  const fallback = defaultProfile(firebaseUser);

  try {
    const snap = await getDoc(doc(db, "users", firebaseUser.uid));
    return snap.exists() ? sanitizeUserProfile({ ...fallback, ...snap.data() }, firebaseUser) : fallback;
  } catch {
    return fallback;
  }
}

export async function ensureUserProfile(firebaseUser, overrides = {}, { throwOnError = false } = {}) {
  if (!firebaseUser?.uid) return null;
  const fallback = defaultProfile(firebaseUser, overrides);

  try {
    const snap = await getDoc(doc(db, "users", firebaseUser.uid));
    if (snap.exists()) {
      const existing = snap.data();
      const sanitized = sanitizeUserProfile({ ...existing, ...overrides }, firebaseUser);

      if (profileNeedsRepair(existing, sanitized)) {
        await setDoc(
          doc(db, "users", firebaseUser.uid),
          buildProfileWrite({ ...existing, ...overrides }, firebaseUser, existing),
          { merge: true }
        );
      }

      return sanitized;
    }

    const writePayload = buildProfileWrite(fallback, firebaseUser);
    await setDoc(doc(db, "users", firebaseUser.uid), writePayload, { merge: true });
    const sanitized = sanitizeUserProfile(writePayload, firebaseUser);
    return sanitized;
  } catch (error) {
    if (throwOnError) throw error;
    return fallback;
  }
}

export async function saveUserProfile(uid, profile, firebaseUser = null) {
  if (!uid) throw new Error("Missing user id.");

  const authUser = firebaseUser && authUid(firebaseUser) === uid ? firebaseUser : { ...firebaseUser, uid };
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  const existing = snap.exists() ? snap.data() : null;
  const writePayload = buildProfileWrite({ ...existing, ...profile, uid }, authUser, existing);

  await setDoc(ref, writePayload, { merge: true });
  return sanitizeUserProfile(writePayload, authUser);
}

export async function submitListingForReview({ user, listing, exteriorPhotos = [], interiorPhotos = [], documents = [] } = {}) {
  if (!user?.uid) {
    throw new Error("You must be signed in to submit a listing.");
  }

  const title = cleanString(listing?.title, 140);
  const address = cleanString(listing?.address, 180);
  const city = cleanString(listing?.city, 80);
  const state = normalizeJurisdictionToken(listing?.state, 10);
  const county = cleanString(listing?.county, 80);
  const municipality = cleanString(listing?.municipality, 120);
  const zip = cleanString(listing?.zip, 16);
  const description = cleanString(listing?.description, 2000);
  const price = sanitizeInteger(listing?.price, 0, 0, 1000000000);
  const beds = sanitizeInteger(listing?.beds, 0, 0, 99);
  const baths = sanitizeInteger(listing?.baths, 0, 0, 99);
  const sqft = sanitizeInteger(listing?.sqft, 0, 0, 500000);
  const type = cleanString(listing?.type || "House", 40) || "House";
  const status = "pending_review";
  const reviewStatus = "queued";

  if (!title || !address || !city || !state || !zip || !price) {
    throw new Error("Listing title, address, city, state, ZIP, and price are required.");
  }

  const normalizedSellerFeeLines = normalizeSellerFeeLines(price, listing?.sellerFeeLines || []).map((line) => ({
    id: cleanString(line.id, 80),
    label: cleanString(line.label, 60),
    mode: line.mode === "percentage" ? "percentage" : "amount",
    value: Number(line.value) || 0,
    amount: Math.round(Number(line.amount) || 0),
  }));

  const normalizeAssetList = (items) =>
    (Array.isArray(items) ? items : []).slice(0, 24).map((item) => ({
      name: cleanString(item?.name, 180),
      sizeLabel: cleanString(item?.size, 40),
      mimeType: cleanString(item?.type, 120),
      capturedAtLabel: cleanString(item?.time, 40),
      status: cleanString(item?.status || "uploaded", 24) || "uploaded",
    }));

  const normalizedExteriorPhotos = normalizeAssetList(exteriorPhotos);
  const normalizedInteriorPhotos = normalizeAssetList(interiorPhotos);
  const normalizedDocuments = normalizeAssetList(documents);
  const inferredJurisdiction = {
    state,
    city,
    county,
    municipality,
  };

  const ref = doc(collection(db, "listingSubmissions"));
  const payload = {
    schemaVersion: LISTING_SUBMISSION_SCHEMA_VERSION,
    status,
    reviewStatus,
    submissionType: "listing",
    listingId: ref.id,
    userId: cleanString(user.uid, 80),
    sellerName: cleanString(user.name, 120),
    sellerEmail: sanitizeEmail(user.email),
    sellerAccountType: cleanString(user.accountType, 40),
    title,
    address,
    city,
    state,
    county,
    municipality,
    zip,
    price,
    beds,
    baths,
    sqft,
    type,
    description,
    jurisdiction: inferredJurisdiction,
    addressVerified: sanitizeBoolean(listing?.addressVerified, false),
    exteriorPhotoCount: normalizedExteriorPhotos.length,
    interiorPhotoCount: normalizedInteriorPhotos.length,
    documentCount: normalizedDocuments.length,
    exteriorPhotos: normalizedExteriorPhotos,
    interiorPhotos: normalizedInteriorPhotos,
    documents: normalizedDocuments,
    sellerFeeLines: normalizedSellerFeeLines,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    submittedAt: serverTimestamp(),
  };

  await setDoc(ref, payload);
  return {
    id: ref.id,
    ...payload,
  };
}

export function subscribeToListings(onData, onError) {
  const listingsQuery = query(collection(db, "listings"), orderBy("daysListed", "asc"));

  return onSnapshot(
    listingsQuery,
    (snapshot) => {
      onData(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
    },
    (error) => {
      onError?.(error);
    }
  );
}

export function subscribeToFeaturedPlacements(onData, onError) {
  const placementsQuery = query(collection(db, "featuredPlacements"), orderBy("createdAt", "desc"));

  return onSnapshot(
    placementsQuery,
    (snapshot) => {
      onData(
        snapshot.docs.map((entry) => ({
          id: entry.id,
          ...entry.data(),
        }))
      );
    },
    (error) => {
      onError?.(error);
    }
  );
}
