import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url)).replace(/\/scripts$/, "");
const dataModuleUrl = pathToFileURL(path.join(rootDir, "src/data.js")).href;
const data = await import(dataModuleUrl);
const rulesModuleUrl = pathToFileURL(path.join(rootDir, "src/rules.js")).href;
const rules = await import(rulesModuleUrl);
const cssSource = await readFile(path.join(rootDir, "src/styles.css"), "utf8");

function text(value = "", fallback = "") {
  return String(value || fallback || "").trim();
}

function first(value, fallback = "") {
  return text(value, fallback);
}

function priceLine(item = {}) {
  const price = Number(item.price || 0);
  return price ? `$${price.toLocaleString("en-US")}` : "Price pending";
}

function compactItems(items = [], mapper, limit = 8) {
  return items.slice(0, limit).map(mapper).filter((item) => item.title && item.detail);
}

const mobileTabs = [
  { id: "hub", label: "Home" },
  { id: "chat", label: "Social" },
  { id: "circles", label: "Rapport" },
  { id: "growth", label: "Communal" },
  { id: "discover", label: "Services" },
  { id: "market", label: "Needs" },
  { id: "wallet", label: "Pay" },
  { id: "experience", label: "Goodies" },
  { id: "connectors", label: "Tools" },
  { id: "blueprint", label: "Organizer" },
  { id: "management", label: "Ops", managementOnly: true }
];

const mobileContacts = compactItems(data.contacts || [], (contact) => ({
  title: first(contact.displayName, contact.name),
  meta: `${first(contact.handle, "@member")} · ${first(contact.city, "Local")} · ${first(contact.lastActiveLabel, contact.status)}`,
  detail: first(contact.strength, `${first(contact.status, contact.accountType)} · ${first(contact.referralSource, contact.preferredSurface)}`),
  badge: first(contact.trustTier, contact.trust)
}));

const mobileCircles = compactItems(data.circles || [], (circle) => ({
  title: first(circle.name, "FoxHub circle"),
  meta: first(circle.members, "members pending"),
  detail: `${first(circle.focus, "community")} · ${first(circle.trust, "open circle")}`
}));

const mobileListings = compactItems(data.listings || [], (listing) => ({
  title: first(listing.title, "FoxHub listing"),
  meta: `${first(listing.category, "Listing")} · ${first(listing.city, "Local")} · ${first(listing.neighborhood, "nearby")} · ${priceLine(listing)}`,
  detail: first(listing.description, "Trusted local need or offer."),
  badge: listing.verified ? "Verified" : first(listing.status, "Open")
}));

const mobilePlaces = compactItems(data.foxhubPlaces || [], (place) => ({
  title: first(place.name, "Local place"),
  meta: `${first(place.distance, "nearby")} · ${first(place.rating, "rated")} · ${first(place.status, "open")}`,
  detail: first(place.note, place.type)
}));

const mobileMiniApps = compactItems(data.miniApps || [], (app) => ({
  title: first(app.name, app.title),
  meta: first(app.category, app.type),
  detail: first(app.summary, app.description)
}), 10);

const mobileWalletEvents = compactItems(data.walletEvents || [], (event) => ({
  title: first(event.title, event.kind || "Wallet event"),
  meta: first(event.amount, event.meta),
  detail: first(event.meta, event.detail || "Wallet activity")
}), 8);

const mobileGoodies = compactItems(data.foxhubExpansionComponents || [], (item) => ({
  title: first(item.component, item.title),
  meta: first(item.zone, item.highlight),
  detail: first(item.summary, item.detail)
}), 8);

const mobileTools = compactItems(data.apiConnectors || [], (connector) => ({
  title: first(connector.name, connector.id),
  meta: first(connector.status, connector.category),
  detail: first(connector.summary, connector.description || connector.intent)
}), 8);

const mobileServices = compactItems(data.services || [], (service) => ({
  title: first(service.name, service.title),
  meta: first(service.category, service.group),
  detail: first(service.description, service.summary)
}), 8);

const mobileShops = compactItems(data.shopProfiles || [], (shop) => ({
  title: first(shop.name, "Merchant"),
  meta: `${first(shop.category, shop.type)} · ${first(shop.city, "Local")}`,
  detail: first(shop.summary, shop.description || shop.status)
}), 6);

const mobileThreads = compactItems(data.threads || [], (thread) => {
  const messages = Array.isArray(thread.messages) ? thread.messages : [];
  const last = messages[messages.length - 1] || {};
  return {
    title: first(thread.name, "FoxHub thread"),
    meta: `${first(thread.type, "thread")} · ${first(thread.lastActiveLabel, thread.presence)}`,
    detail: first(last.text, last.body || "No recent message.")
  };
}, 8);

const mobileOfficial = compactItems(data.officialAccounts || [], (account) => ({
  title: first(account.name, "Official account"),
  meta: first(account.category, account.type),
  detail: first(account.summary, account.tagline || "Platform signal")
}), 6);

const mobileOrganizerRooms = [
  { title: "Identity graph", meta: "Foundation", detail: "Profiles, one identity marker, trust tiers, and onboarding." },
  { title: "Direct messages and groups", meta: "Social", detail: "Private threads, group rooms, service channels, and calls." },
  { title: "Wallet ledger", meta: "Pay", detail: "P2P transfers, merchant pay, escrow holds, and risk review." },
  { title: "Mini-app runtime", meta: "Platform", detail: "Signed embeds, permissions, context, and continuity." }
];

const mobileManagementQueues = [
  { title: "FoxHub Member applications", meta: `${(data.userRecords || []).filter((item) => ["review", "pending", "onboarding"].includes(String(item.stage || item.identityState || "").toLowerCase())).length} reviews`, detail: "Waitlist, sponsor-pending, and invite decisions." },
  { title: "Verification queue", meta: "Identity + merchant", detail: "Identity, merchant docs, payout, and risk review." },
  { title: "Merchant risk controls", meta: `${(data.trustSafetyIncidents || []).length || 0} alerts`, detail: "Settlement holds, compliance alerts, and onboarding depth." },
  { title: "Complaint-zero dashboard", meta: "Live", detail: "Staff controls, support alerts, macros, and audit trail." },
  { title: "Device recovery review", meta: "Ready", detail: "Recovery checks, session revocation, and security concerns." }
];

const mobileMetrics = [
  { label: "Social", value: `${mobileThreads.length} threads`, detail: "Chats, service channels, groups, and moments." },
  { label: "Rapport", value: `${mobileContacts.length} people`, detail: "Trust tiers, vouches, and relationship scores." },
  { label: "Communal", value: `${mobileCircles.length} circles`, detail: "Local rooms for creators, hosts, and builders." },
  { label: "Services", value: `${mobileListings.length} listings`, detail: "Needs, offers, jobs, housing, merchants, and help." }
];

const mobileScreens = {
  hub: {
    eyebrow: "Community Rapport Network",
    title: "People first. Trust next. Communities become the market.",
    summary: "Home brings together people, circles, local needs, wallet context, and FoxHub helpers.",
    sections: [
      { title: "Relationship order", data: mobileMetrics },
      { title: "Trusted introductions", data: mobileContacts.slice(0, 3) },
      { title: "Community-to-service bridge", data: mobileListings.slice(0, 3) }
    ]
  },
  chat: {
    eyebrow: "Social",
    title: "Chats, moments, groups, and service channels.",
    summary: "The website keeps personal threads, official channels, read state, call sessions, and save actions close together.",
    sections: [
      { title: "Pinned threads", data: mobileThreads },
      { title: "Official signals", data: mobileOfficial }
    ]
  },
  circles: {
    eyebrow: "Rapport",
    title: "Trust records, introductions, circles, and reputation.",
    summary: "The site separates personal, professional, communal, and service trust lanes.",
    sections: [
      { title: "Trusted people", data: mobileContacts },
      { title: "Circle anchors", data: mobileCircles }
    ]
  },
  growth: {
    eyebrow: "Communal",
    title: "Grouped categories for community growth.",
    summary: "Communal organizes circles, rooms, event loops, creator programs, and local belonging before transactions.",
    sections: [
      { title: "Community rooms", data: mobileCircles },
      { title: "Recent activity", data: mobileOfficial.slice(0, 4) }
    ]
  },
  discover: {
    eyebrow: "Services / Merchant",
    title: "Search, local discovery, back room, and merchant workflows.",
    summary: "Services combines nearby places, mini apps, merchant dashboards, route planning, and document vault concepts.",
    sections: [
      { title: "Service catalog", data: mobileMiniApps.length ? mobileMiniApps : mobileServices },
      { title: "Nearby places", data: mobilePlaces },
      { title: "Merchant coverage", data: mobileShops }
    ]
  },
  market: {
    eyebrow: "Needs & Offers",
    title: "Listings, saved searches, alerts, auctions, and reviews.",
    summary: "The website market mixes local speed, decision clarity, watch signals, and seller trust.",
    sections: [
      { title: "Listings", data: mobileListings },
      { title: "Market signals", data: compactItems(data.foxhubMarketSignals || [], (signal) => ({
        title: first(signal.title),
        meta: first(signal.cue),
        detail: first(signal.detail)
      }), 6) }
    ]
  },
  wallet: {
    eyebrow: "Pay",
    title: "Wallet shortcuts, bill pay, QR history, and moderator layer.",
    summary: "Pay keeps transfer actions near the chats and merchant surfaces that create the transaction.",
    sections: [
      { title: "Wallet shortcuts", data: [
        { title: "Send", meta: "Peer transfer", detail: "Move funds from the active thread." },
        { title: "Top up", meta: "Instant debit load", detail: "Add funds before paying or splitting." },
        { title: "Merchant pay", meta: "QR checkout", detail: "Pay a local merchant with context attached." },
        { title: "Cash out", meta: "Bank payout", detail: "Move balance out after review." }
      ] },
      { title: "Recent activity", data: mobileWalletEvents }
    ]
  },
  experience: {
    eyebrow: "UX / Goodies",
    title: "Goodie list, connection, context rail, and guided create.",
    summary: "The website has a dedicated UX surface for installed interaction patterns and review tools.",
    sections: [
      { title: "Installed goodies", data: mobileGoodies },
      { title: "Context rail", data: mobileMiniApps.slice(0, 4) }
    ]
  },
  connectors: {
    eyebrow: "Tools",
    title: "API connectors, billing plans, and connector registry.",
    summary: "Tools tracks connector intent, test status, and production-readiness around the platform.",
    sections: [
      { title: "Connector registry", data: mobileTools },
      { title: "Production components", data: mobileGoodies.slice(0, 4) }
    ]
  },
  blueprint: {
    eyebrow: "Organizer",
    title: "Easy browsing, organizer rooms, and follow-up activity.",
    summary: "Organizer is the site map for the product build order and operational rooms.",
    sections: [
      { title: "Organizer rooms", data: mobileOrganizerRooms },
      { title: "Next steps", data: [
        { title: "Real auth methods", meta: "Next", detail: "Wire mobile to Firebase Auth and profile repositories." },
        { title: "Durable profile state", meta: "Next", detail: "Persist saved items, mini-app permissions, and user records." },
        { title: "Notifications", meta: "Next", detail: "Add media attachments, unread counters, and alert state." }
      ] }
    ]
  },
  management: {
    eyebrow: "Management dashboard",
    title: "Staff, review queues, risk controls, and operator actions.",
    summary: "Management stays separate from member sign-in and covers applications, support, verification, risk, and audit trails.",
    sections: [
      { title: "Operator queues", data: mobileManagementQueues },
      { title: "Staff controls", data: [
        { title: "Add new FoxHub Staff Member", meta: "Controlled", detail: "Founder/management-only account setup path." },
        { title: "Support macros", meta: "Loaded", detail: "Reusable response patterns for low-friction support." },
        { title: "Notification digest", meta: "Ready", detail: "Operator-visible alert summaries and action history." }
      ] }
    ]
  }
};

const generated = {
  mobileTabs,
  mobileScreens
};

const targetPath = path.join(rootDir, "mobile/src/foxhubMobileContent.generated.js");
const output = `// Generated by scripts/sync-mobile-content.mjs from src/data.js.\n// Do not edit by hand; run npm run mobile:sync-content.\n\nexport const mobileTabs = ${JSON.stringify(generated.mobileTabs, null, 2)};\n\nexport const mobileScreens = ${JSON.stringify(generated.mobileScreens, null, 2)};\n`;

await writeFile(targetPath, output, "utf8");

function parseThemeVariables(themeId) {
  const escaped = themeId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = cssSource.match(new RegExp(`:root\\[data-theme="${escaped}"\\]\\s*\\{([\\s\\S]*?)\\}`, "m"));
  if (!match) return null;
  const variables = {};
  for (const line of match[1].split("\n")) {
    const varMatch = line.match(/--([a-z-]+):\s*([^;]+);/);
    if (varMatch) variables[varMatch[1]] = varMatch[2].trim();
  }
  return variables;
}

function asHexColor(value, fallback) {
  const color = String(value || "").trim();
  return /^#[0-9a-f]{3,8}$/i.test(color) ? color : fallback;
}

const mobileThemes = rules.THEME_OPTIONS.map((theme) => {
  const vars = parseThemeVariables(theme.id) || {};
  return {
    id: theme.id,
    label: theme.label,
    colors: {
      bg: asHexColor(vars.bg, "#f6f8f6"),
      layer: asHexColor(vars["bg-layer"], "#e9eeeb"),
      panel: asHexColor(vars.surface, "#ffffff"),
      panelAlt: asHexColor(vars["surface-alt"], "#f7fbf8"),
      ink: asHexColor(vars.text, "#17211f"),
      muted: asHexColor(vars["text-dim"], "#5d6965"),
      soft: asHexColor(vars["text-soft"], "#2f4939"),
      line: asHexColor(vars.border, "#d8e0dd"),
      lineStrong: asHexColor(vars["border-strong"], "#c8dccf"),
      accent: asHexColor(vars.accent, "#216b49"),
      accentStrong: asHexColor(vars["accent-strong"], "#174832"),
      accentSoft: /^rgba?\(/.test(String(vars["accent-soft"] || "")) ? vars["accent-soft"] : "#edf5f0",
      gold: asHexColor(vars.gold, "#b7812f"),
      green: asHexColor(vars.green, "#216b49")
    }
  };
});

const themeTargetPath = path.join(rootDir, "mobile/src/foxhubMobileThemes.generated.js");
const themeOutput = `// Generated by scripts/sync-mobile-content.mjs from src/rules.js and src/styles.css.\n// Do not edit by hand; run npm run mobile:sync-content.\n\nexport const mobileThemes = ${JSON.stringify(mobileThemes, null, 2)};\n\nexport const defaultMobileThemeId = "green-composite";\n`;

await writeFile(themeTargetPath, themeOutput, "utf8");
console.log(`Synced mobile content to ${path.relative(rootDir, targetPath)}`);
console.log(`Synced mobile themes to ${path.relative(rootDir, themeTargetPath)}`);
