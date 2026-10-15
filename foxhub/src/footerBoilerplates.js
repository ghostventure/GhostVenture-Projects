export const footerBoilerplateGroups = [
  {
    id: "legal",
    label: "Legal",
    glyph: "L",
    summary: "Plain-language rules for accounts, privacy, complaint controls, marketplace activity, payments, and community behavior.",
    accent: "Clear rules",
    owner: "Policy",
    status: "Review-ready",
    items: ["Terms of Use", "Privacy Policy", "Complaint Controls", "Marketplace Rules", "Payment Terms", "Cookie Notice"]
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
    headline: "Your private activity, account controls, and staff-visible data should be clear.",
    body: [
      "FoxHub is built around private circles, trusted local coordination, and clear account controls.",
      "The product direction is to avoid broad scanning of private messages and personal images for advertising profiles. Private spaces should not feel like public feeds.",
      "Member controls now separate public, private, staff-visible, notification, connection, security-session, and support paths so users are not guessing where their information goes.",
      "Safety checks should stay focused on abuse, fraud, security, harmful recommendations, and clearly illegal activity, not ordinary private life.",
      "Production privacy terms should be reviewed before any paid campaign scales."
    ],
    actions: ["Review account visibility", "Manage device sessions", "Keep private circles private"]
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
      "Marketplace, payments, services, and merchant tools need clear rules before production use.",
      "The current page is ready for final legal review and public launch copy."
    ],
    actions: ["Define accepted use", "Explain account limits", "Finalize legal review"]
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
      "Early access users need a visible route for account, invite, privacy, marketplace, and safety issues.",
      "This page should become the main public contact path before ad spend increases.",
      "The support experience should set expectations for response time and what information users should include."
    ],
    actions: ["Describe the issue", "Attach context", "Set response expectations"]
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
