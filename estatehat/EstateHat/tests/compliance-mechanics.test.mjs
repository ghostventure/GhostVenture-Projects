import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appPath = path.join(repoRoot, "src", "estatehat-platform-alpha.jsx");
const rulesPath = path.join(repoRoot, "firestore.rules");
const backendPath = path.join(repoRoot, "src", "backend.js");
const functionsPath = path.join(repoRoot, "functions", "index.js");

const appSource = fs.readFileSync(appPath, "utf8");
const rulesSource = fs.readFileSync(rulesPath, "utf8");
const backendSource = fs.readFileSync(backendPath, "utf8");
const functionsSource = fs.readFileSync(functionsPath, "utf8");

test("route permission requirements are centralized for protected post-login views", () => {
  const requiredMappings = [
    'browse: "browse"',
    'watchlist: "browse"',
    'detail: "detail"',
    'matching: "browse"',
    'list: "list"',
    'messages: "messages"',
    'transaction: "transaction"',
    'boilerplates: "boilerplates"',
    'profile: "profile"',
    'admin: "admin"',
  ];
  for (const mapping of requiredMappings) {
    assert.ok(appSource.includes(mapping), `missing view mapping ${mapping}`);
  }
  assert.ok(appSource.includes("function isViewAllowedForPerms(view, perms)"), "missing isViewAllowedForPerms helper");
  assert.ok(appSource.includes("if (!isViewAllowedForPerms(v, navPerms))"), "navigate() should enforce route access checks");
});

test("legal component gates include fee and funds custody attestations", () => {
  const requiredGateKeys = [
    "platform_fee_disclosure_ack",
    "funds_custody_boundary_ack",
    'legal.components.platform_fee_disclosure_ack.complete == true',
    'legal.components.funds_custody_boundary_ack.complete == true',
  ];
  for (const key of requiredGateKeys) {
    assert.ok(rulesSource.includes(key), `missing legal gate key ${key}`);
  }
});

test("jurisdiction sync captures state/county/city/municipality and applies overlay", () => {
  const requiredSyncSignals = [
    "syncJurisdictionFromTransaction",
    "deriveLocationComplianceOverlay(nextJurisdiction)",
    "state:",
    "county:",
    "city:",
    "municipality:",
    "baselineProfile: \"strict_us_51\"",
    "outlierReviewRequired:",
  ];
  for (const signal of requiredSyncSignals) {
    assert.ok(appSource.includes(signal), `missing jurisdiction sync signal ${signal}`);
  }
});

test("territory outlier handling exists in frontend, backend, and rules", () => {
  assert.ok(appSource.includes("territoryOutlier"), "frontend must include territoryOutlier");
  assert.ok(backendSource.includes("territoryOutlier"), "backend must include territoryOutlier");
  assert.ok(rulesSource.includes('"territoryOutlier"'), "firestore rules must include territoryOutlier");
});

test("assistant and FAQ disclosure location guidance is present", () => {
  const expectedCopySignals = [
    "Where can I review all legal, compliance, and support scope disclosures?",
    "Where To Find Disclosures In-Product",
    "Where are compliance disclosures and required attestations?",
    "Open Forms",
    "Hat Data and Goodies",
  ];
  for (const signal of expectedCopySignals) {
    assert.ok(appSource.includes(signal), `missing disclosure signal ${signal}`);
  }
});

test("profile reputation grading system is installed across backend, rules, and UI", () => {
  const expectedSignals = [
    "REPUTATION_GRADES",
    "reputationGradeFromScore",
    "GradeBadge",
    "Add Reputation Record",
    "Feedback And Testimonials",
    "Profile Reputation Grade",
  ];
  for (const signal of expectedSignals) {
    assert.ok(appSource.includes(signal), `missing reputation UI signal ${signal}`);
  }

  const backendSignals = [
    "buildReputationState",
    "gradeFromScore",
    "scoreFromGrade",
    "reputation",
    "USER_PROFILE_SCHEMA_VERSION = 14",
  ];
  for (const signal of backendSignals) {
    assert.ok(backendSource.includes(signal), `missing reputation backend signal ${signal}`);
  }

  const rulesSignals = [
    "validReputationShape",
    '"AA", "A", "B", "C", "D", "F"',
    "request.resource.data.schemaVersion == 14",
    '"reputation"',
  ];
  for (const signal of rulesSignals) {
    assert.ok(rulesSource.includes(signal), `missing reputation rules signal ${signal}`);
  }
});

test("seller listing submissions persist into a review queue instead of only local UI state", () => {
  const appSignals = [
    "submitListingForReview",
    "setSubmittedListingId(submission.id)",
    "Submission ID:",
  ];
  for (const signal of appSignals) {
    assert.ok(appSource.includes(signal), `missing listing submission UI signal ${signal}`);
  }

  const backendSignals = [
    'LISTING_SUBMISSION_SCHEMA_VERSION = 1',
    'doc(collection(db, "listingSubmissions"))',
    'submissionType: "listing"',
    'status = "pending_review"',
    'reviewStatus = "queued"',
  ];
  for (const signal of backendSignals) {
    assert.ok(backendSource.includes(signal), `missing listing submission backend signal ${signal}`);
  }

  const rulesSignals = [
    "match /listingSubmissions/{submissionId}",
    "canSubmitListing()",
    'request.resource.data.status == "pending_review"',
    'request.resource.data.reviewStatus == "queued"',
  ];
  for (const signal of rulesSignals) {
    assert.ok(rulesSource.includes(signal), `missing listing submission rule signal ${signal}`);
  }
});

test("backend listing operations install review and publication mechanics", () => {
  const functionSignals = [
    "export const apiListingOps = onRequest(",
    'listingOps: "/api/listings/*"',
    "handleListingOps",
    "reviewListingSubmission",
    'db.collection("listings").doc(publishedListingId)',
    'db.collection("listingSubmissions").doc(submissionId)',
    'pathname === "/submissions/review"',
  ];
  for (const signal of functionSignals) {
    assert.ok(functionsSource.includes(signal), `missing listing ops backend signal ${signal}`);
  }

  const backendApiSignals = [
    'listingOps: "apiListingOps"',
    'listingOps: "/api/listings"',
    "getListingSubmissions",
    "getListingSubmissionQueue",
    "postListingSubmissionReview",
  ];
  for (const signal of backendApiSignals) {
    assert.ok(appSource.includes(signal) || backendSource.includes(signal) || functionsSource.includes(signal) || fs.readFileSync(path.join(repoRoot, "src", "backend-api.js"), "utf8").includes(signal), `missing listing ops client signal ${signal}`);
  }
});

test("featured placements use checkout, activation, and live browse/service surfaces", () => {
  const functionSignals = [
    "FEATURED_PLACEMENT_DAYS = 30",
    "FEATURED_PLACEMENT_PRICES",
    "recordFeaturedPlacementPayment",
    'metadata?.kind === "featured_placement"',
    'pathname === "/featured-placement-checkout"',
    'db.collection("featuredPlacements").doc(checkoutSession.id).set',
  ];
  for (const signal of functionSignals) {
    assert.ok(functionsSource.includes(signal), `missing featured placement backend signal ${signal}`);
  }

  const ruleSignals = [
    "match /featuredPlacements/{placementId}",
  ];
  for (const signal of ruleSignals) {
    assert.ok(rulesSource.includes(signal), `missing featured placement rule signal ${signal}`);
  }

  const backendSignals = [
    'collection(db, "featuredPlacements")',
    "subscribeToFeaturedPlacements",
  ];
  for (const signal of backendSignals) {
    assert.ok(backendSource.includes(signal), `missing featured placement client backend signal ${signal}`);
  }

  const appSignals = [
    "buildFeaturedListingIdSet",
    "FEATURED_LISTING_PRICE_LABEL",
    "Feature This Listing",
    "Featured Service Spotlight",
    "Buy Featured Service Spotlight",
    "★ Featured",
    "featured-placement-success",
  ];
  for (const signal of appSignals) {
    assert.ok(appSource.includes(signal), `missing featured placement app signal ${signal}`);
  }
});
