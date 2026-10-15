export const footerBoilerplateGroups = [
  {
    id: "legal",
    label: "Legal",
    glyph: "L",
    summary: "Plain-language rules for accounts, privacy, mobile apps, complaint controls, marketplace activity, payments, and community behavior.",
    accent: "Clear rules",
    owner: "Policy",
    status: "Review-ready",
    items: ["Terms of Use", "Privacy Policy", "Mobile App Terms", "Complaint Controls", "Marketplace Rules", "Payment Terms", "Cookie Notice"]
  },
  {
    id: "company",
    label: "Company",
    glyph: "C",
    summary: "Core company pages that explain what FoxHub does, who it serves, and how people should get started.",
    accent: "Brand core",
    owner: "Comms",
    status: "Public-ready",
    items: ["About Page", "Mission", "Press Kit", "Careers", "Contact", "Launch Cities"]
  },
  {
    id: "product",
    label: "Product",
    glyph: "P",
    summary: "Friendly guides for member controls, staff controls, complaint prevention, account setup, mini apps, and local discovery.",
    accent: "Control center",
    owner: "Product",
    status: "Live guide",
    items: ["What's Inside", "Getting Started", "Complaint Prevention", "Member Controls", "Staff Controls", "Accessibility"]
  },
  {
    id: "support",
    label: "Support",
    glyph: "S",
    summary: "Help paths for account access, complaint prevention, payments, marketplace disputes, safety reports, and feature questions.",
    accent: "Help desk",
    owner: "Support",
    status: "Always on",
    items: ["Help Center", "Account Recovery", "Complaint Help", "Report a Problem", "Safety Center", "Contact Support"]
  },
  {
    id: "trust",
    label: "Trust",
    glyph: "T",
    summary: "Trust and safety material for complaint-zero standards, verification, scams, moderation, buyer protection, and appeals.",
    accent: "Safety layer",
    owner: "Trust Ops",
    status: "Guarded",
    items: ["Complaint-Zero Standards", "Verification Guide", "Scam Prevention", "Appeals", "Moderation Notes", "Data Requests"]
  },
  {
    id: "business",
    label: "Business",
    glyph: "B",
    summary: "Merchant and creator boilerplates for storefronts, payouts, QR checkout, vendor packets, and launch readiness.",
    accent: "Merchant ops",
    owner: "MerchantOS",
    status: "Pilot-ready",
    items: ["Merchant Guide", "Creator Tools", "Payout Setup", "QR Checkout", "Vendor Packet", "Local Deals"]
  },
  {
    id: "developers",
    label: "Developers",
    glyph: "D",
    summary: "Mini-app and integration pages for manifests, permissions, release reviews, webhooks, and API readiness.",
    accent: "Build layer",
    owner: "Platform",
    status: "Sandboxed",
    items: ["Mini-App Docs", "Permission Model", "API Notes", "Webhook Guide", "Release Review", "Status Events"]
  },
  {
    id: "status",
    label: "Status",
    glyph: "O",
    summary: "Operational pages for uptime, latest release notes, known issues, incident updates, staff controls, and deploy history.",
    accent: "Ops signal",
    owner: "Operations",
    status: "Monitored",
    items: ["System Status", "Release Notes", "Known Issues", "Incident History", "Staff Control Updates", "Deploy Log"]
  }
];

export function slugifyFooterItem(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getFooterItemHref(groupId, item) {
  return `/footer/${groupId}/${slugifyFooterItem(item)}`;
}

export const footerQuickAccessLinks = [
  {
    label: "Privacy Policy",
    groupId: "legal",
    item: "Privacy Policy",
    detail: "Public, private, staff-visible, export, delete, and safety-review boundaries."
  },
  {
    label: "Complaint Prevention",
    groupId: "product",
    item: "Complaint Prevention",
    detail: "The eight safeguards for feed control, commerce boundaries, safety, spam, privacy, notifications, support, and product guardrails."
  },
  {
    label: "Staff Controls",
    groupId: "product",
    item: "Staff Controls",
    detail: "Management, Staff Tools, Control Library, staff roles, complaint-zero dashboard, and support operations."
  },
  {
    label: "Safety Center",
    groupId: "support",
    item: "Safety Center",
    detail: "Reporting, scams, harmful content, appeals, account recovery, and trust support."
  },
  {
    label: "System Status",
    groupId: "status",
    item: "System Status",
    detail: "Live route health, release notes, known issues, security updates, and deploy history."
  },
  {
    label: "Contact Support",
    groupId: "support",
    item: "Contact Support",
    detail: "Account, invite, privacy, marketplace, payment, fraud, security, and product concerns."
  }
].map((link) => ({
  ...link,
  href: getFooterItemHref(link.groupId, link.item)
}));

const footerPageContent = {
  "legal/privacy-policy": {
    headline: "What FoxHub collects, why it is used, and how to ask for help.",
    body: [
      "FoxHub may use account details, profile fields, sign-in activity, device/session signals, support context, safety reports, marketplace records, payment-related records, and audit records when those features are used.",
      "The website and Android app use the same account. Service providers such as Firebase help FoxHub sign users in, store records, protect the service, and keep the app reliable.",
      "FoxHub is designed not to scan private messages or personal images for ad profiles, and FoxHub should not sell personal or sensitive user data.",
      "Privacy requests, account deletion, correction, export, and legal request handling live on Data Requests so this page can stay focused on the main privacy promise.",
      "Mobile store disclosures should match this policy and the app's real data use before broader store publication."
    ],
    actions: ["Review account visibility", "Open Data Requests", "Contact privacy support"]
  },
  "legal/mobile-app-terms": {
    headline: "The Android app follows the same rules as the FoxHub website.",
    body: [
      "The Android app is another way to use the same FoxHub account, profile, support, safety, and marketplace features.",
      "Install FoxHub only from official FoxHub-controlled links. Early APK builds may be shared through Expo EAS while store publication is prepared.",
      "The app should request only permissions needed for visible features. If sensitive permissions are added later, the app screen and store listing should explain why.",
      "Do not tamper with the app, overload it, scrape it, bypass access controls, impersonate staff, or access accounts you are not allowed to use.",
      "Mobile access may be limited or suspended for security, fraud, abuse, legal compliance, or product-integrity reasons."
    ],
    actions: ["Use official install links", "Keep account secure", "Report mobile issues"]
  },
  "legal/complaint-controls": {
    headline: "The complaint controls are now part of the product surface.",
    body: [
      "FoxHub tracks eight complaint categories: Feed Control, Commercial Boundaries, Safety and Moderation, Trust and Anti-Spam, Privacy and Account Control, Attention and Notification Health, Support and Dispute Resolution, and Product Guardrails.",
      "Members can open complaint-prevention controls from Account controls. Staff can review the same categories from the Complaint-zero dashboard in Management.",
      "The goal is to catch repeat problems early instead of hiding support paths after users get frustrated."
    ],
    actions: ["Open Account controls", "Review staff dashboard", "Track repeat complaints"]
  },
  "legal/terms-of-use": {
    headline: "Simple rules for a private community app.",
    body: [
      "FoxHub members should use the app for lawful, respectful, and trust-based coordination.",
      "Accounts are personal to the registered user unless FoxHub approves a staff, merchant, organization, or operator role. Do not share credentials, impersonate others, evade access controls, or misrepresent your relationship to a person, business, event, listing, or payment.",
      "Public profile details, listings, messages, posts, support reports, and marketplace activity must not be illegal, deceptive, abusive, invasive, infringing, exploitative, or unsafe.",
      "FoxHub may review, limit, remove, preserve, or disclose records when needed for safety, security, fraud prevention, legal compliance, support, payment disputes, or enforcement.",
      "Marketplace and payment details live on their own pages so these Terms can stay focused on account and community rules.",
      "These terms are public launch copy and should be reviewed by counsel before paid campaigns, store publication, payment processing, or broad marketplace operations scale."
    ],
    actions: ["Use FoxHub lawfully", "Respect account limits", "Contact support"]
  },
  "legal/marketplace-rules": {
    headline: "Marketplace activity needs trust, accuracy, and clear boundaries.",
    body: [
      "Listings, service offers, jobs, housing, merchant posts, event offers, and local deals must be accurate, lawful, and posted by someone authorized to make the offer.",
      "FoxHub can hold, review, limit, or remove listings for fraud risk, unsafe categories, misleading claims, price abuse, prohibited goods or services, impersonation, intellectual-property concerns, or repeated complaints.",
      "Members and merchants are responsible for taxes, licenses, permits, insurance, refunds, delivery, in-person safety, and compliance obligations that apply to their own activity.",
      "FoxHub may provide trust signals, rapport context, moderation tools, dispute intake, and staff review, but those tools are not a guarantee that a person, place, product, service, or transaction is risk-free.",
      "Offline meetings, rides, housing arrangements, jobs, services, and local transactions should be handled cautiously and with appropriate verification."
    ],
    actions: ["Post accurate listings", "Report unsafe offers", "Use dispute help"]
  },
  "legal/payment-terms": {
    headline: "Payment features are limited until production processing is enabled.",
    body: [
      "FoxHub may show wallet, checkout, payment, merchant, payout, or settlement interfaces before every processor-backed feature is fully live.",
      "Members should not treat a displayed payment surface as a completed charge, payout, refund, escrow, bank transfer, or financial account unless FoxHub clearly confirms the transaction through the active processor flow.",
      "When payment processing is enabled, FoxHub may use third-party processors and keep the transaction, dispute, fraud, settlement, and support records needed to operate the feature.",
      "FoxHub is not a bank, card issuer, lender, insurer, tax adviser, escrow agent, or legal adviser.",
      "Users and merchants remain responsible for taxes, licenses, refunds, delivery, and their own contractual obligations."
    ],
    actions: ["Check payment status", "Open dispute help", "Review merchant rules"]
  },
  "legal/cookie-notice": {
    headline: "FoxHub uses local storage and cookies to keep the app working.",
    body: [
      "FoxHub may use cookies, local storage, IndexedDB, authentication tokens, session records, theme preferences, sign-up draft context, device/session indicators, and security signals.",
      "These tools support sign-in, account security, drafts, app preferences, fraud prevention, abuse prevention, support context, release diagnostics, and basic site delivery.",
      "Clearing browser or device storage can sign you out, remove unsent drafts, reset preferences, or make support context less complete.",
      "If marketing, analytics, or cross-site advertising tools are added later, this notice and any consent experience should be updated before rollout.",
      "Privacy choices and deletion requests belong on Privacy Policy and Data Requests; this page only explains browser and app storage."
    ],
    actions: ["Manage browser storage", "Sign out of sessions", "Contact privacy support"]
  },
  "support/help-center": {
    headline: "Help should be easy to find before sign-in and after account setup.",
    body: [
      "The help center gives new visitors a path for account access, invites, safety questions, and payment concerns.",
      "Support content should prioritize short answers, recovery steps, and plain escalation paths.",
      "Advertising traffic should always have a visible way to get help, and signed-in members should be able to open support from Account controls."
    ],
    actions: ["Account help", "Complaint help", "Safety help"]
  },
  "support/complaint-help": {
    headline: "A direct path for the complaints users repeat most.",
    body: [
      "Complaint Help routes users toward feed control, commercial-boundary issues, moderation appeals, privacy concerns, spam/scam reports, notification overload, support disputes, and product-direction concerns.",
      "The member-facing controls route into existing support, safety, privacy, notification, and product-review actions.",
      "The staff-facing dashboard keeps the same categories visible so support work maps back to product fixes."
    ],
    actions: ["Choose a complaint category", "Open a support case", "Escalate repeat issues"]
  },
  "support/contact-support": {
    headline: "A clear support lane for early users.",
    body: [
      "Use support for account access, invites, Android app trouble, privacy questions, marketplace issues, payment questions, safety reports, and product problems.",
      "Support may ask for account email, profile handle, device or app context, the page or route, a screenshot, a listing or transaction reference, and a short description.",
      "Do not send passwords, full payment-card numbers, government IDs, or unnecessary private details through ordinary support messages.",
      "Privacy exports, deletion, correction, and legal requests belong on Data Requests so staff can verify the requester and route the issue correctly."
    ],
    actions: ["Describe the issue", "Attach context", "Open Data Requests"]
  },
  "support/safety-center": {
    headline: "Safety belongs on the front porch.",
    body: [
      "FoxHub's safety center explains reporting, scam prevention, moderation, appeals, and trusted-circle behavior.",
      "The goal is to make private community coordination feel safer than public-feed posting.",
      "Safety pages should be visible to both new visitors and signed-in users."
    ],
    actions: ["Report a problem", "Avoid scams", "Understand appeals"]
  },
  "trust/data-requests": {
    headline: "Use this path for privacy, account, and legal data requests.",
    body: [
      "Members can ask for account correction, export, deletion, privacy help, security review, or legal request routing here.",
      "FoxHub may need to verify the requester before changing, exporting, deleting, or disclosing account records.",
      "Some records may be retained for security, fraud prevention, payment disputes, legal obligations, abuse investigations, audit logs, backup integrity, or an active support case.",
      "Staff should keep restricted operational notes separate from user-facing summaries and redact sensitive details when needed.",
      "Law-enforcement or third-party legal requests should go through the support/legal review path, not ordinary member messages."
    ],
    actions: ["Verify requester", "Review retention", "Escalate legal request"]
  },
  "trust/complaint-zero-standards": {
    headline: "Complaint-zero means no repeat complaint should stay unresolved.",
    body: [
      "FoxHub cannot promise that nobody will ever complain, but it can make repeated unresolved complaints visible and actionable.",
      "The eight standards cover feed control, commercial boundaries, safety and moderation, trust and anti-spam, privacy and account control, attention and notifications, support and disputes, and product guardrails.",
      "Staff controls are loaded for access review, permission audit, fraud holds, security incidents, dispute intake, compliance review, merchant risk, settlement approval, and device recovery."
    ],
    actions: ["Measure repeat complaints", "Assign an owner", "Close the loop"]
  },
  "status/system-status": {
    headline: "Public status for public confidence.",
    body: [
      "The status page gives visitors a place to check availability, known issues, and recent deploys.",
      "Before larger campaigns, this should include a simple incident log and a current operating note.",
      "A visible status route reduces confusion when users arrive from ads."
    ],
    actions: ["Show uptime", "List known issues", "Record deploys"]
  },
  "status/release-notes": {
    headline: "Latest FoxHub release notes stay visible from the footer.",
    body: [
      "Recent releases added ad-ready public metadata, separated staff and member workspaces, expanded member account controls, loaded staff roles, added staff setup, and installed complaint-zero controls.",
      "The live Hosting deploy is verified through release checks, public smoke checks, and live route headers after each publish.",
      "Footer routes now point users toward the newest product, support, trust, staff, and status information without needing to sign in first."
    ],
    actions: ["Review latest controls", "Check live status", "Open support"]
  },
  "status/staff-control-updates": {
    headline: "Staff controls now have their own operational update lane.",
    body: [
      "Management includes Staff Tools, Control Library, Add new FoxHub Staff Member, Staff role library, Loaded staff controls, and the Complaint-zero dashboard.",
      "Staff roles now include support ops, trust and safety, fraud and risk, disputes, compliance, moderation, merchant ops, security, customer success, operations manager, admin, and auditor.",
      "Production staff invitation still needs backend invite delivery and custom-claim assignment before it should be treated as live account provisioning."
    ],
    actions: ["Review staff roles", "Open complaint dashboard", "Check invite readiness"]
  },
  "company/mission": {
    headline: "Private circles, trusted local help, and less noise.",
    body: [
      "FoxHub exists to help people coordinate with the people, groups, creators, neighbors, and local businesses they actually trust.",
      "That matters to literally almost anyone who has had enough with being watched online.",
      "The product direction is private-first community utility rather than public-feed performance.",
      "Public copy should keep that promise simple, specific, and easy to understand."
    ],
    actions: ["Explain the mission", "Invite trusted circles", "Keep privacy specific"]
  },
  "product/what-s-inside": {
    headline: "A private coordination app with room to grow.",
    body: [
      "FoxHub combines social circles, local help, services, marketplace paths, payment surfaces, and mini-app style tools.",
      "The early-access version should be framed as a private community foundation, not a finished banking or marketplace platform.",
      "That keeps advertising honest while the production backend matures."
    ],
    actions: ["Private circles", "Local help", "Mini-app tools"]
  },
  "product/complaint-prevention": {
    headline: "Eight safeguards are now built into FoxHub controls.",
    body: [
      "Complaint prevention covers Feed Control, Commercial Boundaries, Safety and Moderation, Trust and Anti-Spam, Privacy and Account Control, Attention and Notification Health, Support and Dispute Resolution, and Product Guardrails.",
      "Members get a compact Complaint prevention controls panel in Account controls.",
      "Staff get a Complaint-zero dashboard in Management with matching categories, counts, and action buttons."
    ],
    actions: ["Tune feed controls", "Reduce commercial clutter", "Open complaint-zero staff review"]
  },
  "product/member-controls": {
    headline: "Members control profile, connections, security, notifications, support, and complaint prevention.",
    body: [
      "Account controls include profile settings, connection permissions, messages and blocks, notification settings, support or dispute help, report security concern, trusted contacts, and device-session management.",
      "The complaint-prevention panel gives users a simple path when feed, privacy, ads, spam, safety, support, notification, or product-direction issues come up.",
      "The Android app uses the same account controls and should keep member-visible privacy, support, safety, and device-session paths aligned with the hosted website.",
      "The goal is to solve predictable social-app complaints before they become public frustration."
    ],
    actions: ["Edit profile", "Manage connections", "Open support"]
  },
  "product/staff-controls": {
    headline: "Staff controls are loaded for management, support, trust, fraud, and complaint operations.",
    body: [
      "Staff and management accounts stay in operator mode with Management, Staff Tools, and Control Library instead of member-side content.",
      "Management includes staff setup, role templates, support operations, loaded staff controls, merchant risk, settlement controls, compliance controls, device recovery, and complaint-zero staff controls.",
      "The staff console is designed to handle disputes, fraud, security concerns, moderation, privacy concerns, and product-drift reports without sending staff back into member content."
    ],
    actions: ["Manage staff roles", "Open support operations", "Review complaint-zero dashboard"]
  }
};

function buildFallbackPageContent(group, item) {
  return {
    headline: `${item} for FoxHub members.`,
    body: [
      group.summary,
      "This public page gives visitors a real destination from the footer while final launch copy is prepared.",
      "Before broader advertising, this page should be reviewed for exact policy, support, or product wording."
    ],
    actions: [`${group.label} owner: ${group.owner}`, `Status: ${group.status}`, "Ready for final copy"]
  };
}

export function getFooterPageByPath(pathname = "") {
  const match = String(pathname).match(/^\/footer\/([^/]+)\/([^/]+)$/);
  if (!match) return null;
  const [, groupId, itemSlug] = match;
  const group = footerBoilerplateGroups.find((entry) => entry.id === groupId);
  if (!group) return null;
  const item = group.items.find((entry) => slugifyFooterItem(entry) === itemSlug);
  if (!item) return null;
  const content = footerPageContent[`${group.id}/${itemSlug}`] || buildFallbackPageContent(group, item);
  return {
    group,
    item,
    slug: itemSlug,
    title: item,
    eyebrow: group.label,
    summary: group.summary,
    owner: group.owner,
    status: group.status,
    headline: content.headline,
    body: content.body,
    actions: content.actions,
    relatedItems: group.items.filter((entry) => entry !== item)
  };
}
