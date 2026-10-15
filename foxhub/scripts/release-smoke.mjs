import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { footerBoilerplateGroups, getFooterItemHref, getFooterPageByPath } from "../src/footerBoilerplates.js";
import { foxhubExpansionComponents } from "../src/data.js";

const root = process.cwd();
const distDir = join(root, "dist");
const assetDir = join(distDir, "assets");
const indexHtml = readFileSync(join(distDir, "index.html"), "utf8");
const assets = readdirSync(assetDir);
const jsAssets = assets.filter((file) => file.endsWith(".js"));
const cssAssets = assets.filter((file) => file.endsWith(".css"));
const jsBundle = jsAssets.map((file) => readFileSync(join(assetDir, file), "utf8")).join("\n");
const cssBundle = cssAssets.map((file) => readFileSync(join(assetDir, file), "utf8")).join("\n");
const expoAssetDir = join(distDir, "_expo", "static", "js", "web");
const expoJsBundle = existsSync(expoAssetDir)
  ? readdirSync(expoAssetDir)
      .filter((file) => file.endsWith(".js"))
      .map((file) => readFileSync(join(expoAssetDir, file), "utf8"))
      .join("\n")
  : "";
const searchableJsBundle = `${jsBundle}\n${expoJsBundle}`;
const publicUrl = (process.env.VITE_FOXHUB_PUBLIC_URL || process.env.NEXT_PUBLIC_FOXHUB_PUBLIC_URL || "https://foxhub-c984b.web.app").replace(/\/+$/, "");
const escapedPublicUrl = publicUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

assert.match(indexHtml, /<div id="root"><\/div>/, "dist/index.html should contain the Vite app root");
assert.match(indexHtml, new RegExp(`<link rel="canonical" href="${escapedPublicUrl}/"`), "dist/index.html should expose the canonical public URL");
assert.match(indexHtml, /<meta property="og:title" content="FoxHub - A place for your people to stay close"/, "dist/index.html should expose ad-ready Open Graph title");
assert.match(indexHtml, /property="og:description"[\s\S]*content="Early access is open for FoxHub/, "dist/index.html should expose ad-ready Open Graph description");
assert.match(indexHtml, new RegExp(`${escapedPublicUrl}/foxhub-social-preview\\.png`), "dist/index.html should expose the hosted FoxHub social preview image");
assert.match(indexHtml, /<meta name="twitter:card" content="summary_large_image"/, "dist/index.html should expose a large social preview card");
assert.ok(existsSync(join(distDir, "foxhub-social-preview.png")), "dist should include the self-hosted FoxHub social preview image");
assert.ok(existsSync(join(distDir, "favicon.ico")), "dist should include the root favicon");
assert.ok(existsSync(join(distDir, "android", "index.html")), "dist should include the hosted Android app GUI at /android/");
assert.ok(existsSync(join(distDir, "_expo")), "dist should include root Expo web assets for the hosted Android app GUI");
assert.ok(existsSync(join(distDir, "downloads", "FoxHub-Android-Debug-0.1.0.apk.zip")), "dist should include the zipped Android APK download package");
assert.equal(foxhubExpansionComponents.length, 220, "Organizer should contain 220 components");
assert.equal(footerBoilerplateGroups.length, 8, "Footer should expose 8 boilerplate sections");

const footerPage = getFooterPageByPath(getFooterItemHref("legal", "Privacy Policy"));
assert.equal(footerPage?.title, "Privacy Policy", "Footer route lookup should resolve Privacy Policy");
assert.match(footerPage?.headline || "", /collects/i, "Privacy page should have public-ready privacy copy");

for (const expected of [
  "Ad source",
  "Founding access is open",
  "After approval, sign in with the same email and password",
  "Privacy Policy",
  "What FoxHub collects, why it is used, and how to ask for help.",
  "literally almost anyone who has had enough with being watched online",
  "private messages or personal images for ad profiles",
  "FoxHub is designed not to scan private messages or personal images for ad profiles",
  "System Status",
  "Complaint Controls",
  "Complaint Prevention",
  "Member Controls",
  "Staff Controls",
  "Management credentials",
  "Windows Hello staff check",
  "Management requires a Windows browser session. Android and iOS browser sessions are blocked.",
  "Verify with Windows Hello",
  "uses an OS-level Windows Hello or platform security-key prompt outside the page",
  "Requesting a server challenge for Management.",
  "Verifying Windows Hello response with the Management backend.",
  "Management backend verification failed.",
  "Management backend unavailable; using Windows Hello local gate until Functions deploy is live.",
  "Complaint Help",
  "Complaint-Zero Standards",
  "Staff Control Updates",
  "Footer quick access",
  "Latest FoxHub information stays one click away.",
  "The complaint controls are now part of the product surface.",
  "Eight safeguards are now built into FoxHub controls.",
  "Staff controls are loaded for management, support, trust, fraud, and complaint operations.",
  "foundation-readiness-checklist",
  "Member database",
  "Staff database",
  "staffMembers",
  "operatorAccess",
  "Home feed",
  "Front page for your people, places, and trusted asks.",
  "Discussed",
  "Use your current personal email for a member profile",
  "FoxHub-domain emails are reserved for approved staff and management accounts.",
  "Staff email addresses must be approved through FoxHub management.",
  "FoxHub Staff",
  "Vendor",
  "Member",
  "Date of birth (18+ only)",
  "You must be 18 or older to create a FoxHub account.",
  "Public display name",
  "Know who someone is, how you know them, and what is safe to do together.",
  "Rapport command center",
  "Trusted introductions",
  "Service trust signals",
  "Updates, actions, and signals for this workspace.",
  "As this workspace fills up, important updates and actions will appear here in the same feed format as Home.",
  "Public profile",
  "View seller profile",
  "Open in Rapport",
  "Trust lane",
  "Public strengths",
  "Public activity",
  "Member profile",
  "Public milestones",
  "Profile editor",
  "Live public preview",
  "Role and community",
  "Account email",
  "Profile memory",
  "Draft backup",
  "Saved fields",
  "Management",
  "Workflow queue",
  "Run daily member loop",
  "Open Management dashboard",
  "Management locked",
  "Staff Tools",
  "Control Library",
  "Staff control center for access, trust, risk, and operations.",
  "Staff and management accounts now stay in operator mode.",
  "Operator controls",
  "Run trust engine",
  "Merchant risk controls",
  "Settlement controls",
  "Compliance controls",
  "Operator copilot insights",
  "Account controls",
  "Member self-service",
  "Manage your profile, security, connections, and support.",
  "Profile and account settings",
  "Connection permissions",
  "Support or dispute help",
  "Report security concern",
  "Complaint prevention controls",
  "Feed Control",
  "Commercial Boundaries",
  "Safety and Moderation",
  "Trust and Anti-Spam",
  "Privacy and Account Control",
  "Attention and Notification Health",
  "Support and Dispute Resolution",
  "Product Guardrails",
  "Support operations",
  "Support, disputes, fraud, and security stay in staff view.",
  "Support macros",
  "Add new FoxHub Staff Member",
  "Support Operations Specialist",
  "support.staff@foxhub.app",
  "Add staff member",
  "Staff setup queue",
  "Staff role library",
  "Fraud Risk Analyst",
  "Compliance Operations Officer",
  "Security Operations Analyst",
  "Loaded staff controls",
  "Complaint-zero dashboard",
  "Complaint-zero staff controls",
  "Track the eight complaint sources before they repeat.",
  "Staff improvement roadmap",
  "One hundred twenty staff-side upgrades are staged across eight workstreams.",
  "Core Ops",
  "Workflow Intel",
  "Risk Quality",
  "Resilience Governance",
  "Case Support Expansion",
  "Fraud Commerce Expansion",
  "Trust Privacy Expansion",
  "Platform Governance Expansion",
  "Role-Based Permissions Matrix",
  "Case Management Center",
  "Case Intake Triage Wizard",
  "Merchant KYB Review Desk",
  "Threat Triage Console",
  "Platform Health Command Center",
  "Feature Flag Control Room",
  "Emergency Lockdown",
  "Permission audit",
  "Device recovery",
  "Fraud hold queue",
  "Security concerns",
  "Device and account recovery review",
  "Edit your public OneID card",
  "Profile photo",
  "Add profile photo",
  "Remove profile photo",
  "Profile photo saved with your public OneID card.",
  "RuntimeErrorBoundary",
  "createRetryingLazyImport",
  "FoxHub recovered a page issue.",
  "Pronouns",
  "Website or link",
  "Interests and strengths",
  "Friend activity feed",
  "Bulletin board posts",
  "Blog and journal posts",
  "Visitor preview",
  "Green Composite",
  "High Contrast",
  "Forest",
  "Ocean",
  "Ember",
  "Rose",
  "Lavender",
  "Cyberpunk",
  "Mint",
  "Midnight",
  "Solar",
  "Arctic",
  "Grape",
  "Premium Silver - $10/month",
  "Premium Gold - $20/month",
  "Dark Marble Premium - $30/month",
  "Locked",
  "Having trouble signing up?",
  "Report a sign-up issue",
  "support@foxhub.app",
  "Page or button not working",
  "Captcha or robot check",
  "Signup readiness will not complete",
  "Ad link or landing page issue",
  "Launch context",
  "FoxHub adds the page, campaign, browser, screen size, and time zone to the support draft.",
  "Attach photo",
  "JPG, PNG, GIF, SVG",
  "Optimizing...",
  "Use JPG, JPEG, PNG, GIF, or SVG vector images.",
  "Robot check",
  "Keep remotes and robots out.",
  "Refresh check",
  "Robot check answer does not match.",
  "Signup readiness",
  "Email and strong password",
  "Profile basics complete",
  "18+ date of birth",
  "Robot check complete",
  "People local to you",
  "Based on your ZIP code",
  "Add ZIP code to unlock local people",
  "Open profile settings",
  "Apply to become a merchant",
  "Merchant application",
  "Submit merchant application",
  "Merchant application sent to FoxHub Management",
  "business identity",
  "bank account confirmation",
  "Merchant dashboard",
  "Approved seller tools",
  "Save inventory item",
  "Storefront settings",
  "Save storefront settings",
  "Mobile App Terms",
  "The Android app follows the same rules as the FoxHub website.",
  "FoxHub should not sell personal or sensitive user data.",
  "Payment features are limited until production processing is enabled.",
  "FoxHub uses local storage and cookies to keep the app working.",
  "Use this path for privacy, account, and legal data requests.",
  "Do not send passwords, full payment-card numbers, government IDs, or unnecessary private details through ordinary support messages.",
  "One signup, more ways to use FoxHub",
  "Theme aware",
  "Same user database as the site",
  "A place for your people.",
  "Join FoxHub",
  "Illustrative preview",
  "Help and policies",
  "Account, notifications & safety",
  "More from your community",
  "Staff sign-in",
  "Find local help"
]) {
  assert.ok(searchableJsBundle.includes(expected), `Expected JS bundle to contain ${expected}`);
}

for (const expected of ["landing-footer", "landing-campaign-note", "launch-support-note", "landing-operations-center", "landing-operation-card", "landing-workflow-panel", "landing-control-lane", "footer-info-page", "boilerplate-footer-summary", "auth-database-panel", "database-mode-grid", "home-feed-card", "home-feed-toolbar", "workflow-queue-card", "workflow-shortcut", "rapport-command-center", "rapport-summary-grid", "section-feed-surface", "section-feed-card", "public-profile-modal", "public-profile-hero", "public-profile-trust-meter", "public-profile-activity-grid", "public-profile-showcase", "public-profile-timeline", "profile-editor-modal", "profile-editor-preview-card", "profile-photo-dropzone", "runtime-fallback", "theme-select", "data-theme=green-composite", "data-theme=forest", "data-theme=contrast", "data-theme=cyberpunk", "data-theme=arctic", "data-theme=grape", "data-theme=premium-silver", "data-theme=premium-gold", "data-theme=premium-marble", "feedback-page-panel", "feedback-contact-card", "feedback-context-card", "home-social-panel", "visitor-preview-card", "attachment-dropzone", "content-visibility:auto", "captcha-gate", "captcha-honeypot", "signup-readiness-panel", "signup-readiness-item", "local-people-card", "merchant-application-form", "merchant-dashboard-card", "merchant-controls-grid", "management-credential-overlay", "management-credential-modal", "management-gate-card"]) {
  assert.ok(cssBundle.includes(expected), `Expected CSS bundle to contain ${expected}`);
}

console.log("release smoke passed");
